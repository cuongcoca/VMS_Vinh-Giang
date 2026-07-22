"use client";
import { useToast } from "@/components/ui";
import React, { useState, useEffect, useRef } from "react";

interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  note: string | null;
  created_at: string;
}

interface AttachmentUploadProps {
  entityType: string;
  entityId: string;
}

export function AttachmentUpload({ entityType, entityId }: AttachmentUploadProps) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxNote, setLightboxNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = async () => {
    try {
      const res = await fetch(`/wms/api/attachments?entity_type=${entityType}&entity_id=${entityId}`);
      const data = await res.json();
      if (data.success) setAttachments(data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAttachments(); }, [entityType, entityId]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entity_type", entityType);
      formData.append("entity_id", entityId);

      const res = await fetch("/wms/api/attachments", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        fetchAttachments();
      } else {
        toast.error(data.error || "Lỗi khi upload.");
      }
    } catch { toast.error("Lỗi kết nối."); }
    finally { setUploading(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Xóa ảnh này?")) return;
    try {
      const res = await fetch(`/wms/api/attachments/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) fetchAttachments();
      else toast.error(data.error);
    } catch { toast.error("Lỗi."); }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-on-surface-variant uppercase flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">attach_file</span>
          Ảnh đính kèm ({attachments.length})
        </h4>
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">
              {uploading ? "progress_activity" : "upload"}
            </span>
            {uploading ? "Đang tải..." : "Tải ảnh lên"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <span className="material-symbols-outlined animate-spin text-[20px] text-primary">progress_activity</span>
        </div>
      ) : attachments.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-outline-variant rounded-xl">
          <span className="material-symbols-outlined text-[32px] text-on-surface-variant/50 block mb-1">photo_library</span>
          <p className="text-xs text-on-surface-variant/70">Chưa có ảnh đính kèm.</p>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-xs text-primary hover:underline mt-1"
          >
            Tải ảnh lên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {attachments.map(att => (
            <div key={att.id} className="relative rounded-xl overflow-hidden border border-outline-variant shadow-sm aspect-square">
              <img
                src={`/wms${att.file_url}`}
                alt={att.file_name}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => {
                  setLightboxUrl(`/wms${att.file_url}`);
                  setLightboxNote(att.note || null);
                }}
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDelete(att.id); }}
                className="absolute top-1 right-1 w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center text-lg font-bold shadow z-10 cursor-pointer active:scale-90 transition-transform"
                aria-label="Xóa ảnh"
              >
                ×
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] px-1.5 py-0.5 truncate pointer-events-none">
                {att.note || att.file_name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => {
            setLightboxUrl(null);
            setLightboxNote(null);
          }}
        >
          <div className="relative max-w-4xl max-h-[80vh] flex items-center justify-center">
            <img src={lightboxUrl} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
          {lightboxNote && (
            <div className="mt-4 max-w-lg bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-center text-sm">
              <span className="font-semibold text-primary block mb-0.5 text-xs uppercase tracking-wider">Mô tả</span>
              <p className="break-all">{lightboxNote}</p>
            </div>
          )}
          <button
            className="mt-6 px-6 py-2 bg-white text-black font-semibold rounded-lg shadow hover:bg-neutral-100 transition-colors text-sm"
            onClick={() => {
              setLightboxUrl(null);
              setLightboxNote(null);
            }}
          >
            Đóng
          </button>
        </div>
      )}
    </div>
  );
}
