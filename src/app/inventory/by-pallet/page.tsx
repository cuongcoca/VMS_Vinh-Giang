"use client";
import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";
import Link from "next/link";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type PalletRow = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  line_count: number;
  qty_total_original: number;
  qty_total_remaining: number;
  weight_kg: number;
  location_code: string | null;
  location_zone: string | null;
  supplier_name: string | null;
  source_inbound: { id: string; code: string } | null;
};

// Mapping status → label + color (theo mockup UC-INV-03)
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: "Chờ xếp", color: "bg-amber-100 text-amber-800" },
  IN_STORAGE: { label: "Đã xếp", color: "bg-emerald-100 text-emerald-800" },
  IN_STAGING: { label: "Đang di chuyển", color: "bg-blue-100 text-blue-800" },
  PARTIAL_OUT: { label: "Xuất tương đối", color: "bg-cyan-100 text-cyan-800" },
  RELEASED: { label: "Đã xuất", color: "bg-slate-100 text-slate-700" },
};

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "CONFIRMED", label: "Chờ xếp" },
  { value: "IN_STORAGE", label: "Đã xếp" },
  { value: "IN_STAGING", label: "Đang di chuyển / Khu chờ xuất" },
];

const fmtDate = (s: string) => new Date(s).toLocaleDateString("vi-VN");

export default function ByPalletPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [rows, setRows] = useState<PalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (date) params.set("date", date);
    fetch(`${basePath}/api/inventory/by-pallet?${params}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setRows(j.data || []);
        else setError(j.error || "Lỗi tải dữ liệu");
      })
      .catch((e) => setError(e?.message || "Lỗi mạng"))
      .finally(() => setLoading(false));
  }, [basePath, q, status, date]);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [basePath]);

  const exportCSV = () => {
    if (rows.length === 0) return;
    const header = ["Pallet", "Ngày tạo", "Số dòng", "Tổng SL gốc", "Tổng SL còn", "Vị trí", "Trạng thái", "Phiếu nguồn", "NCC", "KG"];
    const csvRows = [
      header,
      ...rows.map((r) => [
        r.code,
        fmtDate(r.created_at),
        String(r.line_count),
        String(r.qty_total_original),
        String(r.qty_total_remaining),
        r.location_code || "—",
        STATUS_MAP[r.status]?.label || r.status,
        r.source_inbound?.code || "—",
        r.supplier_name || "—",
        String(r.weight_kg),
      ]),
    ];
    const csv = "﻿" + csvRows.map((row) => row.map((c) => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ton-pallet-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Phân trang client-side cho danh sách pallet (chỉ ảnh hưởng hiển thị)
  // Hoãn từ khoá tìm kiếm trước khi đưa vào resetKey: nếu dùng giá trị thô thì
  // mỗi ký tự gõ là một lần nhảy về trang 1.
  const debouncedSearch = useDebouncedValue(q);
  const pg = useClientPagination(rows, { resetKey: `${debouncedSearch}|${status}|${date}` });
  const { paged: pagedRows } = pg;

  return (
    <AppLayout title="TỒN KHO THEO PALLET">
      <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
        <BackButton fallback="/inventory">Quay lại</BackButton>
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[28px]">pallet</span>
          Tồn kho theo Pallet
        </h1>

        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-3 flex gap-2 items-center flex-wrap">
          <div className="flex-1 min-w-[240px] relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-[18px]">search</span>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") load(); }}
              placeholder="Mã pallet / mã hàng..."
              className="w-full pl-10 pr-3 py-2 border border-outline-variant rounded-lg text-sm"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white min-w-[180px]"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white"
          />
          <button
            onClick={load}
            disabled={loading}
            className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Đang tải…" : "Lọc"}
          </button>
          <button
            onClick={exportCSV}
            disabled={rows.length === 0}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Excel
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">{error}</div>
        )}

        {/* Counter */}
        <p className="text-sm text-on-surface-variant">
          Tìm thấy <strong className="text-on-surface data-mono">{rows.length}</strong> pallet
        </p>

        {/* Table */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-low/50">
              <tr className="text-left label-caps text-on-surface-variant border-b border-outline-variant">
                <th className="px-3 py-2.5 font-semibold">PALLET</th>
                <th className="px-3 py-2.5 font-semibold">NGÀY TẠO</th>
                <th className="px-3 py-2.5 font-semibold text-right">SỐ DÒNG</th>
                <th className="px-3 py-2.5 font-semibold text-right">TỔNG SL GỐC</th>
                <th className="px-3 py-2.5 font-semibold text-right">TỔNG SL CÒN</th>
                <th className="px-3 py-2.5 font-semibold">VỊ TRÍ</th>
                <th className="px-3 py-2.5 font-semibold">TRẠNG THÁI</th>
                <th className="px-3 py-2.5 font-semibold">PHIẾU NGUỒN</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-on-surface-variant">
                    Không có pallet nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r, i) => {
                  const st = STATUS_MAP[r.status] || { label: r.status, color: "bg-surface-low text-on-surface-variant" };
                  const isMoving = r.status === "IN_STAGING";
                  const isPartialOut = r.qty_total_remaining < r.qty_total_original && r.qty_total_remaining > 0;
                  const visualStatus = isPartialOut && r.status === "IN_STORAGE"
                    ? STATUS_MAP.PARTIAL_OUT
                    : st;
                  return (
                    <tr key={r.id} className={i < pagedRows.length - 1 ? "border-b border-outline-variant/40 hover:bg-surface-low/30" : "hover:bg-surface-low/30"}>
                      <td className="px-3 py-2.5">
                        <Link href={`/pallets/${r.id}`} className="font-mono font-bold text-primary hover:underline">{r.code}</Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-on-surface-variant">{fmtDate(r.created_at)}</td>
                      <td className="px-3 py-2.5 text-right data-mono">{r.line_count}</td>
                      <td className="px-3 py-2.5 text-right data-mono">{r.qty_total_original}</td>
                      <td className={`px-3 py-2.5 text-right data-mono font-semibold ${isPartialOut ? "text-cyan-700" : ""}`}>
                        {r.qty_total_remaining}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {isMoving && r.location_code ? (
                          <span className="text-blue-700">→ {r.location_code}</span>
                        ) : (
                          r.location_code || "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${visualStatus.color}`}>
                          {visualStatus.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {r.source_inbound ? (
                          <Link href={`/inbound/${r.source_inbound.id}`} className="text-primary hover:underline">
                            {r.source_inbound.code}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link href={`/pallets/${r.id}`} className="text-on-surface-variant hover:text-primary">
                          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <ListPageFooter {...pg} unit="pallet" />
        </div>
      </div>
    </AppLayout>
  );
}
