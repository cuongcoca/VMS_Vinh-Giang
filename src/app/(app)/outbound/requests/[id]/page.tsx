"use client";
import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";

type Line = {
  id: string; qty_requested: string; qty_shipped: string | null; note: string | null;
  staging_qty?: number; // UC-OUT-05_TC11/13/14: tồn khu chờ (IN_STAGING) theo mã hàng
  qty_reserved?: string | null;     // RC6: SL phiếu này đã giữ chỗ
  reserved_by_others?: number;      // RC6: SL bị phiếu khác giữ chỗ
  available_qty?: number;           // RC6: tồn khả dụng cho phiếu = tồn khu chờ − phiếu khác giữ
  item_code: { id: string; code: string; short_name: string; unit?: { name: string; symbol: string } };
  pallet?: { id: string; code: string; status: string } | null;
};

type Detail = {
  id: string; code: string; status: string;
  customer: string | null; ship_date: string | null;
  note: string | null; created_at: string; shipped_at: string | null;
  lines: Line[];
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Chờ lấy hàng", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  PICKING: { label: "Đang lấy hàng", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  SHIPPED: { label: "Đã xuất kho", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  CANCELLED: { label: "Đã hủy", color: "text-on-surface-variant", bg: "bg-surface-low border-outline-variant" },
};

export default function OutboundRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/wms/api/outbound/requests/${id}`);
      const result = await res.json();
      if (result.success) setData(result.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDetail(); }, [id]);

  const handleAction = async (action: "START_PICKING" | "SHIP" | "CANCEL") => {
    const labels: Record<string, string> = { START_PICKING: "bắt đầu lấy hàng", SHIP: "xuất kho", CANCEL: "hủy" };
    if (!window.confirm(`Xác nhận ${labels[action]} phiếu ${data?.code}?`)) return;
    setActing(true);
    try {
      const res = await fetch(`/wms/api/outbound/requests/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      if (result.success) {
        setToast({ message: result.message, type: "success" });
        fetchDetail();
      } else setToast({ message: result.error, type: "error" });
    } catch { setToast({ message: "Lỗi kết nối.", type: "error" }); }
    finally { setActing(false); setTimeout(() => setToast(null), 4000); }
  };

  if (loading) return <AppLayout title="PYX"><div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span></div></AppLayout>;
  if (!data) return <AppLayout title="PYX"><div className="p-6 text-center text-on-surface-variant">Không tìm thấy phiếu.</div></AppLayout>;

  const st = STATUS_MAP[data.status] || { label: data.status, color: "text-on-surface-variant", bg: "bg-surface-low border-outline-variant" };
  const totalRequested = data.lines.reduce((s, l) => s + Number(l.qty_requested), 0);
  const totalShipped = data.lines.reduce((s, l) => s + Number(l.qty_shipped || 0), 0);

  return (
    <AppLayout title={data.code}>
      <div className="p-6 space-y-5 max-w-6xl">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
            <span className="material-symbols-outlined text-[18px]">{toast.type === "success" ? "check_circle" : "error"}</span>{toast.message}
          </div>
        )}

        <BackButton fallback="/outbound/requests">Quay lại danh sách</BackButton>

        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold font-mono text-primary">{data.code}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${st.bg} ${st.color}`}>{st.label}</span>
              {data.customer && <span className="text-sm text-on-surface-variant">KH: <strong>{data.customer}</strong></span>}
              {data.ship_date && <span className="text-sm text-on-surface-variant">📅 Giao: {new Date(data.ship_date).toLocaleDateString("vi-VN")}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {data.status === "PENDING" && (
              <>
                <button onClick={() => handleAction("START_PICKING")} disabled={acting} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50">
                  <span className="material-symbols-outlined text-[18px]">play_arrow</span>Bắt đầu lấy hàng
                </button>
                <button onClick={() => handleAction("CANCEL")} disabled={acting} className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-lg text-sm font-semibold hover:bg-surface-low flex items-center gap-2 disabled:opacity-50">
                  Hủy phiếu
                </button>
              </>
            )}
            {data.status === "PICKING" && (
              <>
                <button onClick={() => handleAction("SHIP")} disabled={acting} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50">
                  <span className="material-symbols-outlined text-[18px]">local_shipping</span>Xuất kho
                </button>
                <button onClick={() => handleAction("CANCEL")} disabled={acting} className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-lg text-sm font-semibold hover:bg-surface-low flex items-center gap-2 disabled:opacity-50">
                  Hủy phiếu
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status banner */}
        <div className={`rounded-xl p-4 border ${st.bg}`}>
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-[28px] ${st.color}`}>
              {data.status === "SHIPPED" ? "local_shipping" : data.status === "PICKING" ? "downloading" : data.status === "CANCELLED" ? "block" : "schedule"}
            </span>
            <div>
              <p className={`text-sm font-semibold ${st.color}`}>{st.label}</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Tạo: {new Date(data.created_at).toLocaleString("vi-VN")}
                {data.shipped_at && <> · Giao: {new Date(data.shipped_at).toLocaleString("vi-VN")}</>}
              </p>
            </div>
          </div>
        </div>

        {data.note && (
          <div className="bg-surface-low border border-outline-variant rounded-xl p-4 text-sm text-on-surface whitespace-pre-wrap">
            <span className="font-bold text-on-surface-variant">Ghi chú:</span> {data.note}
          </div>
        )}

        {/* Lines */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between">
            <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Dòng hàng ({data.lines.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead className="bg-surface-low/50 border-b border-outline-variant">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant w-10">#</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Mã hàng</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Tên hàng</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden md:table-cell">ĐVT</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">SL yêu cầu</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Khả dụng</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">SL trừ</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Trạng thái</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden md:table-cell">Pallet khu chờ</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l, idx) => {
                  const requested = Number(l.qty_requested);
                  const staging = Number(l.staging_qty ?? 0);
                  const reservedOthers = Number(l.reserved_by_others ?? 0);
                  const available = Number(l.available_qty ?? staging); // RC6: tồn khả dụng cho phiếu (đã trừ giữ chỗ phiếu khác)
                  const shipped = Number(l.qty_shipped || 0);
                  const isShipped = data.status === "SHIPPED";
                  // RC2/RC6: đã xuất kho → theo SL đã xuất; đang lấy → theo tồn KHẢ DỤNG (trừ phần phiếu khác giữ chỗ)
                  const compareQty = isShipped ? shipped : available;
                  const shortage = requested - compareQty; // >0 => thiếu
                  const isMatch = compareQty === requested;
                  const isShort = compareQty < requested;
                  return (
                    <tr key={l.id} className={`border-b border-outline-variant/40 hover:bg-surface-low/50 ${isShort ? "bg-amber-50/30" : ""}`}>
                      <td className="px-4 py-2.5 text-on-surface-variant/70 text-xs font-mono">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-primary text-xs">{l.item_code.code}</td>
                      <td className="px-4 py-2.5">{l.item_code.short_name}</td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-xs text-on-surface-variant">{l.item_code.unit?.symbol || l.item_code.unit?.name || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">{requested}</td>
                      <td className="px-4 py-2.5 text-right font-mono" title={reservedOthers > 0 ? `Tồn khu chờ ${staging}, phiếu khác giữ chỗ ${reservedOthers}` : undefined}>
                        {available}{reservedOthers > 0 && <span className="text-amber-600 text-[10px]"> /{staging}</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono ${shipped > 0 ? "text-emerald-600 font-bold" : "text-on-surface-variant/70"}`}>
                        {shipped > 0 ? shipped : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {isShort ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700" title={`Thiếu ${shortage}`}>⚠ Thiếu {shortage}</span>
                        ) : isShipped ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">✓ Đã xuất đủ</span>
                        ) : isMatch ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">✓ Khớp</span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">✓ Đủ</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-xs">
                        {l.pallet ? <Link href={`/pallets/${l.pallet.id}`} className="font-mono text-primary hover:underline">{l.pallet.code}</Link> : <span className="text-on-surface-variant/70">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-surface-low border-t border-outline-variant px-5 py-3 flex items-center justify-between text-sm font-semibold">
            <span className="text-on-surface-variant">Tổng yêu cầu: <span className="text-primary font-mono text-base">{totalRequested}</span></span>
            <span className="text-on-surface-variant">Tổng đã giao: <span className="text-emerald-700 font-mono text-base">{totalShipped}</span></span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
