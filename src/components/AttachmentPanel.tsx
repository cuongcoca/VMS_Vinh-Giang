"use client";

import React, { useState, useEffect, useRef } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  note: string | null;
  created_at: string;
}

interface AttachmentPanelProps {
  /** Type of entity: "INBOUND", "PALLET", "ADJUSTMENT", etc. */
  entityType: string;
  /** ID of the entity */
  entityId: string;
  /** Whether to allow uploads (default: true) */
  readOnly?: boolean;
}

/**
 * UC-INT-02: Chụp ảnh đính kèm chứng từ
 * Reusable panel for viewing and uploading image attachments.
 * Max 10 files, max 5MB each, JPEG/PNG/WebP/GIF only.
 */
export default function AttachmentPanel({ entityType, entityId, readOnly = false }: AttachmentPanelProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = async () => {
    try {
      const res = await fetch(`${basePath}/api/attachments?entity_type=${entityType}&entity_id=${entityId}`);
      const result = await res.json();
      if (result.success) setAttachments(result.data);
    } catch (err) {
      console.error("Fetch attachments error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entityId) fetchAttachments();
  }, [entityId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: "File quá lớn (tối đa 5MB).", type: "error" });
      setTimeout(() => setToast(null), 4000);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setToast({ message: "Chỉ chấp nhận ảnh JPEG, PNG, WebP, GIF.", type: "error" });
      setTimeout(() => setToast(null), 4000);
      return;
    }
    if (attachments.length >= 10) {
      setToast({ message: "Tối đa 10 ảnh mỗi phiếu.", type: "error" });
      setTimeout(() => setToast(null), 4000);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entity_type", entityType);
      formData.append("entity_id", entityId);
      if (note.trim()) formData.append("note", note.trim());

      const res = await fetch(`${basePath}/api/attachments`, {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (result.success) {
        setNote("");
        fetchAttachments();
        setToast({ message: "Upload thành công!", type: "success" });
      } else {
        setToast({ message: result.error || "Lỗi upload.", type: "error" });
      }
    } catch {
      setToast({ message: "Lỗi kết nối.", type: "error" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa ảnh đính kèm này?")) return;
    try {
      const res = await fetch(`${basePath}/api/attachments/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) fetchAttachments();
      else setToast({ message: result.error || "Lỗi.", type: "error" });
    } catch {
      setToast({ message: "Lỗi kết nối.", type: "error" });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-xl border border-outline-variant p-5 shadow-sm">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
          <span className="material-symbols-outlined text-[18px]">{toast.type === "success" ? "check_circle" : "error"}</span>{toast.message}
        </div>
      )}

      {/* Header */}
      <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-secondary">photo_library</span>
        Ảnh đính kèm ({attachments.length}/10)
      </h3>

      {/* Upload Area */}
      {!readOnly && attachments.length < 10 && (
        <div className="mb-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Mô tả ảnh (tuỳ chọn)..."
              className="flex-1 px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <label className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors ${uploading ? "bg-surface-low text-on-surface-variant/70" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>
              <span className="material-symbols-outlined text-[18px]">{uploading ? "progress_activity" : "add_photo_alternate"}</span>
              {uploading ? "Đang tải..." : "Chọn ảnh"}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-[10px] text-on-surface-variant/70">JPEG, PNG, WebP, GIF · Tối đa 5MB/ảnh · Tối đa 10 ảnh</p>
        </div>
      )}

      {/* Attachments Grid */}
      {loading ? (
        <div className="flex justify-center py-6">
          <span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span>
        </div>
      ) : attachments.length === 0 ? (
        <div className="text-center py-6 text-on-surface-variant">
          <span className="material-symbols-outlined text-[36px] opacity-30">photo_camera</span>
          <p className="mt-2 text-sm">Chưa có ảnh đính kèm.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {attachments.map(a => (
            <div key={a.id} className="group relative rounded-lg overflow-hidden border border-outline-variant hover:border-primary/30 transition-colors">
              <img
                src={`${basePath}${a.file_url}`}
                alt={a.note || a.file_name}
                className="w-full h-24 object-cover cursor-pointer"
                onClick={() => setPreview(a.file_url)}
              />
              <div className="p-2">
                <p className="text-[10px] font-semibold text-on-surface truncate">{a.note || a.file_name}</p>
                <p className="text-[9px] text-on-surface-variant/70">{formatSize(a.file_size)} · {new Date(a.created_at).toLocaleDateString("vi-VN")}</p>
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleDelete(a.id)}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600"
                  title="Xóa"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preview Lightbox */}
      {preview && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center" onClick={() => setPreview(null)}>
          <img src={`${basePath}${preview}`} alt="Preview" className="max-w-[90vw] max-h-[85vh] rounded-xl shadow-2xl" />
          <button onClick={() => setPreview(null)} className="absolute top-4 right-4 w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/30">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
