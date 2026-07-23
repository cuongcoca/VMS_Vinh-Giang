"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { ExcelExport } from "@/components/ExcelExport";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";
import { auth, type AuthUser } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";

type StagingPallet = {
  id: string; code: string; total_weight_kg: string; updated_at: string;
  parent_pallet_id: string | null;
  split_seq: number | null;
  supplier: { name: string } | null;
  location: { code: string } | null;
  parent: { id: string; code: string; location: { code: string } | null } | null;
  lines: { id: string; qty_box: string; lot: string | null; expiry_date: string | null; item_code: { code: string; short_name: string } }[];
};

export default function OutboundPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pallets, setPallets] = useState<StagingPallet[]>([]);
  const [summary, setSummary] = useState({
    total_pallets: 0,
    total_distinct_items: 0,
    total_qty_box: 0,
    overdue_24h_count: 0,
    // Backward-compat
    total_weight_kg: 0,
    nearest_expiry: null as string | null,
    split_count: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStaging = async () => {
    try {
      setLoading(true);
      const res = await fetch("/wms/api/outbound/staging");
      const result = await res.json();
      if (result.success) { setPallets(result.data); setSummary(result.summary); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };
  useEffect(() => {
    setUser(auth.getUser());
    fetchStaging();
  }, []);

  // UC-OUT-05_TC09: DEMO xuất kho — pallet rời Khu chờ xuất → RELEASED → tồn kho trừ.
  const handleRelease = async (palletId: string, code: string) => {
    if (!window.confirm(`Xuất kho pallet ${code}?\nHàng sẽ rời kho và tồn kho trừ tương ứng. ⚠ Đây là xuất lẻ pallet, KHÔNG cập nhật phiếu yêu cầu xuất (PYX). Nếu pallet thuộc một phiếu, hãy xuất qua phiếu PYX.`)) return;
    try {
      const res = await fetch("/wms/api/outbound/release", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.getToken() ?? ""}` },
        body: JSON.stringify({ pallet_id: palletId }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) { alert(result.error || "Xuất kho thất bại."); return; }
      fetchStaging();
      alert(result.message || "Đã xuất kho.");
    } catch { alert("Lỗi kết nối mạng."); }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("vi-VN") : "—";
  const getWaitTime = (updatedAt: string) => {
    const diff = Date.now() - new Date(updatedAt).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return `${Math.floor(diff / 60000)}p`;
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  // Phân trang client-side cho danh sách pallet khu chờ xuất (chỉ ảnh hưởng hiển thị)
  const pg = useClientPagination(pallets, { initialLimit: 10 });
  const { paged: pagedPallets } = pg;

  return (
    <AppLayout title="XUẤT KHO">
      <div className="p-6 space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">Xuất kho</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">Khu chờ xuất & quản lý outbound</p>
          </div>
        </div>

        {/* Nav cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/outbound", icon: "output", label: "Khu chờ xuất", count: summary.total_pallets, active: true, color: "text-amber-600 bg-amber-50" },
            { href: "/outbound/rebalance", icon: "balance", label: "Cân lại tồn", color: "text-blue-600 bg-blue-50" },
            { href: "/outbound/report", icon: "bar_chart", label: "Báo cáo xuất", color: "text-emerald-600 bg-emerald-50" },
            { href: "/outbound/turnover", icon: "speed", label: "Tốc độ luân chuyển", color: "text-indigo-600 bg-indigo-50" },
          ]
            .filter((nav) => !user?.role || canAccess(user.role, nav.href))
            .map((nav) => (
            <Link key={nav.href} href={nav.href}
              className={`p-4 rounded-xl border shadow-sm flex items-center gap-3 transition-all hover:shadow-md ${nav.active ? "border-primary ring-2 ring-primary/10" : "border-outline-variant"}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${nav.color}`}>
                <span className="material-symbols-outlined text-[20px]">{nav.icon}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">{nav.label}</p>
                {nav.count !== undefined && <p className="text-xs text-on-surface-variant">{nav.count} pallet</p>}
              </div>
            </Link>
          ))}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-outline-variant shadow-sm">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Tổng pallet</span>
            <span className="text-xl font-bold mt-1 block text-on-surface">{summary.total_pallets}</span>
            {summary.split_count > 0 && (
              <span className="text-[10px] text-violet-700 font-semibold mt-0.5 inline-flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[12px]">call_split</span>
                {summary.split_count} split
              </span>
            )}
          </div>
          {/* Phase 7.1 — TC04: thay Tổng KG + HSD gần nhất bằng Tổng mã + Quá 24H */}
          <div className="bg-white p-3.5 rounded-xl border border-outline-variant shadow-sm">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Tổng mã</span>
            <span className="text-xl font-bold mt-1 block text-primary font-mono">{summary.total_distinct_items}</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-outline-variant shadow-sm">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Tổng SL thùng</span>
            <span className="text-xl font-bold mt-1 block text-amber-600 font-mono">{summary.total_qty_box}</span>
          </div>
          <div className={`bg-white p-3.5 rounded-xl border shadow-sm ${
            summary.overdue_24h_count > 0 ? "border-rose-300" : "border-outline-variant"
          }`}>
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Quá 24H</span>
            <span className={`text-xl font-bold mt-1 block font-mono ${
              summary.overdue_24h_count > 0 ? "text-rose-600" : "text-on-surface"
            }`}>{summary.overdue_24h_count}</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between">
            <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-amber-600">output</span>
              Pallet khu chờ xuất
            </h3>
            <div className="flex items-center gap-2">
              {/* UC-OUT-01_TC12: Xuất Excel danh sách Khu chờ xuất */}
              <ExcelExport
                data={pallets as unknown as Record<string, unknown>[]}
                filename="khu-cho-xuat"
                columns={[
                  { key: "code", header: "Pallet" },
                  { key: "lines", header: "Hàng hóa", transform: (v) => [...new Set((v as { item_code: { short_name: string } }[]).map((l) => l.item_code.short_name))].join(", ") },
                  { key: "lines", header: "Lô", transform: (v) => [...new Set((v as { lot: string | null }[]).map((l) => l.lot).filter(Boolean))].join(", ") },
                  { key: "lines", header: "SL (thùng)", transform: (v) => (v as { qty_box: string }[]).reduce((s, l) => s + Number(l.qty_box), 0) },
                  { key: "lines", header: "HSD sớm nhất", transform: (v) => { const e = (v as { expiry_date: string | null }[]).filter((l) => l.expiry_date).sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime())[0]?.expiry_date; return e ? new Date(e).toLocaleDateString("vi-VN") : ""; } },
                  { key: "updated_at", header: "Vào khu chờ", transform: (v) => v ? new Date(v as string).toLocaleString("vi-VN") : "" },
                ]}
              />
              <button onClick={fetchStaging} className="p-1.5 rounded-lg hover:bg-surface-low"><span className="material-symbols-outlined text-[18px]">refresh</span></button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 600 }}>
              <thead>
                <tr className="bg-surface-low/50 border-b border-outline-variant">
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Pallet</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Hàng hóa</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">SL</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Lô</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">HSD sớm nhất</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Vào khu chờ / Chờ</th>
                  <th className="text-right px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12"><span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span></td></tr>
                ) : pallets.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[40px] opacity-30">check_circle</span>
                    <p className="mt-2 text-sm">Khu chờ xuất trống.</p>
                  </td></tr>
                ) : pagedPallets.map(p => {
                  const totalQty = p.lines.reduce((s, l) => s + Number(l.qty_box), 0);
                  const itemNames = [...new Set(p.lines.map(l => `[${l.item_code.code}] ${l.item_code.short_name}`))].join(", ");
                  const earliestExpiry = p.lines.filter(l => l.expiry_date).sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime())[0]?.expiry_date;
                  // UC-OUT-01_TC05: hiển thị Lô (gộp các lô distinct trên pallet)
                  const lots = [...new Set(p.lines.map(l => l.lot).filter(Boolean))].join(", ");
                  // UC-OUT-01_TC09: cảnh báo HSD gần hết hạn (màu/icon/text)
                  const expDays = earliestExpiry ? Math.ceil((new Date(earliestExpiry).getTime() - Date.now()) / 86400000) : null;
                  const expClass = expDays === null ? "" : expDays < 0 ? "text-rose-700 font-bold" : expDays <= 7 ? "text-rose-600 font-semibold" : expDays <= 30 ? "text-amber-600 font-semibold" : "";
                  return (
                    <tr key={p.id} className="border-b border-outline-variant/40 hover:bg-surface-low/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/pallets/${p.id}`} className="font-mono font-bold text-primary hover:underline">{p.code}</Link>
                          {p.location && <span className="text-xs text-on-surface-variant/70">{p.location.code}</span>}
                          {p.parent && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200"
                              title={`Split từ pallet ${p.parent.code}${p.parent.location ? ` (vị trí ${p.parent.location.code})` : ""}`}
                            >
                              <span className="material-symbols-outlined text-[12px]">call_split</span>
                              Split #{p.split_seq} · {p.parent.code}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant text-xs max-w-[200px] truncate">{itemNames || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{totalQty}</td>
                      <td className="px-4 py-3 text-xs font-mono hidden md:table-cell">{lots || "—"}</td>
                      <td className="px-4 py-3 text-xs hidden md:table-cell">
                        {earliestExpiry ? (
                          <span className={`inline-flex items-center gap-1 ${expClass}`}>
                            {expDays !== null && expDays <= 30 && (
                              <span className="material-symbols-outlined text-[14px]">{expDays < 0 ? "dangerous" : "warning"}</span>
                            )}
                            {formatDate(earliestExpiry)}
                            {expDays !== null && expDays <= 30 && (
                              <span className="text-[10px]">({expDays < 0 ? "quá hạn" : `≤${expDays <= 7 ? 7 : 30} ngày`})</span>
                            )}
                          </span>
                        ) : "—"}
                      </td>
                      {/* UC-OUT-01_TC16: thời gian vào khu chờ định dạng DD/MM/YYYY HH:mm + thời gian chờ tương đối */}
                      <td className="px-4 py-3 text-right text-xs hidden md:table-cell">
                        <div className="text-on-surface whitespace-nowrap">{new Date(p.updated_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                        <div className="text-amber-600 font-semibold">{getWaitTime(p.updated_at)}</div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => handleRelease(p.id, p.code)} title="Xuất lẻ pallet — rời kho, trừ tồn (KHÔNG cập nhật phiếu PYX)" className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors inline-flex items-center gap-1 mr-1">
                          <span className="material-symbols-outlined text-[16px]">local_shipping</span>Xuất lẻ
                        </button>
                        <Link href={`/pallets/${p.id}`} className="p-1.5 rounded-lg hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors inline-flex align-middle">
                          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListPageFooter {...pg} unit="pallet" />
        </div>
      </div>
    </AppLayout>
  );
}
