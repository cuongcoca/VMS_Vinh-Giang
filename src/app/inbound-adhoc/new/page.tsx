"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";

type Supplier = { id: string; code: string; name: string };

const SOURCE_TYPES = [
  { value: "SUPPLIER", label: "🚚 Nhà cung cấp" },
  { value: "RETURN", label: "↩️ Hàng trả lại" },
  { value: "OTHER", label: "📦 Khác" },
];

const REASONS = [
  { value: "EARLY", label: "Hàng về sớm hơn dự kiến" },
  { value: "NOT_READY", label: "Phiếu nhập chưa chuẩn bị xong" },
  { value: "UNNOTIFIED_RETURN", label: "Hàng trả lại — chưa thông báo trước" },
  { value: "NEW_SUPPLIER", label: "NCC mới — chưa có trong hệ thống" },
  { value: "OTHER", label: "Khác (ghi rõ bên dưới)" },
];

export default function NewInboundAdhocPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [proposedCode, setProposedCode] = useState("Đang tải…");

  // 8 fields theo mockup UC-INTMP-01
  const [supplierId, setSupplierId] = useState("");
  const [sourceType, setSourceType] = useState("SUPPLIER");
  const [deliveredBy, setDeliveredBy] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [reason, setReason] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // entity_id tạm cho mỗi draft (sau khi tạo phiếu thật, attachments vẫn tra cứu được qua URL)
  const draftEntityIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const MAX_PHOTO_SIZE_MB = 5;
  const MAX_PHOTOS = 10;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`File "${file.name}" không phải ảnh hợp lệ (JPEG/PNG/WebP/GIF).`);
      return null;
    }
    if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      setError(`File "${file.name}" vượt quá ${MAX_PHOTO_SIZE_MB}MB.`);
      return null;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("entity_type", "inbound_temp_draft");
    fd.append("entity_id", draftEntityIdRef.current);
    try {
      const res = await fetch("/wms/api/attachments", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Upload ảnh thất bại.");
        return null;
      }
      return json.data?.file_url || null;
    } catch (e) {
      console.error(e);
      setError("Lỗi mạng khi upload ảnh.");
      return null;
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const remaining = MAX_PHOTOS - photoUrls.length - uploadingCount;
    if (remaining <= 0) {
      setError(`Đã đạt giới hạn tối đa ${MAX_PHOTOS} ảnh.`);
      return;
    }
    const accepted = arr.slice(0, remaining);
    if (accepted.length < arr.length) {
      setError(`Chỉ thêm ${accepted.length}/${arr.length} ảnh (giới hạn tối đa ${MAX_PHOTOS}).`);
    } else {
      setError("");
    }
    setUploadingCount((c) => c + accepted.length);
    const results = await Promise.all(accepted.map((f) => uploadFile(f)));
    const ok = results.filter((u): u is string => !!u);
    if (ok.length > 0) setPhotoUrls((prev) => [...prev, ...ok]);
    setUploadingCount((c) => Math.max(0, c - accepted.length));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Paste image bằng Ctrl+V vào bất kỳ đâu trong form
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const images: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) images.push(f);
        }
      }
      if (images.length > 0) {
        e.preventDefault();
        handleFiles(images);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/wms/api/suppliers").then(r => r.json()).then(r => { if (r.success) setSuppliers(r.data); });
    // Preview mã phiếu PNT-YYYY-SSSS (CT-1: PTT → PNT theo mockup)
    fetch("/wms/api/inbound-temp").then(r => r.json()).then(r => {
      if (r.success && r.data && r.data.length > 0) {
        const lastCode: string = r.data[0].code || "";
        // Match cả PNT (mới) lẫn PTT (legacy) trong giai đoạn migrate.
        const match = lastCode.match(/^(?:PNT|PTT)-(\d{4})-(\d{4})/);
        const year = new Date().getFullYear();
        if (match) {
          const lastYear = parseInt(match[1]);
          const lastSeq = parseInt(match[2]);
          const nextSeq = lastYear === year ? lastSeq + 1 : 1;
          setProposedCode(`PNT-${year}-${String(nextSeq).padStart(4, "0")}`);
        } else {
          setProposedCode(`PNT-${year}-0001`);
        }
      } else {
        setProposedCode(`PNT-${new Date().getFullYear()}-0001`);
      }
    }).catch(() => setProposedCode(`PNT-${new Date().getFullYear()}-0001`));
  }, []);

  const addPhotoUrl = () => {
    const url = newPhotoUrl.trim();
    if (!url) return;
    if (photoUrls.length >= MAX_PHOTOS) {
      setError(`Đã đạt giới hạn tối đa ${MAX_PHOTOS} ảnh.`);
      return;
    }
    setPhotoUrls([...photoUrls, url]);
    setNewPhotoUrl("");
    setError("");
  };

  const removePhotoUrl = (idx: number) => setPhotoUrls(photoUrls.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Client-side validate
    if (!sourceType) { setError("Vui lòng chọn nguồn hàng."); return; }
    if (!deliveredBy.trim()) { setError("Vui lòng điền người giao."); return; }
    if (!receivedAt) { setError("Vui lòng điền ngày giờ nhận."); return; }
    if (!reason) { setError("Vui lòng chọn lý do nhập tạm."); return; }
    if (reason === "OTHER" && !reasonDetail.trim()) { setError("Vui lòng điền chi tiết lý do khi chọn 'Khác'."); return; }

    setSaving(true);
    try {
      const res = await fetch("/wms/api/inbound-temp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplierId || null,
          source_type: sourceType,
          delivered_by: deliveredBy.trim(),
          received_at: receivedAt,
          reason,
          reason_detail: reasonDetail.trim() || null,
          photo_urls: photoUrls,
          note: note.trim() || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        router.push(`/inbound-adhoc/${result.data.id}`);
      } else {
        setError(result.error || "Lỗi khi tạo phiếu.");
        setSaving(false);
      }
    } catch (err) { console.error(err); setError("Lỗi kết nối."); setSaving(false); }
  };

  return (
    <AppLayout title="TẠO PHIẾU TẠM">
      <div className="p-6 max-w-3xl space-y-5">
        <BackButton fallback="/inbound-adhoc">Quay lại danh sách</BackButton>
        <div>
          <h1 className="text-2xl font-bold text-primary">Tạo phiếu tồn tạm</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">Ghi nhận hàng nhập tạm khi chưa có phiếu yêu cầu chính thức.</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Thông tin phiếu */}
          <div className="bg-white rounded-xl border border-outline-variant p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">description</span>
              Thông tin phiếu
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Mã phiếu auto */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Mã phiếu (auto)</label>
                <input type="text" value={proposedCode} readOnly className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-surface-low text-on-surface-variant font-mono font-bold focus:outline-none" />
              </div>

              {/* Nguồn hàng */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Nguồn hàng <span className="text-rose-500">*</span></label>
                <select value={sourceType} onChange={e => setSourceType(e.target.value)} required className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                  {SOURCE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {/* Ngày giờ nhận */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Ngày giờ nhận <span className="text-rose-500">*</span></label>
                <input type="datetime-local" value={receivedAt} onChange={e => setReceivedAt(e.target.value)} required className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>

              {/* NCC */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Nhà cung cấp {sourceType === "SUPPLIER" && <span className="text-on-surface-variant/70">(chọn nếu có)</span>}</label>
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                  <option value="">— Chọn NCC —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                </select>
              </div>

              {/* Người giao */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Người giao hàng <span className="text-rose-500">*</span></label>
                <input type="text" value={deliveredBy} onChange={e => setDeliveredBy(e.target.value)} required placeholder="Tên người/đơn vị giao hàng..." className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            </div>
          </div>

          {/* Section 2: Lý do nhập tạm */}
          <div className="bg-white rounded-xl border border-outline-variant p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">help</span>
              Lý do nhập tạm
            </h2>

            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Lý do <span className="text-rose-500">*</span></label>
              <select value={reason} onChange={e => setReason(e.target.value)} required className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                <option value="">— Chọn lý do —</option>
                {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            {reason === "OTHER" && (
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Chi tiết lý do <span className="text-rose-500">*</span></label>
                <textarea value={reasonDetail} onChange={e => setReasonDetail(e.target.value)} required rows={2} placeholder="Mô tả chi tiết lý do nhập tạm..." className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
              </div>
            )}
          </div>

          {/* Section 3: Ảnh chứng từ */}
          <div className="bg-white rounded-xl border border-outline-variant p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
              Ảnh chứng từ <span className="text-xs font-normal text-on-surface-variant/70 normal-case">(tùy chọn · tối đa {MAX_PHOTOS} ảnh · {photoUrls.length}/{MAX_PHOTOS})</span>
            </h2>

            {/* Upload từ máy + drag drop zone — click bất cứ đâu trong vùng này mở file picker */}
            <div
              role="button"
              tabIndex={photoUrls.length >= MAX_PHOTOS ? -1 : 0}
              onClick={() => { if (photoUrls.length < MAX_PHOTOS) fileInputRef.current?.click(); }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && photoUrls.length < MAX_PHOTOS) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); }}
              className={`border-2 border-dashed border-outline-variant rounded-lg p-6 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                photoUrls.length >= MAX_PHOTOS
                  ? "bg-surface-low/20 cursor-not-allowed opacity-60"
                  : "bg-surface-low/30 hover:bg-surface-low/60 cursor-pointer"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-2 pointer-events-none">
                <span className="material-symbols-outlined text-[36px] text-primary/60">cloud_upload</span>
                <p className="text-sm font-medium text-on-surface">
                  <span className="text-primary font-semibold underline underline-offset-2">Click để chọn ảnh từ máy</span>
                  {" "}hoặc kéo thả vào đây
                </p>
                <p className="text-xs text-on-surface-variant/70">
                  Hoặc nhấn <kbd className="px-1.5 py-0.5 border border-outline-variant rounded bg-white font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 border border-outline-variant rounded bg-white font-mono text-[10px]">V</kbd> để dán ảnh từ clipboard
                </p>
                <p className="text-[10px] text-on-surface-variant/50">
                  JPEG / PNG / WebP / GIF · tối đa {MAX_PHOTO_SIZE_MB}MB mỗi ảnh · tối đa {MAX_PHOTOS} ảnh / phiếu
                </p>
              </div>
              {uploadingCount > 0 && (
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-primary font-semibold">
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  Đang upload {uploadingCount} ảnh...
                </div>
              )}
            </div>

            {/* Option: thêm ảnh bằng URL (vẫn giữ cho ai có link sẵn) */}
            <details className="text-xs">
              <summary className="cursor-pointer text-on-surface-variant hover:text-primary font-medium select-none">
                Hoặc thêm bằng URL ảnh có sẵn ▾
              </summary>
              <div className="flex gap-2 mt-2">
                <input
                  type="url"
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={addPhotoUrl}
                  disabled={photoUrls.length >= MAX_PHOTOS}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>Thêm URL
                </button>
              </div>
            </details>

            {photoUrls.length > 0 && (
              <div>
                <p className="text-xs text-on-surface-variant mb-2">Đã thêm <strong>{photoUrls.length}</strong> ảnh:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {photoUrls.map((url, i) => (
                    <div key={i} className="relative group border border-outline-variant rounded-lg overflow-hidden bg-surface-low aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Ảnh ${i + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <button
                        type="button"
                        onClick={() => removePhotoUrl(i)}
                        className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Xóa ảnh"
                      >
                        <span className="material-symbols-outlined text-[12px]">close</span>
                      </button>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                        {(url.split("/").pop() || "image").slice(-24)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Ghi chú */}
          <div className="bg-white rounded-xl border border-outline-variant p-6 shadow-sm">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Ghi chú chung</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Ghi chú thêm về phiếu tạm (nếu có)..." className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="px-6 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "save"}</span>
              {saving ? "Đang lưu..." : "Tạo phiếu tạm"}
            </button>
            <Link href="/inbound-adhoc" className="px-6 py-3 border border-outline-variant text-on-surface bg-white rounded-lg text-sm font-semibold hover:bg-surface-low transition-colors">
              Hủy
            </Link>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
