"use client";
import { useToast, useConfirm } from "@/components/ui";

/**
 * UC-INT-02: Component upload nhiều ảnh đính kèm (mobile-friendly với capture="environment").
 *
 * Cách dùng:
 *   <ImageUpload
 *     entityType="INBOUND_TEMP"
 *     entityId={tempId}
 *     maxFiles={10}
 *     onChange={(items) => setAttachments(items)}
 *   />
 *
 * Backend: POST/GET/DELETE /api/attachments — đã có sẵn.
 *   - POST formData: file, entity_type, entity_id, note?
 *   - GET ?entity_type=X&entity_id=Y → list
 *   - DELETE /api/attachments/:id
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

export type AttachmentItem = {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  note?: string | null;
  created_at?: string;
};

type Props = {
  entityType: string;
  entityId: string;
  /** Default 10. Backend cũng đang giới hạn 10 → đặt cao hơn không có tác dụng. */
  maxFiles?: number;
  /** Max MB mỗi file. Default 5 (khớp BE). */
  maxSizeMB?: number;
  /** Gọi khi list thay đổi (sau upload / xóa) */
  onChange?: (items: AttachmentItem[]) => void;
  /** Có cho phép xóa không? Default true */
  allowDelete?: boolean;
  /** Layout: 'grid' hoặc 'inline'. Default 'grid' (mobile-friendly) */
  layout?: "grid" | "inline";
  /** Tự động load list khi mount */
  autoLoad?: boolean;
  /** Override label nút thêm */
  addLabel?: string;
  className?: string;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export function ImageUpload({
  entityType,
  entityId,
  maxFiles = 10,
  maxSizeMB = 5,
  onChange,
  allowDelete = true,
  layout = "grid",
  autoLoad = true,
  addLabel,
  className,
}: Props) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [items, setItems] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [pendingNote, setPendingNote] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewNote, setPreviewNote] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!entityId) return;
    try {
      const r = await fetch(
        `${basePath}/api/attachments?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`,
      );
      const j = await r.json();
      if (j.success) {
        setItems(j.data || []);
        onChange?.(j.data || []);
      }
    } catch (e) {
      console.error("ImageUpload fetchList error:", e);
    } finally {
      setLoadedOnce(true);
    }
  }, [basePath, entityType, entityId, onChange]);

  useEffect(() => {
    if (autoLoad) fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId, autoLoad]);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (e.target) e.target.value = ""; // reset để chọn lại cùng file
    if (!files.length) return;

    setError(null);
    setUploading(true);
    try {
      for (const f of files) {
        if (items.length + 1 > maxFiles) {
          setError(`Tối đa ${maxFiles} ảnh.`);
          break;
        }
        if (f.size > maxSizeMB * 1024 * 1024) {
          setError(`"${f.name}" vượt ${maxSizeMB}MB.`);
          continue;
        }
        const fd = new FormData();
        fd.append("file", f);
        fd.append("entity_type", entityType);
        fd.append("entity_id", entityId);
        if (pendingNote.trim()) {
          fd.append("note", pendingNote.trim());
        }
        const r = await fetch(`${basePath}/api/attachments`, {
          method: "POST",
          body: fd,
        });
        const j = await r.json();
        if (!j.success) {
          setError(j.error || "Upload thất bại.");
          break;
        }
      }
      await fetchList();
      setPendingNote(""); // Clear pending note input on success
    } catch (err) {
      console.error("ImageUpload error:", err);
      setError("Lỗi mạng. Vui lòng thử lại.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (id: string) => {
    const ok = await confirm({ title: "Xóa ảnh", description: "Bạn chắc chắn muốn xóa ảnh này?", confirmText: "Xóa", variant: "danger" });
    if (!ok) return;
    try {
      const r = await fetch(`${basePath}/api/attachments/${id}`, { method: "DELETE" });
      const j = await r.json();
      if (j.success) await fetchList();
      else toast.error(j.error || "Xóa thất bại");
    } catch {
      toast.error("Lỗi mạng.");
    }
  };

  const renderAddTile = () => (
    <label
      className={`relative cursor-pointer aspect-square bg-surface-low border-2 border-dashed border-outline-variant rounded-lg flex flex-col items-center justify-center gap-1 text-on-surface-variant hover:border-primary hover:text-primary transition-colors ${
        uploading ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={handleSelect}
        className="hidden"
        disabled={uploading}
      />
      <span className="material-symbols-outlined text-[28px]">
        {uploading ? "progress_activity" : "add_a_photo"}
      </span>
      <span className="text-[10px] md:text-xs font-semibold">
        {uploading ? "Đang tải..." : addLabel || "Thêm ảnh"}
      </span>
    </label>
  );

  return (
    <div className={className}>
      <div
        className={
          layout === "grid"
            ? "grid grid-cols-4 gap-2"
            : "flex flex-wrap gap-2 items-start"
        }
      >
        {items.map((f) => (
          <div
            key={f.id}
            className="relative aspect-square bg-surface-low rounded-lg overflow-hidden border border-outline-variant group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.file_url.startsWith("http") ? f.file_url : `${basePath}${f.file_url}`}
              alt={f.file_name}
              className="w-full h-full object-cover cursor-pointer active:scale-95 transition-transform"
              loading="lazy"
              onClick={() => {
                setPreviewUrl(f.file_url.startsWith("http") ? f.file_url : `${basePath}${f.file_url}`);
                setPreviewNote(f.note || null);
              }}
            />
            {allowDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent modal preview when deleting
                  handleRemove(f.id);
                }}
                className="absolute top-1 right-1 w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center text-lg font-bold shadow z-10 cursor-pointer active:scale-90 transition-transform"
                aria-label="Xóa ảnh"
              >
                ×
              </button>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[11px] md:text-xs px-1.5 py-0.5 truncate pointer-events-none">
              {f.note || f.file_name}
            </div>
          </div>
        ))}
        {items.length < maxFiles && renderAddTile()}
      </div>

      {/* Note input field (up to 500 characters) */}
      {items.length < maxFiles && (
        <div className="mt-3">
          <textarea
            value={pendingNote}
            onChange={(e) => setPendingNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Nhập mô tả/ghi chú cho ảnh tiếp theo tải lên (tùy chọn, tối đa 500 ký tự)..."
            className="w-full text-xs rounded-lg border border-outline-variant bg-surface px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[11px] md:text-xs text-on-surface-variant">
        <span>
          {loadedOnce ? items.length : "..."} / {maxFiles} ảnh · Tối đa {maxSizeMB}MB/ảnh
        </span>
        {error && <span className="text-rose-600 font-semibold">{error}</span>}
      </div>

      {/* Lightbox Modal Preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-4"
          onClick={() => {
            setPreviewUrl(null);
            setPreviewNote(null);
          }}
        >
          <div className="relative max-w-full max-h-[80vh] flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-full max-h-[80vh] rounded-lg object-contain shadow-2xl"
            />
          </div>
          {previewNote && (
            <div className="mt-4 max-w-lg bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-center text-sm">
              <span className="font-semibold text-primary block mb-0.5 text-xs uppercase tracking-wider">Mô tả</span>
              <p className="break-all">{previewNote}</p>
            </div>
          )}
          <button
            type="button"
            className="mt-6 px-6 py-2.5 bg-white text-black font-semibold rounded-lg shadow hover:bg-neutral-100 active:scale-95 transition-all text-sm cursor-pointer"
            onClick={() => {
              setPreviewUrl(null);
              setPreviewNote(null);
            }}
          >
            Đóng
          </button>
        </div>
      )}
    </div>
  );
}
