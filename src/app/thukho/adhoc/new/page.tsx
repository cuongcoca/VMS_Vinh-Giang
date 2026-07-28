"use client";
import { fetchJson } from "@/lib/api";
import { mobileHref } from "@/lib/mobile-href";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Supplier = { id: string; code: string; name: string };

const SOURCE_OPTIONS = [
  { value: "SUPPLIER", label: "Nhà cung cấp" },
  { value: "RETURN", label: "Hàng trả lại" },
  { value: "OTHER", label: "Khác" },
] as const;

const REASON_OPTIONS = [
  { value: "EARLY", label: "Hàng về sớm hơn dự kiến" },
  { value: "NOT_READY", label: "Chưa kịp lập phiếu" },
  { value: "UNNOTIFIED_RETURN", label: "Hàng trả lại không báo trước" },
  { value: "NEW_SUPPLIER", label: "NCC mới chưa khai báo" },
  { value: "OTHER", label: "Khác (ghi chú)" },
] as const;

const MAX_PHOTOS = 3;
const MAX_PHOTO_SIZE_MB = 5;

function nowLocalIso(): string {
  // YYYY-MM-DDTHH:MM cho <input type="datetime-local">
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// CT-1 (2026-05-28): prefix PTT → PNT theo mockup wms_mockups_4.html v3.0.
function previewCodeFallback(): string {
  const d = new Date();
  return `PNT-${d.getFullYear()}-…`;
}

export default function ThukhoNewAdhocPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [deliveredBy, setDeliveredBy] = useState("");
  const [receivedAt, setReceivedAt] = useState(nowLocalIso());
  const [reason, setReason] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Phase 4.1 — TC_TMP_IN_018: preview mã thật từ BE
  const [previewCode, setPreviewCode] = useState<string>(previewCodeFallback());

  useEffect(() => {
    fetchJson<{ data?: unknown[] }>(`${basePath}/api/suppliers`)
      .then((body) => setSuppliers((body.data ?? []) as typeof suppliers))
      .catch(console.error);

    fetch(`${basePath}/api/inbound-temp/next-code`)
      .then((r) => r.json())
      .then((j) => { if (j.success && j.data?.code) setPreviewCode(j.data.code); })
      .catch(console.error);
  }, [basePath]);

  // Cleanup blob URLs khi component unmount hoặc thay đổi
  useEffect(() => {
    return () => { photoPreviews.forEach((u) => URL.revokeObjectURL(u)); };
  }, [photoPreviews]);

  const handlePickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remaining = MAX_PHOTOS - photos.length;
    const accepted = files.slice(0, remaining).filter((f) => {
      if (!f.type.startsWith("image/")) return false;
      if (f.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) return false;
      return true;
    });
    if (accepted.length === 0) {
      setError(`Ảnh phải là JPEG/PNG/WebP, tối đa ${MAX_PHOTO_SIZE_MB}MB.`);
      return;
    }
    setError("");
    setPhotos((prev) => [...prev, ...accepted]);
    setPhotoPreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => {
      const u = prev[idx];
      if (u) URL.revokeObjectURL(u);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async () => {
    setError("");
    if (!sourceType) { setError("Vui lòng chọn nguồn hàng."); return; }
    if (!receivedAt) { setError("Vui lòng chọn ngày giờ nhận."); return; }
    if (!reason) { setError("Vui lòng chọn lý do nhập đột xuất."); return; }
    if (reason === "OTHER" && !reasonDetail.trim() && !note.trim()) {
      setError("Vui lòng mô tả chi tiết lý do ở ghi chú khi chọn 'Khác'.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Tạo phiếu tạm
      const res = await fetch(`${basePath}/api/inbound-temp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplierId || null,
          source_type: sourceType,
          delivered_by: deliveredBy.trim() || null,
          received_at: receivedAt,
          reason,
          reason_detail: reason === "OTHER" ? (reasonDetail.trim() || note.trim()) : null,
          note: note.trim() || null,
        }),
      });
      const json = await res.json();
      if (!json.success || !json.data) {
        setError(json.error || "Lỗi tạo phiếu");
        setSubmitting(false);
        return;
      }
      const tempId = json.data.id;

      // 2. Upload ảnh đính kèm (nếu có) — không block redirect nếu upload fail
      if (photos.length > 0) {
        const uploadResults = await Promise.allSettled(
          photos.map((file) => {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("entity_type", "inbound_temp");
            fd.append("entity_id", tempId);
            return fetch(`${basePath}/api/attachments`, { method: "POST", body: fd });
          })
        );
        const failed = uploadResults.filter((r) => r.status === "rejected").length;
        if (failed > 0) {
          // Vẫn redirect, hiển thị warning ở trang detail
          console.warn(`${failed}/${photos.length} ảnh upload thất bại.`);
        }
      }

      router.push(mobileHref(`/thukho/adhoc/${tempId}`));
    } catch (e) {
      console.error(e);
      setError("Lỗi kết nối mạng.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-md">
      {/* Top warning bar — màu cam giống mockup */}
      <div className="bg-amber-500 text-white px-margin-mobile py-3 flex items-center gap-2 shadow-sm">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) router.back();
            else router.push(mobileHref("/thukho/inbound"));
          }}
          className="flex items-center hover:opacity-80"
        >
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
        <h1 className="text-base font-bold flex-1">Nhập đột xuất</h1>
      </div>

      <div className="px-margin-mobile flex flex-col gap-md">
        {/* Note box cam */}
        <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded-md text-xs text-amber-900 flex gap-2 items-start">
          <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">bolt</span>
          <div>
            <strong>Nhập đột xuất:</strong> Dùng khi hàng về chưa có phiếu yêu cầu. Kế toán sẽ chuẩn hóa sau.
          </div>
        </div>

        {/* Mã phiếu (auto preview) */}
        <div>
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase block mb-1">Mã phiếu (auto)</label>
          <input
            type="text"
            value={previewCode}
            disabled
            className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-surface-low font-mono font-semibold text-on-surface-variant"
          />
        </div>

        {/* Nguồn hàng * */}
        <div>
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase block mb-1">
            Nguồn hàng <span className="text-error">*</span>
          </label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white"
          >
            <option value="">— Chọn —</option>
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* NCC (tùy chọn, chỉ hiển thị khi source = SUPPLIER) */}
        {sourceType === "SUPPLIER" && (
          <div>
            <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase block mb-1">Nhà cung cấp</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white"
            >
              <option value="">— Chọn NCC —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Người giao */}
        <div>
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase block mb-1">Người giao</label>
          <input
            type="text"
            value={deliveredBy}
            onChange={(e) => setDeliveredBy(e.target.value)}
            maxLength={120}
            placeholder="Tên người/đơn vị giao hàng"
            className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white"
          />
        </div>

        {/* Ngày giờ nhận * */}
        <div>
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase block mb-1">
            Ngày giờ nhận <span className="text-error">*</span>
          </label>
          <input
            type="datetime-local"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white"
          />
        </div>

        {/* Lý do * */}
        <div>
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase block mb-1">
            Lý do nhập đột xuất <span className="text-error">*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white"
          >
            <option value="">— Chọn lý do —</option>
            {REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Ảnh chứng từ */}
        <div>
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase block mb-1">
            Ảnh chứng từ <span className="text-on-surface-variant/60 normal-case font-normal">({photos.length}/{MAX_PHOTOS})</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {/* Slot upload — chỉ hiện nếu chưa đủ MAX_PHOTOS */}
            {photos.length < MAX_PHOTOS && (
              <label className="w-[60px] h-[60px] bg-white border-2 border-dashed border-outline-variant rounded-md flex items-center justify-center cursor-pointer hover:bg-surface-low active:scale-95 transition-all">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePickPhoto}
                  className="hidden"
                />
                <span className="material-symbols-outlined text-[24px] text-on-surface-variant">photo_camera</span>
              </label>
            )}
            {/* Previews */}
            {photoPreviews.map((url, idx) => (
              <div key={idx} className="relative w-[60px] h-[60px] rounded-md overflow-hidden border border-outline-variant group">
                <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-[14px] opacity-100 transition-opacity"
                  aria-label="Xóa ảnh"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            ))}
            {/* Placeholder ô trống cho đủ 3 slot UI */}
            {Array.from({ length: Math.max(0, MAX_PHOTOS - photos.length - 1) }).map((_, i) => (
              <div key={`ph-${i}`} className="w-[60px] h-[60px] bg-surface-low/50 rounded-md flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant/30">image</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ghi chú */}
        <div>
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase block mb-1">Ghi chú</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Mô tả thêm..."
            className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white resize-none"
          />
        </div>

        {error && (
          <div className="p-sm bg-error-container/20 border border-error/30 rounded-lg text-xs text-error font-semibold flex gap-2 items-start">
            <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Submit cam */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-lg">
            {submitting ? "progress_activity" : "note_add"}
          </span>
          {submitting ? "Đang tạo..." : "Tạo phiếu nhập tạm"}
        </button>
        <p className="text-[11px] md:text-xs text-on-surface-variant text-center -mt-1">
          Sau khi tạo, bạn có thể tạo pallet và cập nhật hàng vào phiếu này.
        </p>
      </div>
    </div>
  );
}
