"use client";
import React, { useState, useEffect, use } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import Link from "next/link";

type CountEntry = {
  id: string;
  system_qty: string;
  actual_qty: string | null;
  discrepancy: string | null;
  note: string | null;
  counted_at: string | null;
  location?: { id: string; code: string; zone: string } | null;
  item_code?: { id: string; code: string; short_name: string } | null;
  pallet?: { id: string; code: string } | null;
  // UC-INV-06: pallet ngoài hệ thống (khi duyệt sẽ tạo pallet thật)
  is_outside_system?: boolean;
  found_pallet_code?: string | null;
  expiry_actual?: string | null;
  // UC-INV-08-TC02/03/21: chi tiết pallet/lô/HSD tại vị trí (API trả pallet_lines)
  pallet_lines?: Array<{ id: string; qty_box: string; lot: string | null; expiry_date: string | null; pallet: { id: string; code: string } }>;
  adjusted?: boolean;
  adjusted_voucher_code?: string | null;
};

type SessionData = {
  id: string; code: string; type: string; status: string; note: string | null;
  created_at: string;
  counts: CountEntry[];
  activeAdjustment?: { id: string; code: string; status: string } | null;
};

type ResolutionState = Record<string, { action: "accept" | "recount" | null; note: string }>;

export default function DiscrepancyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState<ResolutionState>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetch(`/wms/api/stock-count/${id}`)
      .then(r => r.json())
      .then(r => { if (r.success) setSession(r.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const discrepancies = (session?.counts || []).filter(c => c.discrepancy && Number(c.discrepancy) !== 0);
  const totalDiff = discrepancies.reduce((s, c) => s + Number(c.discrepancy || 0), 0);
  const positiveCount = discrepancies.filter(c => Number(c.discrepancy || 0) > 0).length;
  const negativeCount = discrepancies.filter(c => Number(c.discrepancy || 0) < 0).length;

  const setAction = (countId: string, action: "accept" | "recount") => {
    setResolution(prev => ({ ...prev, [countId]: { action, note: prev[countId]?.note || "" } }));
  };

  const setNote = (countId: string, note: string) => {
    setResolution(prev => ({ ...prev, [countId]: { action: prev[countId]?.action || null, note } }));
  };

  const handleSubmitAll = async () => {
    if (!session) return;
    const toProcess = discrepancies.filter(c => !c.adjusted && resolution[c.id]?.action);
    if (toProcess.length === 0) { setToast({ message: "Chưa chọn xử lý cho dòng nào.", type: "error" }); return; }

    const accepts = toProcess.filter(c => resolution[c.id]?.action === "accept");
    const recounts = toProcess.filter(c => resolution[c.id]?.action === "recount");

    // UC-INV-08-TC16: "Yêu cầu kiểm lại" bắt buộc nhập lý do (ghi chú)
    const recountMissingReason = recounts.filter(c => !resolution[c.id]?.note?.trim());
    if (recountMissingReason.length > 0) {
      setToast({ message: `${recountMissingReason.length} dòng "Kiểm lại" chưa nhập lý do — bắt buộc nhập lý do cho mỗi dòng kiểm lại.`, type: "error" });
      setTimeout(() => setToast(null), 5000);
      return;
    }

    if (!window.confirm(`Xác nhận xử lý ${toProcess.length} dòng:\n- Chấp nhận chênh lệch: ${accepts.length}\n- Yêu cầu kiểm lại: ${recounts.length}\n\nDòng "Chấp nhận" sẽ tạo phiếu điều chỉnh tự động.`)) return;

    setSubmitting(true);
    try {
      if (accepts.length > 0) {
        const res = await fetch("/wms/api/adjustments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "STOCKTAKE_RESOLVE",
            reason_code: "STOCKTAKE",
            stocktake_session_id: id,
            reason: `Xử lý chênh lệch kiểm kê ${session.code} — ${accepts.length} dòng`,
            lines: accepts.map(c => ({
              item_code_id: c.item_code?.id || "",
              location_id: c.location?.id || undefined,
              // UC-INV-06 FIX: dòng pallet NGOÀI HỆ THỐNG phải để pallet_id rỗng.
              // Nếu gán pallet_id của pallet sẵn có cùng mã tại vị trí (pallet_lines[0]),
              // approve sẽ tưởng đã tạo pallet (idempotency guard) và BỎ QUA → tồn không cộng.
              pallet_id: c.is_outside_system
                ? undefined
                : (c.pallet?.id || c.pallet_lines?.[0]?.pallet?.id || undefined),
              qty_before: Number(c.system_qty),
              qty_adjust: Number(c.discrepancy || 0),
              note: resolution[c.id]?.note || `Kiểm kê ${c.location?.code || c.item_code?.code || ""}`,
              // UC-INV-06: nếu là pallet ngoài hệ thống → approve sẽ tạo pallet thật tại vị trí
              is_outside_system: c.is_outside_system || undefined,
              found_pallet_code: c.found_pallet_code || undefined,
              expiry_date: c.expiry_actual || undefined,
            })),
          }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || "Tạo phiếu điều chỉnh thất bại");
      }

      if (recounts.length > 0) {
        const res = await fetch(`/wms/api/stock-count/${id}/recount`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recounts: recounts.map(c => ({
              count_id: c.id,
              note: resolution[c.id]?.note || "",
            })),
          }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || "Yêu cầu kiểm lại thất bại");
      }

      setToast({ 
        message: `Đã xử lý ${toProcess.length} dòng. ${
          accepts.length > 0 ? "Đã tạo phiếu điều chỉnh." : ""
        } ${recounts.length > 0 ? "Đã gửi yêu cầu kiểm lại." : ""}`, 
        type: "success" 
      });
      setTimeout(() => {
        window.location.href = recounts.length > 0 ? `/wms/stock-count/${id}` : "/wms/inventory/adjustments";
      }, 2000);
    } catch (err) {
      setToast({ message: (err as Error).message || "Lỗi.", type: "error" });
    } finally { setSubmitting(false); setTimeout(() => setToast(null), 5000); }
  };

  if (loading) return <AppLayout title="XỬ LÝ CHÊNH LỆCH"><div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span></div></AppLayout>;
  if (!session) return <AppLayout title="XỬ LÝ CHÊNH LỆCH"><div className="p-6 text-center">Không tìm thấy phiên kiểm kê.</div></AppLayout>;

  return (
    <AppLayout title={`CHÊNH LỆCH · ${session.code}`}>
      <div className="p-6 space-y-5">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
            <span className="material-symbols-outlined text-[18px]">{toast.type === "success" ? "check_circle" : "error"}</span>{toast.message}
          </div>
        )}

        <BackButton fallback={`/stock-count/${id}`}>Quay lại phiên kiểm kê</BackButton>

        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[28px]">balance</span>
              Xử lý chênh lệch kiểm kê
            </h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Phiên <span className="font-mono font-bold">{session.code}</span> · {session.type === "BY_LOCATION" ? "theo vị trí" : "theo mã hàng"}
            </p>
          </div>
        </div>

        {session.status === "CLOSED" && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-800 flex items-start gap-2 shadow-sm">
            <span className="material-symbols-outlined text-[18px] text-rose-600 mt-0.5">lock</span>
            <div>
              <p className="font-semibold text-rose-900">Phiên kiểm kê đã đóng</p>
              <p className="text-xs text-rose-700 mt-0.5">Không thể xử lý chênh lệch vì phiên kiểm kê này đã được đóng hoặc đã hoàn tất xử lý.</p>
            </div>
          </div>
        )}

        {session.activeAdjustment && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex items-start gap-2 shadow-sm">
            <span className="material-symbols-outlined text-[18px] text-blue-600 mt-0.5">info</span>
            <div>
              <p className="font-semibold text-blue-900">Phiên kiểm kê đã có phiếu điều chỉnh trước đó</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Đã tồn tại phiếu điều chỉnh <b className="font-mono">{session.activeAdjustment.code}</b> ({session.activeAdjustment.status === "PENDING" ? "Chờ duyệt" : "Đã duyệt"}). Bạn vẫn có thể tiếp tục tạo phiếu điều chỉnh bổ sung cho các dòng chênh lệch khác.
              </p>
            </div>
          </div>
        )}

        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border shadow-sm">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase">Tổng dòng chênh</span>
            <span className="text-2xl font-bold font-mono text-primary mt-1 block">{discrepancies.length}</span>
          </div>
          <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 shadow-sm">
            <span className="text-[10px] font-semibold text-rose-600 uppercase">Thiếu (-)</span>
            <span className="text-2xl font-bold font-mono text-rose-700 mt-1 block">{negativeCount}</span>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm">
            <span className="text-[10px] font-semibold text-emerald-600 uppercase">Thừa (+)</span>
            <span className="text-2xl font-bold font-mono text-emerald-700 mt-1 block">{positiveCount}</span>
          </div>
          <div className={`p-4 rounded-xl border shadow-sm ${totalDiff > 0 ? "bg-emerald-50 border-emerald-200" : totalDiff < 0 ? "bg-rose-50 border-rose-200" : "bg-surface-low border-outline-variant"}`}>
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase">Tổng chênh lệch SL</span>
            <span className={`text-2xl font-bold font-mono mt-1 block ${totalDiff > 0 ? "text-emerald-700" : totalDiff < 0 ? "text-rose-700" : "text-on-surface"}`}>{totalDiff > 0 ? "+" : ""}{totalDiff}</span>
          </div>
        </div>

        {discrepancies.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-10 text-center">
            <span className="material-symbols-outlined text-[48px] text-emerald-600">check_circle</span>
            <h2 className="text-xl font-bold text-emerald-800 mt-3">Không có chênh lệch!</h2>
            <p className="text-sm text-emerald-700 mt-1">Phiên kiểm kê {session.code} không có dòng nào chênh lệch.</p>
            <Link href={`/stock-count/${id}`} className="inline-block mt-4 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700">Về phiên kiểm kê →</Link>
          </div>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <div>
                <p className="font-semibold">Hướng dẫn:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
                  <li><b>Chấp nhận chênh lệch:</b> tự động tạo phiếu điều chỉnh tồn (DCT) — gửi Quản lý duyệt.</li>
                  <li><b>Yêu cầu kiểm lại:</b> đánh dấu cần đếm lại — phiên kiểm kê tiếp tục mở.</li>
                  <li>Các dòng đã lập phiếu điều chỉnh sẽ được <b>khóa tự động</b> và hiển thị mã phiếu tương ứng.</li>
                  <li>Có thể chọn xử lý từng dòng chưa khóa khác nhau, sau đó bấm <b>&quot;Xử lý tất cả&quot;</b> ở dưới.</li>
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 1000 }}>
                  <thead>
                    <tr className="bg-surface-low border-b border-outline-variant">
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-10">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant">Mã hàng · Vị trí · Pallet/Lô/HSD</th>
                      <th className="text-right px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-[100px]">SL hệ thống</th>
                      <th className="text-right px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-[100px]">SL đếm</th>
                      <th className="text-right px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-[100px]">Chênh lệch</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-[200px]">Xử lý</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant min-w-[180px]">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discrepancies.map((c, idx) => {
                      const diff = Number(c.discrepancy || 0);
                      const r = resolution[c.id];
                      const isClosed = session.status === "CLOSED";
                      return (
                        <tr key={c.id} className={`border-b border-outline-variant/40 ${c.adjusted ? "bg-emerald-50/10 text-on-surface/75" : r?.action === "accept" ? "bg-emerald-50/30" : r?.action === "recount" ? "bg-amber-50/30" : ""}`}>
                          <td className="px-4 py-3 text-on-surface-variant/70 font-mono text-xs">{idx + 1}</td>
                          <td className="px-4 py-3">
                            {c.item_code && <div className="font-mono font-bold text-primary text-sm">{c.item_code.code}</div>}
                            {c.item_code?.short_name && <div className="text-xs text-on-surface-variant">{c.item_code.short_name}</div>}
                            {c.location && (
                              <div className="inline-flex items-center gap-0.5 mt-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                                <span className="material-symbols-outlined text-[10px]">place</span>{c.location.code}
                              </div>
                            )}
                            {c.pallet_lines && c.pallet_lines.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {c.pallet_lines.map(pl => (
                                  <div key={pl.id} className="text-[10px] text-on-surface-variant font-mono flex flex-wrap gap-x-2">
                                    <span>📦 {pl.pallet.code}</span>
                                    {pl.lot && <span>Lô {pl.lot}</span>}
                                    {pl.expiry_date && <span>HSD {new Date(pl.expiry_date).toLocaleDateString("vi-VN")}</span>}
                                    <span className="text-on-surface-variant/70">({Number(pl.qty_box)} thùng)</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">{Number(c.system_qty)}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">{c.actual_qty ? Number(c.actual_qty) : "—"}</td>
                          <td className={`px-4 py-3 text-right font-mono font-bold ${diff > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {diff > 0 ? "+" : ""}{diff}
                          </td>
                          <td className="px-4 py-3">
                            {c.adjusted ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-emerald-100/70 text-emerald-800 border border-emerald-200 shadow-sm">
                                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                Đã chấp nhận ({c.adjusted_voucher_code})
                              </div>
                            ) : isClosed ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-rose-50 text-rose-700 border border-rose-200">
                                <span className="material-symbols-outlined text-[14px]">lock</span>
                                Đã đóng
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => setAction(c.id, "accept")}
                                  className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded border transition-all ${r?.action === "accept" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50"}`}
                                >
                                  ✓ Chấp nhận
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAction(c.id, "recount")}
                                  className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded border transition-all ${r?.action === "recount" ? "bg-amber-600 text-white border-amber-600" : "bg-white text-amber-700 border-amber-300 hover:bg-amber-50"}`}
                                >
                                  ↻ Kiểm lại
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {/* UC-INV-08-TC06: hiện ghi chú nhập lúc kiểm kê */}
                            {c.note && (() => {
                              const match = c.note.match(/^(\[Pallet:\s*[^\]]+\])\s*(.*)$/);
                              const cleanNote = match ? match[2].trim() : c.note;
                              return cleanNote ? (
                                <div className="mb-1 text-[11px] text-on-surface-variant bg-surface-low rounded px-2 py-1">
                                  <span className="font-semibold">Ghi chú kiểm kê:</span> {cleanNote}
                                </div>
                              ) : null;
                            })()}
                            <input
                              type="text"
                              value={r?.note || ""}
                              onChange={e => setNote(c.id, e.target.value)}
                              placeholder={c.adjusted ? "Dòng này đã được giải quyết." : isClosed ? "Phiên đã đóng — chỉ xem." : r?.action === "recount" ? "Lý do kiểm lại (bắt buộc)..." : "Ghi chú xử lý..."}
                              disabled={c.adjusted || isClosed}
                              className="w-full px-2 py-1.5 text-xs border border-outline-variant rounded focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-surface-low disabled:text-on-surface-variant/40"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-surface-low border-t border-outline-variant px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="text-sm text-on-surface-variant font-semibold">
                  Đã chọn xử lý: <span className="text-primary font-bold font-mono text-base">{Object.keys(resolution).filter(k => {
                    const c = discrepancies.find(d => d.id === k);
                    return c && !c.adjusted && resolution[k].action;
                  }).length}</span> / {discrepancies.filter(c => !c.adjusted).length} dòng chưa xử lý
                </div>
                <button
                  type="button"
                  onClick={handleSubmitAll}
                  disabled={
                    submitting ||
                    Object.keys(resolution).filter(k => {
                      const c = discrepancies.find(d => d.id === k);
                      return c && !c.adjusted && resolution[k].action;
                    }).length === 0 ||
                    session.status === "CLOSED"
                  }
                  className="px-6 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">{submitting ? "progress_activity" : "task_alt"}</span>
                  {submitting ? "Đang xử lý..." : "Xử lý tất cả"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
