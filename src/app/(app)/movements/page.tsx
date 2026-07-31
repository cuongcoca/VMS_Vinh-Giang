"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";

type Movement = {
  id: string;
  movement_type: string;
  reason: string | null;
  mode: string | null;
  qty_box: string | null;
  lot: string | null;
  expiry_date: string | null;
  performed_at: string;
  performed_by: string | null;
  pallet: { id: string; code: string; status: string };
  from_location: { id: string; code: string; zone: string } | null;
  to_location: { id: string; code: string; zone: string } | null;
  item_code: { id: string; code: string; short_name: string } | null;
  performer: { id: string; full_name: string } | null;
};

const TYPE_MAP: Record<string, { label: string; chip: string }> = {
  PUT_AWAY: { label: "Vào vị trí", chip: "bg-sky-100 text-sky-700 border-sky-200" },
  RELOCATE: { label: "VT → VT", chip: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  STAGE_OUT: { label: "VT → Chờ xuất", chip: "bg-amber-100 text-amber-700 border-amber-200" },
  RETURN: { label: "Chờ xuất → VT", chip: "bg-rose-100 text-rose-700 border-rose-200" },
  SHIP: { label: "Xuất kho", chip: "bg-purple-100 text-purple-700 border-purple-200" },
};

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("vi-VN") : "—";

export default function MovementsPage() {
  const [items, setItems] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (type) params.set("type", type);
      if (debouncedQ) params.set("q", debouncedQ);
      const res = await fetch(`/wms/api/movements?${params.toString()}`);
      const result = await res.json();
      if (result.success) setItems(result.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [from, to, type, debouncedQ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportCSV = () => {
    const header = ["Thời gian", "Loại", "Pallet", "Mã hàng", "Lô/Date", "SL", "Từ", "Đến", "Người"];
    const rows = items.map((m) => [
      new Date(m.performed_at).toLocaleString("vi-VN"),
      TYPE_MAP[m.movement_type]?.label || m.movement_type,
      m.pallet.code,
      m.item_code?.code || "",
      `${m.lot || ""}${m.expiry_date ? " · " + fmtDate(m.expiry_date) : ""}`,
      m.qty_box ? Number(m.qty_box).toString() : "",
      m.from_location?.code || "",
      m.to_location?.code || "",
      m.performer?.full_name || "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lich-su-luan-chuyen-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Phân trang client-side cho danh sách lịch sử luân chuyển
  const pg = useClientPagination(items, { resetKey: `${from}|${to}|${type}|${debouncedQ}` });
  const { paged: pagedItems } = pg;

  return (
    <AppLayout title="LỊCH SỬ LUÂN CHUYỂN">
      <div className="p-6 space-y-5 min-w-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-mono font-bold tracking-wider">UC-FK-06</span>
              Lịch sử luân chuyển
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Báo cáo mọi luân chuyển: Pallet, Mã hàng, Vị trí nguồn/đích, SL, Lô/Date, Người, Thời gian, Loại.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="px-3 py-2 text-sm border border-outline-variant hover:bg-surface-low rounded-lg flex items-center gap-1.5 font-medium text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span> Làm mới
            </button>
            <button
              onClick={exportCSV}
              className="px-3 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 font-semibold shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">download</span> Xuất Excel
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Từ ngày</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Đến ngày</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Loại LC</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="">Tất cả loại LC</option>
              <option value="PUT_AWAY">Vào vị trí</option>
              <option value="RELOCATE">VT → VT</option>
              <option value="STAGE_OUT">VT → Chờ xuất</option>
              <option value="RETURN">Chờ xuất → VT</option>
              <option value="SHIP">Xuất kho</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Tìm kiếm</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
              <input type="text" placeholder="Mã pallet, mã hàng..." value={q} onChange={(e) => setQ(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 1000 }}>
              <thead className="bg-surface-low/60 border-b border-outline-variant">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Thời gian</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Loại</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Pallet</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Mã hàng</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Lô/Date</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">SL</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Từ</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Đến</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Người</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12">
                    <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
                  </td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[40px] opacity-30 block">history</span>
                    <span className="text-sm mt-2 block">Không có lịch sử luân chuyển nào.</span>
                  </td></tr>
                ) : pagedItems.map((m) => {
                  const t = TYPE_MAP[m.movement_type] || { label: m.movement_type, chip: "bg-surface-low text-on-surface-variant border-outline-variant" };
                  return (
                    <tr key={m.id} className="border-b border-outline-variant/40 hover:bg-surface-low/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant whitespace-nowrap">{fmtDateTime(m.performed_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border ${t.chip}`}>
                          {t.label}
                          {m.mode === "PARTIAL" && <span className="ml-1 opacity-70">·split</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/pallets/${m.pallet.id}`} className="font-mono font-semibold text-primary hover:underline">{m.pallet.code}</Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{m.item_code?.code || "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        {m.lot || m.expiry_date ? (
                          <span>
                            {m.lot && <span className="font-mono">{m.lot}</span>}
                            {m.lot && m.expiry_date && " · "}
                            {m.expiry_date && <span className="text-on-surface-variant">{fmtDate(m.expiry_date)}</span>}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{m.qty_box ? Number(m.qty_box) : "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{m.from_location?.code || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{m.to_location?.code || "—"}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">{m.performer?.full_name || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && items.length > 0 && (
            <ListPageFooter {...pg} unit="lượt" />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
