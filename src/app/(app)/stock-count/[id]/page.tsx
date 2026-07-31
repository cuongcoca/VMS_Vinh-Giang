"use client";
import React, { useState, useEffect, use } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import Link from "next/link";

type CountEntry = { id: string; system_qty: string; actual_qty: string | null; discrepancy: string | null; note: string | null; counted_at: string | null; location?: { code: string; zone: string; type?: string } | null; item_code?: { code: string; short_name: string } | null; lot_actual?: string | null; expiry_actual?: string | null };
type SessionData = { id: string; code: string; type: string; status: string; note: string | null; created_at: string; counts: CountEntry[] };
type StatsExtended = {
  totalCounts: number;
  counted: number;
  discrepancies: number;
  systemQtyTotal: number;
  actualQtyTotal: number;
  discrepancyTotal: number;
  progressPct: number;
};

export default function StockCountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionData | null>(null);
  const [stats, setStats] = useState<StatsExtended>({
    totalCounts: 0,
    counted: 0,
    discrepancies: 0,
    systemQtyTotal: 0,
    actualQtyTotal: 0,
    discrepancyTotal: 0,
    progressPct: 0,
  });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const parseNote = (note: string | null) => {
    if (!note) return { prefix: "", cleanNote: "" };
    const match = note.match(/^(\[Pallet:\s*[^\]]+\])\s*(.*)$/);
    if (match) {
      return { prefix: match[1], cleanNote: match[2] };
    }
    return { prefix: "", cleanNote: note };
  };

  const fetchSession = async () => {
    try {
      const res = await fetch(`/wms/api/stock-count/${id}`);
      const result = await res.json();
      if (result.success) { setSession(result.data); setStats(result.stats); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };
  useEffect(() => { fetchSession(); }, [id]);

  const handleSaveCount = async (countId: string) => {
    setSaving(true);
    try {
      const original = session?.counts.find(c => c.id === countId);
      const { prefix } = parseNote(original?.note || null);
      const finalNote = prefix ? `${prefix} ${editNote}`.trim() : editNote;
      const res = await fetch(`/wms/api/stock-count/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count_id: countId, actual_qty: Number(editQty), note: finalNote }),
      });
      const result = await res.json();
      if (result.success) { setEditingId(null); fetchSession(); }
      else setToast({ message: result.error, type: "error" });
    } catch { setToast({ message: "Lỗi.", type: "error" }); }
    finally { setSaving(false); setTimeout(() => setToast(null), 4000); }
  };

  const handleComplete = async () => {
    if (!confirm("Hoàn tất phiên kiểm kê?")) return;
    try {
      const res = await fetch(`/wms/api/stock-count/${id}/complete`, { method: "POST" });
      const result = await res.json();
      if (result.success) { setToast({ message: result.message, type: "success" }); fetchSession(); }
      else setToast({ message: result.error, type: "error" });
    } catch { setToast({ message: "Lỗi.", type: "error" }); }
    finally { setTimeout(() => setToast(null), 4000); }
  };

  if (loading) return <AppLayout title="KIỂM KÊ"><div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span></div></AppLayout>;
  if (!session) return <AppLayout title="KIỂM KÊ"><div className="p-6 text-center text-on-surface-variant">Không tìm thấy phiên kiểm kê.</div></AppLayout>;

  const canEdit = session.status === "OPEN" || session.status === "COUNTING";

  return (
    <AppLayout title={session.code}>
      <div className="p-6 space-y-5">
        {toast && <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}><span className="material-symbols-outlined text-[18px]">{toast.type === "success" ? "check_circle" : "error"}</span>{toast.message}</div>}
        <BackButton fallback="/stock-count">Quay lại</BackButton>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-primary font-mono flex items-center gap-2">
              {session.type === "BY_ITEM" && <span className="material-symbols-outlined text-[26px]">search</span>}
              {session.code}
            </h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {session.type === "BY_LOCATION" ? "📍 Kiểm kê theo vị trí" : "🔍 Kiểm kê theo Mã hàng"}
              {session.type === "BY_ITEM" && session.counts[0]?.item_code && (
                <span className="ml-1"> — <b className="text-primary">{session.counts[0].item_code.code}</b> ({session.counts[0].item_code.short_name})</span>
              )}
              {" · "}{new Date(session.created_at).toLocaleDateString("vi-VN")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* UC-INV-08-TC14: chỉ cho xử lý chênh lệch khi phiên đã hoàn tất đếm (không còn OPEN/COUNTING) */}
            {stats.discrepancies > 0 && !canEdit && (
              <Link href={`/stock-count/${id}/discrepancy`} className="px-4 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 flex items-center gap-2 shadow-sm">
                <span className="material-symbols-outlined text-[18px]">balance</span>
                Xử lý chênh lệch ({stats.discrepancies})
              </Link>
            )}
            {stats.discrepancies > 0 && canEdit && (
              <span className="px-4 py-2.5 bg-surface-low text-on-surface-variant rounded-lg text-sm font-semibold flex items-center gap-2" title="Cần bấm Hoàn tất để khóa phiên trước khi xử lý chênh lệch">
                <span className="material-symbols-outlined text-[18px]">lock</span>
                Chênh lệch ({stats.discrepancies}) — hoàn tất trước
              </span>
            )}
            {canEdit && stats.counted === stats.totalCounts && stats.totalCounts > 0 && (
              <button onClick={handleComplete} className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">check_circle</span> Hoàn tất</button>
            )}
          </div>
        </div>

        {/* UC-INV-07: 4 KPI tổng — SL HT / SL TT / Chênh lệch / Tiến độ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border shadow-sm">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase">SL hệ thống</span>
            <span className="text-xl font-bold mt-1 block font-mono">{stats.systemQtyTotal.toLocaleString()}</span>
            <span className="text-[10px] text-on-surface-variant/70">{stats.totalCounts} mục</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border shadow-sm">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase">SL thực tế</span>
            <span className={`text-xl font-bold mt-1 block font-mono ${stats.actualQtyTotal !== stats.systemQtyTotal ? "text-amber-600" : "text-emerald-600"}`}>
              {stats.actualQtyTotal.toLocaleString()}
            </span>
            <span className="text-[10px] text-on-surface-variant/70">{stats.counted}/{stats.totalCounts} đã đếm</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border shadow-sm" style={stats.discrepancyTotal !== 0 ? { borderLeftWidth: 4, borderLeftColor: "rgb(244 63 94)" } : {}}>
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase">Chênh lệch</span>
            <span className={`text-xl font-bold mt-1 block font-mono ${stats.discrepancyTotal > 0 ? "text-emerald-600" : stats.discrepancyTotal < 0 ? "text-rose-600" : "text-on-surface-variant"}`}>
              {stats.discrepancyTotal > 0 ? `+${stats.discrepancyTotal}` : stats.discrepancyTotal}
            </span>
            <span className="text-[10px] text-on-surface-variant/70">
              {stats.discrepancies > 0 ? `${stats.discrepancies} dòng có chênh` : "Tất cả khớp"}
            </span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border shadow-sm">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase">Tiến độ</span>
            <span className="text-xl font-bold mt-1 block">{stats.counted}/{stats.totalCounts}</span>
            <div className="mt-1 h-1.5 bg-surface-low rounded-full overflow-hidden">
              <div
                className={`h-full ${stats.progressPct === 100 ? "bg-emerald-500" : "bg-primary"}`}
                style={{ width: `${stats.progressPct}%` }}
              />
            </div>
            <span className="text-[10px] text-on-surface-variant/70 mt-0.5 block">{stats.progressPct}% vị trí</span>
          </div>
        </div>

        {/* UC-INV-07: Bắt buộc bao gồm cả khu xuất tương đối khi kiểm kê theo mã */}
        {session.type === "BY_ITEM" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] mt-0.5">info</span>
            <span><b>Bắt buộc:</b> Khi kiểm kê theo mã hàng PHẢI bao gồm cả khu xuất tương đối (staging-out), nếu không tổng SL thực tế sẽ sai. Hàng nền vàng = đang ở khu chờ xuất.</span>
          </div>
        )}

        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm"><thead><tr className="bg-surface-low/50 border-b border-outline-variant">
              <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Vị trí</th>
              <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Mã hàng</th>
              <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">SL HT</th>
              <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">SL TT</th>
              <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Chênh</th>
              <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Trạng thái</th>
              <th className="text-right px-4 py-2.5"></th>
            </tr></thead>
            <tbody>
              {session.counts.map(c => {
                const disc = c.discrepancy !== null ? Number(c.discrepancy) : null;
                const isEditing = editingId === c.id;
                // UC-INV-07: highlight STAGING-OUT (location code chứa "STAGING" hoặc "CHO-XUAT")
                const locCode = c.location?.code || "";
                const isStagingOut = 
                  c.location?.type === "OUTBOUND_STAGING" || 
                  c.location?.zone === "STAGING_OUT" || 
                  /STAGING|CHO[_-]XUAT|CHỜ XUẤT|STG-OUT|STG_OUT/i.test(locCode);
                const rowBg = isStagingOut ? "bg-amber-50" : (disc !== null && disc !== 0 ? "bg-rose-50/50" : "");
                return (
                  <tr key={c.id} className={`border-b border-outline-variant/40 ${rowBg}`}>
                    <td className="px-4 py-2.5 font-mono font-bold text-sm">
                      {isStagingOut ? (
                        <span className="text-amber-700">⚠ {locCode || "STAGING-OUT"}</span>
                      ) : (
                        <span className="text-primary">{locCode || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-on-surface-variant text-xs">
                      {c.item_code ? <><b className="text-primary">{c.item_code.code}</b> · {c.item_code.short_name}</> : "—"}
                      {(() => {
                        const { prefix } = parseNote(c.note);
                        const palletCode = prefix ? prefix.replace(/^\[Pallet:\s*/i, "").replace(/\]$/, "") : "";
                        return (
                          <>
                            {palletCode && <div className="text-[10px] text-indigo-700 font-mono mt-0.5 font-semibold">📦 {palletCode}</div>}
                            {c.lot_actual && <div className="text-[10px] text-on-surface-variant font-mono mt-0.5">Lô: {c.lot_actual}</div>}
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{Number(c.system_qty)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <input type="number" step="0.01" value={editQty} onChange={e => setEditQty(e.target.value)} autoFocus className="w-20 px-2 py-1 text-right text-sm border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      ) : (
                        <span className={`font-mono font-semibold ${c.actual_qty !== null ? "" : "text-on-surface-variant/50"}`}>{c.actual_qty !== null ? Number(c.actual_qty) : "—"}</span>
                      )}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-bold ${disc !== null && disc > 0 ? "text-emerald-600" : disc !== null && disc < 0 ? "text-rose-600" : "text-on-surface-variant/50"}`}>
                      {disc !== null ? (disc > 0 ? `+${disc}` : disc) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {c.actual_qty === null ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-low text-on-surface-variant">Chưa đếm</span>
                      ) : disc === 0 ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">Khớp</span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">Có chênh</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {canEdit && (isEditing ? (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => handleSaveCount(c.id)} disabled={saving} className="px-2 py-1 bg-primary text-white rounded text-xs font-semibold">Lưu</button>
                          <button onClick={() => setEditingId(null)} className="px-2 py-1 bg-surface-mid rounded text-xs">Hủy</button>
                        </div>
                      ) : (
                        <button onClick={() => { const { cleanNote } = parseNote(c.note); setEditingId(c.id); setEditQty(c.actual_qty !== null ? String(Number(c.actual_qty)) : ""); setEditNote(cleanNote); }} className="p-1 rounded hover:bg-primary/10 text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody></table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
