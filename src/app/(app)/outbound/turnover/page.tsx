"use client";
import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";
import Link from "next/link";

type TurnoverItem = { item_code_id: string; item_code: string; item_name: string; current_stock: number; qty_out: number; turnover_rate: number };

export default function TurnoverPage() {
  const [data, setData] = useState<TurnoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    setLoading(true);
    fetch(`/wms/api/outbound/turnover?period=${period}`)
      .then(r => r.json())
      .then(r => { if (r.success) setData(r.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  const getRank = (rate: number) => {
    if (rate >= 80) return { label: "🔥 Nhanh", color: "bg-emerald-50 text-emerald-700" };
    if (rate >= 30) return { label: "✅ Trung bình", color: "bg-blue-50 text-blue-700" };
    if (rate > 0) return { label: "⚠️ Chậm", color: "bg-amber-50 text-amber-700" };
    return { label: "❄️ Đóng băng", color: "bg-surface-low text-on-surface-variant" };
  };

  // Phân trang client-side cho danh sách tốc độ luân chuyển (reset theo kỳ thời gian đang chọn)
  const pg = useClientPagination(data, { resetKey: period });
  const { paged: pagedData } = pg;

  return (
    <AppLayout title="TỐC ĐỘ LUÂN CHUYỂN">
      <div className="p-6 space-y-5">
        <BackButton fallback="/outbound">Quay lại</BackButton>
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[28px]">speed</span> Tốc độ luân chuyển
        </h1>
        <p className="text-sm text-on-surface-variant">Tỉ lệ vòng quay = SL xuất / Tồn hiện tại × 100%</p>

        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4 flex items-center gap-3">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Kỳ:</label>
          {["7", "14", "30", "60", "90"].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${period === p ? "bg-primary text-white" : "bg-surface-low text-on-surface-variant hover:bg-surface-mid"}`}>
              {p} ngày
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead>
                <tr className="bg-surface-low/50 border-b border-outline-variant">
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">#</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Mã hàng</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tên</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tồn</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">SL xuất</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">BQ xuất/ngày</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Ngày tồn dự kiến</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Vòng quay</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Xếp hạng</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12"><span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span></td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-on-surface-variant">Không có dữ liệu.</td></tr>
                ) : pagedData.map((row, i) => {
                  const rank = getRank(row.turnover_rate);
                  const periodDays = Number(period) || 30;
                  const avgPerDay = row.qty_out / periodDays;
                  const daysLeft = avgPerDay > 0 ? Math.round(row.current_stock / avgPerDay) : null;
                  return (
                    <tr key={row.item_code_id} className="border-b border-outline-variant/40 hover:bg-surface-low/50 transition-colors">
                      <td className="px-4 py-2.5 text-on-surface-variant/70 text-xs">{pg.from + i}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-primary text-sm">{row.item_code}</td>
                      <td className="px-4 py-2.5">{row.item_name}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{row.current_stock}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">{row.qty_out}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-indigo-600 font-semibold">{avgPerDay.toFixed(1)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-bold ${daysLeft === null ? "text-on-surface-variant/70" : daysLeft <= 7 ? "text-rose-600" : daysLeft <= 30 ? "text-amber-600" : "text-emerald-600"}`}>
                        {daysLeft === null ? "∞" : `${daysLeft}d`}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold font-mono">{row.turnover_rate}%</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${rank.color}`}>{rank.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListPageFooter {...pg} unit="mã hàng" />
        </div>
      </div>
    </AppLayout>
  );
}
