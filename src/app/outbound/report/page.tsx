"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import { useClientPagination, ListPageFooter } from "@/components/ui";
import Link from "next/link";
import dynamic from "next/dynamic";

// UC-OUT-02: dynamic import recharts để code-split (~150KB gzipped chỉ load khi vào trang)
const ReportCharts = dynamic(() => import("./Charts"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div className="bg-white p-4 rounded-xl border h-[260px] flex items-center justify-center text-on-surface-variant/70 text-sm">Đang tải biểu đồ...</div>
      <div className="bg-white p-4 rounded-xl border h-[260px] flex items-center justify-center text-on-surface-variant/70 text-sm">Đang tải biểu đồ...</div>
    </div>
  ),
});

type ReportItem = { item_code_id?: string; item_code?: string; item_name?: string; group_name?: string | null; total_qty_box: number; pallet_count?: number; avg_per_pallet?: number; supplier_id?: string; supplier_name?: string; total_pallets?: number; total_weight_kg?: number };

export default function OutboundReportPage() {
  const [data, setData] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<"item" | "supplier">("item");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [totalMovements, setTotalMovements] = useState(0);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ group_by: groupBy });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/wms/api/outbound/report?${params.toString()}`);
      const result = await res.json();
      if (result.success) { setData(result.data); setTotalMovements(result.total_movements); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [groupBy, from, to]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Phân trang client-side cho bảng báo cáo (reset khi đổi nhóm/khoảng thời gian)
  const pg = useClientPagination(data, { resetKey: `${groupBy}|${from}|${to}` });
  const { paged: pagedData } = pg;

  return (
    <AppLayout title="BÁO CÁO XUẤT">
      <div className="p-6 space-y-5">
        <BackButton fallback="/outbound">Quay lại</BackButton>
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-[28px]">bar_chart</span> Báo cáo xuất kho
          </h1>
          <button
            type="button"
            onClick={() => {
              const headers = groupBy === "item"
                ? ["Mã hàng", "Tên", "Nhóm", "SL thùng xuất", "Số pallet", "BQ/lần"]
                : ["NCC", "SL thùng", "Pallet", "KG"];
              const rows = data.map(r => groupBy === "item"
                ? [r.item_code || "", r.item_name || "", r.group_name || "", r.total_qty_box, r.pallet_count || 0, r.pallet_count ? (r.total_qty_box / r.pallet_count).toFixed(1) : 0]
                : [r.supplier_name || "", r.total_qty_box, r.total_pallets || 0, Number(r.total_weight_kg || 0).toFixed(1)]
              );
              const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
              const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `bao-cao-xuat-${groupBy}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 flex items-center gap-2 self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>Xuất Excel
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4 flex flex-col sm:flex-row gap-3 items-end">
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Nhóm theo</label>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value as "item" | "supplier")}
              className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-surface-low focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="item">Mã hàng</option>
              <option value="supplier">NCC</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Từ ngày</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Đến ngày</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <span className="text-xs text-on-surface-variant/70 py-2">{totalMovements} lần xuất</span>
        </div>

        {/* UC-OUT-02: 2 chart bar + pie (chỉ hiển thị khi groupBy=item) */}
        {!loading && groupBy === "item" && data.length > 0 && (
          <ReportCharts data={data} />
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead>
                <tr className="bg-surface-low/50 border-b border-outline-variant">
                  {groupBy === "item" ? (
                    <>
                      <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Mã hàng</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tên</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Nhóm</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">SL thùng xuất</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Số pallet</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">BQ/lần</th>
                    </>
                  ) : (
                    <>
                      <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">NCC</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">SL thùng</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Pallet</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">KG</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={groupBy === "item" ? 6 : 4} className="text-center py-12"><span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span></td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={groupBy === "item" ? 6 : 4} className="text-center py-12 text-on-surface-variant">Không có dữ liệu xuất trong khoảng thời gian này.</td></tr>
                ) : pagedData.map((row, i) => (
                  <tr key={i} className="border-b border-outline-variant/40 hover:bg-surface-low/50 transition-colors">
                    {groupBy === "item" ? (
                      <>
                        <td className="px-4 py-2.5 font-mono font-bold text-primary text-sm">{row.item_code}</td>
                        <td className="px-4 py-2.5">{row.item_name}</td>
                        <td className="px-4 py-2.5 text-xs hidden md:table-cell">{row.group_name ? <span className="inline-flex px-1.5 py-0.5 rounded bg-surface-low text-on-surface-variant font-semibold">{row.group_name}</span> : <span className="text-on-surface-variant/70">—</span>}</td>
                        <td className="px-4 py-2.5 text-right font-semibold font-mono">{row.total_qty_box}</td>
                        <td className="px-4 py-2.5 text-right text-on-surface-variant">{row.pallet_count}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-indigo-600 font-semibold">{row.pallet_count ? (row.total_qty_box / row.pallet_count).toFixed(1) : "—"}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 font-semibold">{row.supplier_name}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">{row.total_qty_box}</td>
                        <td className="px-4 py-2.5 text-right">{row.total_pallets}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{Number(row.total_weight_kg || 0).toFixed(1)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPageFooter {...pg} unit="dòng" />
        </div>
      </div>
    </AppLayout>
  );
}
