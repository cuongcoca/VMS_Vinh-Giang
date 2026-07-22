"use client";
import { useToast, useClientPagination, ListPageFooter } from "@/components/ui";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

type Supplier = { id: string; code: string; name: string };
type InboundTemp = {
  id: string; code: string; status: string; supplier_id: string | null;
  supplier: Supplier | null; note: string | null; _count?: { lines: number }; created_at: string;
};
const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  PENDING: { label: "Chờ chuẩn hóa", color: "text-amber-700", bg: "bg-amber-50", icon: "pending_actions" },
  STANDARDIZED: { label: "Đã chuẩn hóa", color: "text-emerald-700", bg: "bg-emerald-50", icon: "check_circle" },
  REJECTED: { label: "Từ chối", color: "text-rose-600", bg: "bg-rose-50", icon: "cancel" },
};

export default function InboundAdhocPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<InboundTemp[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [summary, setSummary] = useState({ pending_count: 0, total_qty_pending: 0 });

  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebouncedQuery(searchQuery), 300); return () => clearTimeout(t); }, [searchQuery]);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (filterStatus) params.set("status", filterStatus);
      if (filterSupplier) params.set("supplier_id", filterSupplier);
      const res = await fetch(`/wms/api/inbound-temp?${params.toString()}`);
      const result = await res.json();
      if (result.success) { setRequests(result.data); setKpis(result.kpis || {}); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [debouncedQuery, filterStatus, filterSupplier]);

  const fetchSummary = async () => {
    try {
      const res = await fetch("/wms/api/inbound-temp/summary");
      const result = await res.json();
      if (result.success) setSummary(result.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  useEffect(() => { fetchSummary(); fetch("/wms/api/suppliers").then(r => r.json()).then(r => { if (r.success) setSuppliers(r.data); }); }, []);

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Xóa phiếu tạm "${code}"?`)) return;
    try {
      const res = await fetch(`/wms/api/inbound-temp/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) { fetchRequests(); fetchSummary(); } else toast.error(result.error);
    } catch (err) { console.error(err); }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("vi-VN") : "—";

  // Phân trang client-side cho danh sách phiếu tồn tạm
  const pg = useClientPagination(requests, { resetKey: `${debouncedQuery}|${filterStatus}|${filterSupplier}` });
  const { paged: pagedRequests } = pg;

  return (
    <AppLayout title="TỒN TẠM">
      <div className="p-6 space-y-5 min-w-0 overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">Phiếu tồn tạm</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">Ghi nhận hàng nhập tạm khi chưa có phiếu nhập chính thức</p>
          </div>
          <Link href="/inbound-adhoc/new" className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Tạo phiếu tạm
          </Link>
        </div>

        {/* KPIs + Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { key: "TOTAL", label: "Tổng", color: "text-on-surface" },
            { key: "PENDING", label: "Chờ chuẩn hóa", color: "text-amber-600" },
            { key: "STANDARDIZED", label: "Đã chuẩn hóa", color: "text-emerald-600" },
            { key: "REJECTED", label: "Từ chối", color: "text-rose-500" },
          ].map(({ key, label, color }) => (
            <div key={key} onClick={() => key !== "TOTAL" ? setFilterStatus(filterStatus === key ? "" : key) : setFilterStatus("")}
              className={`bg-white p-3.5 rounded-xl border shadow-sm cursor-pointer transition-all ${
                filterStatus === key ? "border-primary ring-2 ring-primary/10 scale-[1.02]" : "border-outline-variant hover:border-outline-variant"
              }`}>
              <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">{label}</span>
              <span className={`text-xl font-bold mt-1 block ${color}`}>{kpis[key] || 0}</span>
            </div>
          ))}
          <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 shadow-sm">
            <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">SL thùng chờ</span>
            <span className="text-xl font-bold mt-1 block text-amber-700 font-mono">{summary.total_qty_pending}</span>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
            <input type="text" placeholder="Tìm mã phiếu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-low border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}
            className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-surface-low focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[180px]">
            <option value="">— Tất cả NCC —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
          {(filterStatus || filterSupplier) && (
            <button onClick={() => { setFilterStatus(""); setFilterSupplier(""); }}
              className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1 font-semibold whitespace-nowrap">
              <span className="material-symbols-outlined text-[14px]">filter_alt_off</span> Xóa lọc
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead>
                <tr className="bg-surface-low border-b border-outline-variant">
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Mã phiếu</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">NCC</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Trạng thái</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Dòng hàng</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden lg:table-cell">Ngày tạo</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-on-surface-variant">
                    <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
                    <p className="mt-2 text-sm">Đang tải...</p>
                  </td></tr>
                ) : requests.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[40px] opacity-30">inbox</span>
                    <p className="mt-2 text-sm">Chưa có phiếu tạm nào.</p>
                  </td></tr>
                ) : pagedRequests.map(r => {
                  const st = STATUS_MAP[r.status] || { label: r.status, color: "text-on-surface-variant", bg: "bg-surface-low", icon: "help" };
                  return (
                    <tr key={r.id} className="border-b border-outline-variant/50 hover:bg-surface-low/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-base">
                        <Link href={`/inbound-adhoc/${r.id}`} className="text-primary hover:underline">{r.code}</Link>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">{r.supplier ? r.supplier.name : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.bg} ${st.color}`}>
                          <span className="material-symbols-outlined text-[14px]">{st.icon}</span>{st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-center text-on-surface-variant">{r._count?.lines || 0}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-on-surface-variant text-xs">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/inbound-adhoc/${r.id}`} className="p-1.5 rounded-lg hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors" title="Xem">
                            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                          </Link>
                          {r.status === "PENDING" && (
                            <button onClick={() => handleDelete(r.id, r.code)} className="p-1.5 rounded-lg hover:bg-rose-50 text-on-surface-variant hover:text-rose-600 transition-colors" title="Xóa">
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          )}
                        </div>
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
