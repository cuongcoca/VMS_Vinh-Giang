"use client";
import { mobileHref } from "@/lib/mobile-href";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { BackLink } from "@/components/mobile/BackLink";
import { apiFetch } from "@/lib/api";
import { validateSpecification } from "@/lib/spec-validate";

const MAX_PHOTOS = 2; // Ảnh hàng + Ảnh vỏ thùng
const MAX_PHOTO_SIZE_MB = 5;

export default function ThukhoNewItemCodePage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [spec, setSpec] = useState("");
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Phase 5.3 — TC_001_001: thêm field "Ảnh hàng / Vỏ thùng"
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch(`${basePath}/api/units`).then(r => r.json()).then(j => { if (j.success) setUnits(j.data || []); }).catch(console.error);
  }, [basePath]);

  // Cleanup blob URLs
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
      setError(`Ảnh phải là JPEG/PNG/WebP, tối đa ${MAX_PHOTO_SIZE_MB}MB và tối đa ${MAX_PHOTOS} ảnh.`);
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
    // TC_001_002: chỉ Tên rút gọn + ĐVT bắt buộc cho luồng tạo nhanh — Mã hàng theo chứng từ
    // optional (BE tự sinh TEMP-* nếu để trống; Kế toán đổi khi chuẩn hóa).
    const missing: string[] = [];
    if (!name.trim()) missing.push("Tên rút gọn");
    if (!unitId) missing.push("Đơn vị tính");
    if (missing.length > 0) {
      setError(`Vui lòng nhập đầy đủ: ${missing.join(", ")}.`);
      return;
    }
    // TC_001_012: Quy cách không hợp lệ → báo lỗi, KHÔNG cho lưu.
    const specError = validateSpecification(spec);
    if (specError) {
      setError(specError);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      // 1. Tạo item code
      const res = await apiFetch(`${basePath}/api/item-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          short_name: name.trim(),
          unit_id: unitId,
          specification: spec.trim(),
          weight_per_box: weight ? parseFloat(weight) : null,
          note: note.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        // Phase 5.3 — TC_001_006: phân biệt rõ mã trùng (409) khỏi lỗi khác
        if (res.status === 409) {
          setError(`⚠️ ${json.error || "Mã hàng đã tồn tại trong hệ thống."}`);
        } else {
          setError(json.error || "Lỗi tạo mã hàng");
        }
        setSubmitting(false);
        return;
      }

      // 2. Upload ảnh (nếu có) — không block success
      const newItemId = json.data?.id;
      if (newItemId && photos.length > 0) {
        await Promise.allSettled(
          photos.map((file) => {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("entity_type", "item_code");
            fd.append("entity_id", newItemId);
            return fetch(`${basePath}/api/attachments`, { method: "POST", body: fd });
          })
        );
      }

      setSuccess(true);
      setCode(""); setName(""); setSpec(""); setWeight(""); setNote("");
      setPhotos([]); setPhotoPreviews([]);
    } catch (e) {
      console.error(e);
      setError("Lỗi kết nối");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      <BackLink href="/thukho">Trang chủ</BackLink>
      <h1 className="text-xl font-bold text-primary flex items-center gap-2">
        <span className="material-symbols-outlined">qr_code_2</span> Tạo mã hàng nhanh
      </h1>
      {success && (
        <div className="p-md bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
          <span className="material-symbols-outlined">check_circle</span>
          Đã tạo mã hàng! Chờ Kế toán chuẩn hóa.
          <button onClick={() => setSuccess(false)} className="ml-auto text-xs font-bold">Tạo thêm</button>
        </div>
      )}
      <div className="industrial-card p-lg rounded-xl bg-surface flex flex-col gap-md">
        <div>
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase">Mã hàng theo chứng từ <span className="text-on-surface-variant/60 normal-case font-normal">(tùy chọn)</span></label>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Để trống nếu chưa có — hệ thống tự sinh" className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white" />
        </div>
        <div>
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase">Tên rút gọn <span className="text-error">*</span></label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Sữa tươi TH 180ml" className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white" />
        </div>
        <div>
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase">Đơn vị tính <span className="text-error">*</span></label>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white">
            <option value="">— Chọn ĐVT —</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase">Quy cách</label>
          <input type="text" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="VD: 24 chai/thùng" className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white" />
        </div>
        <div>
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase">Trọng lượng/thùng (kg)</label>
          <input type="number" step="0.1" min="0" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white" />
        </div>

        {/* Phase 5.3 — TC_001_001: Ảnh hàng / Vỏ thùng */}
        <div>
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase">
            Ảnh hàng / Vỏ thùng ({photos.length}/{MAX_PHOTOS})
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePickPhoto}
            className="block w-full text-xs text-on-surface-variant file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:text-xs file:font-semibold hover:file:bg-primary/20 file:cursor-pointer"
            disabled={photos.length >= MAX_PHOTOS}
          />
          {photoPreviews.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {photoPreviews.map((url, idx) => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-outline-variant">
                  <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full text-xs flex items-center justify-center"
                    aria-label="Xóa ảnh"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase">Ghi chú</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white resize-none" />
        </div>
        {error && (
          <div className="p-sm bg-error-container/20 border border-error/30 rounded-lg text-xs text-error font-semibold">
            {error}
          </div>
        )}
        <button onClick={handleSubmit} disabled={submitting} className="w-full py-3 bg-primary text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
          <span className="material-symbols-outlined">{submitting ? "progress_activity" : "qr_code_2"}</span>
          {submitting ? "Đang tạo..." : "Tạo mã hàng"}
        </button>
      </div>
      <div className="p-sm bg-blue-50 rounded-lg text-[11px] md:text-xs text-blue-700 flex gap-sm items-start">
        <span className="material-symbols-outlined text-sm mt-0.5">info</span>
        <span>Mã hàng tạo bởi Thủ kho sẽ ở trạng thái <strong>Chờ xử lý</strong>. Kế toán sẽ chuẩn hóa trên PC.</span>
      </div>
    </div>
  );
}
