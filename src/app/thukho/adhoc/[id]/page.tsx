"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { mobileHref } from "@/lib/mobile-href";


type Attachment = { id: string; file_url: string; file_name: string };
type Supplier = { id: string; code: string; name: string } | null;
type InboundTempLine = {
  id: string;
  item_code_id: string;
  qty_box: string | number;
  lot: string | null;
  expiry_date: string | null;
  note: string | null;
  item_code: {
    id: string;
    code: string;
    short_name: string;
    full_name: string | null;
  } | null;
};
type Pallet = {
  id: string;
  code: string;
  status: string;
  total_lines: number;
  total_weight_kg: number;
  created_at: string;
};
type InboundTempDetail = {
  id: string;
  code: string;
  status: string;
  source_type: string | null;
  delivered_by: string | null;
  received_at: string | null;
  reason: string | null;
  reason_detail: string | null;
  note: string | null;
  photo_urls: string[] | null;
  supplier: Supplier;
  created_at: string;
  lines: InboundTempLine[];
  pallets?: Pallet[];
};

const SOURCE_LABEL: Record<string, string> = {
  SUPPLIER: "Nhà cung cấp",
  RETURN: "Hàng trả lại",
  OTHER: "Khác",
};

const REASON_LABEL: Record<string, string> = {
  EARLY: "Hàng về sớm hơn dự kiến",
  NOT_READY: "Chưa kịp lập phiếu",
  UNNOTIFIED_RETURN: "Hàng trả lại không báo trước",
  NEW_SUPPLIER: "NCC mới (chưa khai báo)",
  OTHER: "Khác",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  // TC_TMP_IN_010/_021/_023: hiển thị đủ ngày/tháng/năm + giờ:phút (trước đây thiếu năm → "sai ngày giờ").
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ThukhoAdhocDetailPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<InboundTempDetail | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLightbox, setShowLightbox] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tempRes, attRes] = await Promise.all([
        fetch(`${basePath}/api/inbound-temp/${id}`).then((r) => r.json()),
        fetch(`${basePath}/api/attachments?entity_type=inbound_temp&entity_id=${id}`).then((r) => r.json()),
      ]);
      if (tempRes.success) setData(tempRes.data);
      if (attRes.success) setAttachments(attRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [basePath, id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSendToAccountant = async () => {
    if (!data || sending) return;
    // Hiện tại không có endpoint riêng "send" — phiếu đã ở status PENDING là kế toán có thể nhìn thấy.
    // Chỉ confirm + redirect về danh sách.
    setSending(true);
    setTimeout(() => {
      router.push(mobileHref("/thukho/inbound"));
    }, 400);
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
      </div>
    );
  }

  // Nguồn hiển thị: ưu tiên supplier.name nếu có, không thì label source_type
  const sourceDisplay = data.supplier?.name
    || (data.source_type === "OTHER" ? "Khác" : null)
    || (data.source_type ? SOURCE_LABEL[data.source_type] : null)
    || "Không xác định";

  const reasonDisplay = data.reason ? REASON_LABEL[data.reason] : null;
  const photoCount = attachments.length || (data.photo_urls?.length ?? 0);

  return (
    <div className="flex flex-col">
      {/* Header bar */}
      <div className="bg-primary text-white px-margin-mobile py-3 flex items-center gap-2 shadow-sm">
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
        <h1 className="text-base font-bold flex-1 font-mono tracking-wide">{data.code}</h1>
      </div>

      <div className="px-margin-mobile py-md flex flex-col gap-md">
        {/* Card phiếu — border-left cam */}
        <div className="bg-surface rounded-xl border border-outline-variant border-l-4 border-l-amber-500 p-4 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <span className="font-mono text-sm font-bold text-primary">{data.code}</span>
            <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
              {data.status === "PENDING" ? "Phiếu tạm" :
               data.status === "STANDARDIZED" ? "Đã chuẩn hóa" :
               data.status === "REJECTED" ? "Từ chối" : data.status}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span className="truncate flex-1 pr-2">{sourceDisplay}</span>
            <span className="font-mono shrink-0">{formatDateTime(data.received_at || data.created_at)}</span>
          </div>
          {/* TC_TMP_IN_011/_021/_023: hiển thị rõ tên Nhà cung cấp trong chi tiết phiếu. */}
          {data.supplier?.name && (
            <div className="text-[11px] md:text-xs text-on-surface-variant mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">store</span>
              <span>NCC: {data.supplier.name}</span>
            </div>
          )}
          {reasonDisplay && (
            <div className="text-[11px] md:text-xs text-on-surface-variant mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">flag</span>
              <span>{reasonDisplay}</span>
            </div>
          )}
          {data.delivered_by && (
            <div className="text-[11px] md:text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">local_shipping</span>
              <span>{data.delivered_by}</span>
            </div>
          )}
          {photoCount > 0 && (
            <div className="text-[11px] md:text-xs text-on-surface-variant mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">photo_camera</span>
              <span>{photoCount} ảnh</span>
            </div>
          )}
        </div>

        {/* Ảnh đính kèm — thumbs. Phase 4.1 TC_TMP_IN_010: file_url ở dạng
            relative (/api/uploads/...) → cần prepend basePath để serve đúng
            mount path mobile (/thukho). */}
        {attachments.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {attachments.map((a) => {
              const fullUrl = a.file_url.startsWith("http") || a.file_url.startsWith(basePath)
                ? a.file_url
                : `${basePath}${a.file_url}`;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setShowLightbox(fullUrl)}
                  className="w-[60px] h-[60px] rounded-md overflow-hidden border border-outline-variant active:scale-95 transition-transform"
                >
                  <img src={fullUrl} alt={a.file_name} className="w-full h-full object-cover" />
                </button>
              );
            })}
          </div>
        )}

        {/* Ghi chú (nếu có) */}
        {data.note && (
          <div className="bg-surface-low p-3 rounded-md text-xs text-on-surface-variant">
            <span className="font-bold uppercase text-[11px] md:text-xs block mb-1">Ghi chú</span>
            {data.note}
          </div>
        )}

        {/* Section PALLETS THỰC TẾ */}
        <div>
          <div className="text-[11px] md:text-xs font-bold uppercase text-on-surface-variant mb-2">
            DANH SÁCH PALLET ({data.pallets?.length || 0})
          </div>
          {data.pallets && data.pallets.length > 0 ? (
            <div className="flex flex-col gap-2">
              {data.pallets.map((pallet) => (
                <Link
                  key={pallet.id}
                  href={mobileHref(`/thukho/pallet/${pallet.id}`)}
                  className="bg-surface rounded-xl border border-outline-variant p-3 shadow-sm flex items-center justify-between hover:bg-surface-low transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-amber-500">inventory_2</span>
                    <div>
                      <span className="font-mono text-xs font-bold text-primary">{pallet.code}</span>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">
                        {pallet.total_lines} dòng hàng • {pallet.total_weight_kg || 0} kg
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-surface-low text-on-surface-variant">
                      {pallet.status === "DRAFT" ? "Nháp" :
                       pallet.status === "RECEIVING" ? "Đang thêm" :
                       pallet.status === "COMPLETED" ? "Xong" : pallet.status}
                    </span>
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">chevron_right</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-surface-low/50 rounded-md p-4 text-center text-xs text-on-surface-variant">
              Chưa có pallet nào được tạo cho phiếu này.
            </div>
          )}
        </div>

        {/* Section CHI TIẾT MẶT HÀNG */}
        <div>
          <div className="text-[11px] md:text-xs font-bold uppercase text-on-surface-variant mb-2">
            CHI TIẾT MẶT HÀNG ({data.lines?.length || 0})
          </div>
          {/* Phase 4.1 — TC_TMP_IN_010/_012/_024: render đầy đủ mã hàng, SL,
              lô, HSD, ghi chú thay vì chỉ "Dòng N". */}
          {data.lines && data.lines.length > 0 ? (
            <div className="flex flex-col gap-2">
              {data.lines.map((line, idx) => (
                <div key={line.id} className="bg-surface rounded-xl border border-outline-variant p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-xs font-bold text-primary">
                        {line.item_code?.code || `Dòng ${idx + 1}`}
                      </span>
                      <p className="text-[11px] text-on-surface-variant truncate">
                        {line.item_code?.short_name || line.item_code?.full_name || ""}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-on-surface shrink-0">
                      {Number(line.qty_box || 0)} thùng
                    </span>
                  </div>
                  {(line.lot || line.expiry_date) && (
                    <div className="mt-1 text-[11px] text-on-surface-variant flex gap-2 flex-wrap">
                      {line.lot && (
                        <span>
                          Lô: <span className="font-mono">{line.lot}</span>
                        </span>
                      )}
                      {line.expiry_date && (
                        <span>
                          HSD: {new Date(line.expiry_date).toLocaleDateString("vi-VN")}
                        </span>
                      )}
                    </div>
                  )}
                  {line.note && (
                    <div className="mt-1.5 text-[11px] bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded">
                      <span className="font-bold">Ghi chú:</span> {line.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface-low/50 rounded-md p-4 text-center text-xs text-on-surface-variant">
              Chưa có dòng hàng nào trong phiếu này.
            </div>
          )}
        </div>

        {/* Action buttons */}
        <button
          type="button"
          onClick={() => router.push(mobileHref(`/thukho/pallet/new?temp=${data.id}`))}
          className="w-full py-3 bg-primary text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-lg">add_box</span>
          Tạo pallet mới
        </button>

        <button
          type="button"
          onClick={handleSendToAccountant}
          disabled={sending || data.status !== "PENDING"}
          className="w-full py-3 bg-white border border-outline-variant text-primary rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-surface-low active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {sending ? (
            <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
          ) : (
            <>
              Gửi cho Kế toán xử lý
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </>
          )}
        </button>
      </div>

      {/* Lightbox xem ảnh phóng to */}
      {showLightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowLightbox(null)}
        >
          <img src={showLightbox} alt="Ảnh chứng từ" className="max-w-full max-h-full object-contain" />
          <button
            type="button"
            onClick={() => setShowLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
