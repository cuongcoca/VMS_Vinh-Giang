"use client";
import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import { useClientPagination, ListPageFooter } from "@/components/ui";
import Link from "next/link";

type LotData = { id: string; qty_box: string; qty_unit?: string; lot: string | null; expiry_date: string | null; days_until_expiry: number | null; urgency: string; item_code: { code: string; short_name: string; units_per_box?: number; unit?: { name: string; symbol: string | null } | null }; pallet: { id: string; code: string; location?: { code: string } | null } };
// UC-INV-04-TC002: SL hiển thị theo đơn vị tính = số thùng × hệ số quy đổi (units_per_box)
const toUnitQty = (d: LotData) => Number(d.qty_box) * (d.item_code.units_per_box || 1);
const unitSym = (d: LotData) => d.item_code.unit?.symbol || d.item_code.unit?.name || "";
const URGENCY = { critical: { label: "🔴 Khẩn", color: "bg-rose-50 text-rose-700", row: "bg-rose-50/30" }, warning: { label: "🟡 Cận", color: "bg-amber-50 text-amber-700", row: "bg-amber-50/20" }, normal: { label: "🟢 OK", color: "bg-emerald-50 text-emerald-700", row: "" } };

export default function ByLotPage() {
  const [data, setData] = useState<LotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "critical" | "warning" | "normal">("all");

  useEffect(() => { fetch("/wms/api/inventory/by-lot").then(r => r.json()).then(r => { if (r.success) setData(r.data); }).catch(console.error).finally(() => setLoading(false)); }, []);

  const summary = useMemo(() => {
    const acc = { critical: { count: 0, qty: 0 }, warning: { count: 0, qty: 0 }, normal: { count: 0, qty: 0 } };
    data.forEach(d => {
      const u = (d.urgency || "normal") as "critical" | "warning" | "normal";
      if (acc[u]) { acc[u].count++; acc[u].qty += toUnitQty(d); }
    });
    return acc;
  }, [data]);

  const filtered = useMemo(() => {
    let rows = data;
    if (urgencyFilter !== "all") rows = rows.filter(d => d.urgency === urgencyFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(d => d.item_code.code.toLowerCase().includes(q) || d.item_code.short_name.toLowerCase().includes(q) || (d.lot || "").toLowerCase().includes(q) || d.pallet.code.toLowerCase().includes(q) || (d.pallet.location?.code || "").toLowerCase().includes(q));
    }
    return rows;
  }, [data, search, urgencyFilter]);

  const exportExcel = () => {
    const headers = ["Mã hàng", "Tên", "Lô", "HSD", "Ngày còn", "SL (ĐVT)", "ĐVT", "SL thùng", "Pallet", "Vị trí", "Cấp"];
    const rows = filtered.map(d => [d.item_code.code, d.item_code.short_name, d.lot || "", d.expiry_date ? new Date(d.expiry_date).toLocaleDateString("vi-VN") : "", d.days_until_expiry ?? "", toUnitQty(d), unitSym(d), Number(d.qty_box), d.pallet.code, d.pallet.location?.code || "", URGENCY[d.urgency as keyof typeof URGENCY]?.label || ""]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `bao-cao-FEFO-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  // Phân trang phía client cho danh sách lô/HSD (FEFO)
  const pg = useClientPagination(filtered, { resetKey: `${search}|${urgencyFilter}` });
  const { paged: pagedRows } = pg;

  return (
    <AppLayout title="TỒN KHO THEO LÔ/HSD">
      <div className="p-6 space-y-5">
        <BackButton fallback="/inventory">Quay lại</BackButton>
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2"><span className="material-symbols-outlined text-[28px]">event</span> Tồn kho theo lô / HSD (FEFO)</h1>
          <button onClick={exportExcel} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 flex items-center gap-2 self-start md:self-auto"><span className="material-symbols-outlined text-[18px]">download</span>Xuất Excel</button>
        </div>

        {/* KPI 3 box urgency */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button onClick={() => setUrgencyFilter(urgencyFilter === "critical" ? "all" : "critical")} className={`text-left bg-rose-50 border ${urgencyFilter === "critical" ? "border-rose-500 ring-2 ring-rose-200" : "border-rose-200"} rounded-xl p-4 hover:shadow-md transition-all`}>
            <div className="flex items-center justify-between"><span className="text-2xl">🔴</span><span className="text-xs font-semibold text-rose-600 uppercase">Khẩn (≤7d)</span></div>
            <div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-bold font-mono text-rose-700">{summary.critical.count}</span><span className="text-xs text-rose-600">lô</span></div>
            <p className="text-xs text-rose-700 mt-1 font-semibold">SL: {summary.critical.qty.toLocaleString("vi-VN")}</p>
          </button>
          <button onClick={() => setUrgencyFilter(urgencyFilter === "warning" ? "all" : "warning")} className={`text-left bg-amber-50 border ${urgencyFilter === "warning" ? "border-amber-500 ring-2 ring-amber-200" : "border-amber-200"} rounded-xl p-4 hover:shadow-md transition-all`}>
            <div className="flex items-center justify-between"><span className="text-2xl">🟡</span><span className="text-xs font-semibold text-amber-600 uppercase">Cận (≤30d)</span></div>
            <div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-bold font-mono text-amber-700">{summary.warning.count}</span><span className="text-xs text-amber-600">lô</span></div>
            <p className="text-xs text-amber-700 mt-1 font-semibold">SL: {summary.warning.qty.toLocaleString("vi-VN")}</p>
          </button>
          <button onClick={() => setUrgencyFilter(urgencyFilter === "normal" ? "all" : "normal")} className={`text-left bg-emerald-50 border ${urgencyFilter === "normal" ? "border-emerald-500 ring-2 ring-emerald-200" : "border-emerald-200"} rounded-xl p-4 hover:shadow-md transition-all`}>
            <div className="flex items-center justify-between"><span className="text-2xl">🟢</span><span className="text-xs font-semibold text-emerald-600 uppercase">An toàn</span></div>
            <div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-bold font-mono text-emerald-700">{summary.normal.count}</span><span className="text-xs text-emerald-600">lô</span></div>
            <p className="text-xs text-emerald-700 mt-1 font-semibold">SL: {summary.normal.qty.toLocaleString("vi-VN")}</p>
          </button>
        </div>

        {/* Search + filter info */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 border border-outline-variant rounded-lg bg-surface-low">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant/70">search</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã hàng / lô / pallet / vị trí..." className="flex-1 bg-transparent py-2 text-sm focus:outline-none" />
          </div>
          {urgencyFilter !== "all" && (<button onClick={() => setUrgencyFilter("all")} className="px-3 py-1.5 bg-surface-low text-on-surface-variant rounded-lg text-xs font-semibold hover:bg-surface-mid flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">close</span>Bỏ filter {URGENCY[urgencyFilter].label}</button>)}
          <span className="text-xs text-on-surface-variant">Hiển thị <b className="text-primary">{filtered.length}</b>/{data.length} dòng</span>
        </div>

        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 900 }}><thead><tr className="bg-surface-low/50 border-b border-outline-variant">
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Mã hàng</th>
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Tên</th>
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden md:table-cell">Lô</th>
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">HSD</th>
            <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Ngày còn</th>
            <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">SL (ĐVT)</th>
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden md:table-cell">Pallet</th>
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden md:table-cell">Vị trí</th>
            <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Cấp</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={9} className="text-center py-12"><span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span></td></tr>
            : filtered.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-on-surface-variant">Không có dữ liệu.</td></tr>
            : pagedRows.map(d => {
              const u = URGENCY[d.urgency as keyof typeof URGENCY] || URGENCY.normal;
              return (
                <tr key={d.id} className={`border-b border-outline-variant/40 hover:bg-surface-low/50 ${u.row}`}>
                  <td className="px-4 py-2.5 font-mono font-bold text-primary text-xs">{d.item_code.code}</td>
                  <td className="px-4 py-2.5 text-sm">{d.item_code.short_name}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-xs text-on-surface-variant">{d.lot || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{d.expiry_date ? new Date(d.expiry_date).toLocaleDateString("vi-VN") : "—"}</td>
                  <td className={`px-4 py-2.5 text-right font-bold text-xs ${d.days_until_expiry !== null && d.days_until_expiry <= 7 ? "text-rose-600" : d.days_until_expiry !== null && d.days_until_expiry <= 30 ? "text-amber-600" : ""}`}>{d.days_until_expiry !== null ? `${d.days_until_expiry}d` : "—"}</td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    <span className="font-semibold">{toUnitQty(d).toLocaleString("vi-VN")}</span>
                    <span className="text-on-surface-variant"> {unitSym(d)}</span>
                    <span className="block text-[10px] text-on-surface-variant/70 font-normal">{Number(d.qty_box).toLocaleString("vi-VN")} thùng</span>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell"><Link href={`/pallets/${d.pallet.id}`} className="font-mono text-xs text-primary hover:underline">{d.pallet.code}</Link></td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-xs">{d.pallet.location?.code ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold"><span className="material-symbols-outlined text-[12px]">place</span>{d.pallet.location.code}</span> : <span className="text-on-surface-variant/70">—</span>}</td>
                  <td className="px-4 py-2.5 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.color}`}>{u.label}</span></td>
                </tr>
              );
            })}
          </tbody></table>
          </div>
          <ListPageFooter {...pg} unit="lô" />
        </div>
      </div>
    </AppLayout>
  );
}
