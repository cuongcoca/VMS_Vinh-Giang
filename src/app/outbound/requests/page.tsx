"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type OutboundRequest = {
  id: string; code: string; status: string;
  customer: string | null; ship_date: string | null;
  note: string | null; created_at: string; shipped_at: string | null;
  _count?: { lines: number };
  lines: { item_code: { code: string; short_name: string } }[];
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Chờ lấy hàng", color: "bg-amber-50 text-amber-700 border-amber-200" },
  PICKING: { label: "Đang lấy hàng", color: "bg-blue-50 text-blue-700 border-blue-200" },
  SHIPPED: { label: "Đã xuất kho", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "Đã hủy", color: "bg-surface-low text-on-surface-variant border-outline-variant" },
};

export default function OutboundRequestsPage() {
  const [data, setData] = useState<OutboundRequest[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (search) params.set("q", search);
      const res = await fetch(`/wms/api/outbound/requests?${params.toString()}`);
      const result = await res.json();
      if (result.success) { setData(result.data); setKpis(result.kpis || {}); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filterStatus, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Phân trang client-side cho danh sách phiếu PYX
  // Hoãn từ khoá tìm kiếm trước khi đưa vào resetKey: nếu dùng giá trị thô thì
  // mỗi ký tự gõ là một lần nhảy về trang 1.
  const debouncedSearch = useDebouncedValue(search);
  const pg = useClientPagination(data, { resetKey: `${filterStatus}|${debouncedSearch}` });
  const { paged: pagedData } = pg;

  return (
    <AppLayout title="PHIẾU YÊU CẦU XUẤT">
      <div className="p-6 space-y-5">
        <BackButton fallback="/outbound/rebalance">Quay lại Cân lại tồn</BackButton>

        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[28px]">description</span> Phiếu yêu cầu xuất (PYX)
            </h1>
            <p className="text-sm text-on-surface-variant mt-0.5">Quản lý đơn hàng xuất — mã tự sinh PYX-YYYY-NNNN. Workflow: Tạo → Duyệt → Giao.</p>
          </div>
          <Link href="/outbound/requests/new" className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>Tạo phiếu PYX mới
          </Link>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { key: "TOTAL", label: "Tổng", color: "text-on-surface" },
            { key: "PENDING", label: "Chờ lấy hàng", color: "text-amber-600" },
            { key: "PICKING", label: "Đang lấy", color: "text-blue-600" },
            { key: "SHIPPED", label: "Đã xuất kho", color: "text-emerald-600" },
            { key: "CANCELLED", label: "Đã hủy", color: "text-on-surface-variant" },
          ].map(k => (
            <button key={k.key} onClick={() => k.key !== "TOTAL" ? setFilterStatus(filterStatus === k.key ? "" : k.key) : setFilterStatus("")}
              className={`text-left bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all ${filterStatus === k.key ? "border-primary ring-2 ring-primary/10" : "border-outline-variant"}`}>
              <span className="text-[10px] font-semibold text-on-surface-variant uppercase">{k.label}</span>
              <span className={`text-xl font-bold mt-1 block font-mono ${k.color}`}>{kpis[k.key] || 0}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
          <input type="text" placeholder="Tìm mã phiếu / khách hàng / ghi chú..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 800 }}>
              <thead className="bg-surface-low/50 border-b border-outline-variant">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Mã phiếu</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Khách hàng</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden md:table-cell">Ngày giao</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Dòng</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Trạng thái</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden md:table-cell">Ngày tạo</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12"><span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span></td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[40px] opacity-30">description</span>
                    <p className="mt-2 text-sm">Chưa có phiếu PYX nào.</p>
                    <Link href="/outbound/requests/new" className="inline-block mt-3 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/95">Tạo phiếu đầu tiên</Link>
                  </td></tr>
                ) : pagedData.map(r => {
                  const st = STATUS_MAP[r.status] || { label: r.status, color: "bg-surface-low text-on-surface-variant border-outline-variant" };
                  return (
                    <tr key={r.id} className="border-b border-outline-variant/40 hover:bg-surface-low/50">
                      <td className="px-4 py-2.5">
                        <Link href={`/outbound/requests/${r.id}`} className="font-mono font-bold text-primary hover:underline">{r.code}</Link>
                      </td>
                      <td className="px-4 py-2.5 font-semibold">{r.customer || "—"}</td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-xs">{r.ship_date ? new Date(r.ship_date).toLocaleDateString("vi-VN") : "—"}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{r._count?.lines || 0}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold border ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-xs">{new Date(r.created_at).toLocaleDateString("vi-VN")}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Link href={`/outbound/requests/${r.id}`} className="text-xs text-secondary hover:underline">Xem →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListPageFooter {...pg} unit="phiếu" />
        </div>
      </div>
    </AppLayout>
  );
}
