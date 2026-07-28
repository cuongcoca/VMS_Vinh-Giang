"use client";
import { fetchJson } from "@/lib/api";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { ExcelExport } from "@/components/ExcelExport";
import { useToast, useConfirm, useClientPagination, ListPageFooter } from "@/components/ui";

type Supplier = { id: string; code: string; name: string };
type InboundRequest = {
  id: string;
  code: string;
  status: string;
  supplier_id: string | null;
  supplier: Supplier | null;
  expected_date: string | null;
  invoice_no: string | null;
  note: string | null;
  _count?: { lines: number };
  created_at: string;
  received_at: string | null;
  completed_at: string | null;
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  DRAFT: { label: "Nháp", color: "text-on-surface-variant", bg: "bg-surface-low", icon: "edit_note" },
  PENDING: { label: "Chờ tiếp nhận", color: "text-amber-700", bg: "bg-amber-50", icon: "hourglass_top" },
  RECEIVING: { label: "Đang nhận hàng", color: "text-blue-700", bg: "bg-blue-50", icon: "inventory" },
  RECONCILING: { label: "Đang đối chiếu", color: "text-purple-700", bg: "bg-purple-50", icon: "compare_arrows" },
  COMPLETED: { label: "Hoàn tất", color: "text-emerald-700", bg: "bg-emerald-50", icon: "check_circle" },
  CANCELLED: { label: "Đã hủy", color: "text-rose-600", bg: "bg-rose-50", icon: "cancel" },
};

// UC-IN-05: Map DB status → step (8 bước) theo mockup
const STATUS_TO_STEP: Record<string, { step: number; label: string }> = {
  DRAFT: { step: 1, label: "Mới — chờ TK tiếp nhận" },
  PENDING: { step: 2, label: "Chờ TK tiếp nhận" },
  RECEIVING: { step: 4, label: "Đang kiểm đếm" },
  RECONCILING: { step: 7, label: "Chờ chốt số" },
  COMPLETED: { step: 8, label: "Đã chốt" },
  CANCELLED: { step: 0, label: "Đã hủy" },
};

function InboundStepper({ status }: { status: string }) {
  const meta = STATUS_TO_STEP[status] || { step: 0, label: status };
  const totalSteps = 8;
  // CANCELLED → tất cả dot xám
  if (meta.step === 0) {
    return (
      <div>
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="h-1.5 w-3 rounded-full bg-rose-200" />
          ))}
        </div>
        <span className="text-[10.5px] text-rose-500 mt-0.5 block">{meta.label}</span>
      </div>
    );
  }
  return (
    <div>
      <div className="flex gap-1">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 w-3 rounded-full ${
              i < meta.step - 1 ? "bg-emerald-500" :
              i === meta.step - 1 ? (meta.step === totalSteps ? "bg-emerald-500" : "bg-amber-500 animate-pulse") :
              "bg-surface-mid"
            }`}
          />
        ))}
      </div>
      <span className={`text-[10.5px] mt-0.5 block ${meta.step === totalSteps ? "text-emerald-600 font-semibold" : "text-on-surface-variant"}`}>
        {meta.step === totalSteps ? "✓ " : ""}{meta.label} ({meta.step}/{totalSteps})
      </span>
    </div>
  );
}

const STATUS_CHIPS = [
  { key: "", label: "Tất cả", icon: "list" },
  { key: "DRAFT", label: "Nháp", icon: "edit_note" },
  { key: "PENDING", label: "Chờ tiếp nhận", icon: "hourglass_top" },
  { key: "RECEIVING", label: "Đang nhận", icon: "inventory" },
  { key: "RECONCILING", label: "Đối chiếu", icon: "compare_arrows" },
  { key: "COMPLETED", label: "Hoàn tất", icon: "check_circle" },
  { key: "CANCELLED", label: "Đã hủy", icon: "cancel" },
];

export default function InboundPage() {
  const [requests, setRequests] = useState<InboundRequest[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterDiscrepancy, setFilterDiscrepancy] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch inbound requests
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (filterStatus) params.set("status", filterStatus);
      if (filterSupplier) params.set("supplier_id", filterSupplier);
      if (filterDiscrepancy) params.set("has_discrepancy", "true");
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/wms/api/inbound?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setRequests(result.data);
        setKpis(result.kpis || {});
      }
    } catch (err) {
      console.error("Fetch inbound error:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, filterStatus, filterSupplier, filterDiscrepancy, dateFrom, dateTo]);

  // Fetch suppliers cho dropdown
  const fetchSuppliers = async () => {
    try {
      const body = await fetchJson<{ data?: unknown[] }>("/wms/api/suppliers");
      setSuppliers((body.data ?? []) as typeof suppliers);
    } catch (err) {
      console.error("Fetch suppliers error:", err);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Hủy phiếu
  const handleCancel = async (id: string, code: string) => {
    const ok = await confirm({
      title: "Hủy phiếu nhập?",
      description: `Phiếu "${code}" sẽ chuyển sang trạng thái Đã hủy.`,
      confirmText: "Hủy phiếu",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/wms/api/inbound/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast.success("Đã hủy phiếu");
        fetchRequests();
      } else {
        toast.error(result.error || "Hủy phiếu thất bại");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Gửi phiếu
  const handleSend = async (id: string, code: string) => {
    const ok = await confirm({
      title: "Gửi phiếu cho Thủ kho?",
      description: `Phiếu "${code}" sẽ được gửi cho Thủ kho tiếp nhận.`,
      confirmText: "Gửi",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/wms/api/inbound/${id}/send`, { method: "POST" });
      const result = await res.json();
      if (result.success) {
        toast.success("Đã gửi phiếu cho Thủ kho");
        fetchRequests();
      } else {
        toast.error(result.error || "Gửi phiếu thất bại");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("vi-VN");
  };

  const hasActiveFilters = filterStatus || filterSupplier || filterDiscrepancy || dateFrom || dateTo;

  const clearAllFilters = () => {
    setFilterStatus("");
    setFilterSupplier("");
    setFilterDiscrepancy(false);
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
  };

  // Phân trang client-side cho danh sách phiếu nhập
  const pg = useClientPagination(requests, {
    resetKey: `${debouncedQuery}|${filterStatus}|${filterSupplier}|${filterDiscrepancy}|${dateFrom}|${dateTo}`,
  });
  const { paged: pagedRequests } = pg;

  return (
    <AppLayout title="PHIẾU NHẬP">
      <div className="p-6 space-y-5 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">Quản lý Phiếu nhập</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Lập và theo dõi phiếu yêu cầu nhập kho — mã tự sinh PHN-YYYY-SSSS
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExcelExport
              data={requests as unknown as Record<string, unknown>[]}
              columns={[
                { key: "code", header: "Mã phiếu" },
                { key: "invoice_no", header: "Số HĐ", transform: (v) => (v as string) || "" },
                { key: "status", header: "Trạng thái", transform: (v) => STATUS_MAP[v as string]?.label || String(v) },
                { key: "supplier", header: "NCC", transform: (v) => (v as Supplier)?.name || "" },
                { key: "expected_date", header: "Ngày dự kiến", transform: (v) => v ? new Date(v as string).toLocaleDateString("vi-VN") : "" },
                { key: "_count", header: "Dòng hàng", transform: (v) => (v as { lines: number })?.lines || 0 },
                { key: "created_at", header: "Ngày tạo", transform: (v) => v ? new Date(v as string).toLocaleDateString("vi-VN") : "" },
              ]}
              filename="phieu_nhap"
              label="Xuất Excel"
            />
            <Link
              href="/inbound/import"
              className="px-4 py-2 text-sm border border-outline-variant text-on-surface-variant rounded-lg flex items-center gap-2 hover:bg-surface-low font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              📥 Nhập từ Excel
            </Link>
            <Link
              href="/inbound/new"
              className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              📝 Lập phiếu mới
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {[
            { key: "TOTAL", label: "Tổng", color: "text-on-surface", border: "border-outline-variant" },
            { key: "DRAFT", label: "Nháp", color: "text-on-surface-variant", border: "border-outline-variant" },
            { key: "PENDING", label: "Chờ tiếp nhận", color: "text-amber-600", border: "border-amber-200" },
            { key: "RECEIVING", label: "Đang nhận", color: "text-blue-600", border: "border-blue-200" },
            { key: "RECONCILING", label: "Đối chiếu", color: "text-purple-600", border: "border-purple-200" },
            { key: "COMPLETED", label: "Hoàn tất", color: "text-emerald-600", border: "border-emerald-200" },
            { key: "CANCELLED", label: "Đã hủy", color: "text-rose-500", border: "border-rose-200" },
          ].map(({ key, label, color, border }) => (
            <div
              key={key}
              onClick={() => key !== "TOTAL" ? setFilterStatus(filterStatus === key ? "" : key) : setFilterStatus("")}
              className={`bg-white p-3.5 rounded-xl border shadow-sm cursor-pointer transition-all ${
                filterStatus === key || (key === "TOTAL" && !filterStatus)
                  ? `${border} ring-2 ring-primary/10 scale-[1.02]`
                  : "border-outline-variant hover:border-outline-variant"
              }`}
            >
              <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">{label}</span>
              <span className={`text-xl font-bold mt-1 block ${color}`}>{kpis[key] || 0}</span>
            </div>
          ))}
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_CHIPS.map(chip => (
            <button
              key={chip.key}
              onClick={() => setFilterStatus(chip.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filterStatus === chip.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white text-on-surface-variant border border-outline-variant hover:bg-surface-low"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{chip.icon}</span>
              {chip.label}
              {chip.key && (
                <span className={`ml-0.5 text-[10px] font-bold ${filterStatus === chip.key ? "text-white/80" : "text-on-surface-variant/60"}`}>
                  {kpis[chip.key] || 0}
                </span>
              )}
            </button>
          ))}
          {/* UC-IN-05: Pill "Có chênh lệch" */}
          <button
            onClick={() => setFilterDiscrepancy(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filterDiscrepancy
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50"
            }`}
            title="Lọc các phiếu có dòng SL nhận khác SL yêu cầu"
          >
            <span className="material-symbols-outlined text-[14px]">warning</span>
            Có chênh lệch
            {(kpis.HAS_DISCREPANCY ?? 0) > 0 && (
              <span className={`ml-0.5 text-[10px] font-bold ${filterDiscrepancy ? "text-white/80" : "text-rose-500/70"}`}>
                {kpis.HAS_DISCREPANCY}
              </span>
            )}
          </button>
        </div>

        {/* Search + Filters Row */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 w-full lg:max-w-sm">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
              <input
                type="text"
                placeholder="Tìm số hóa đơn, mã phiếu, ghi chú..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-low border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            {/* NCC Dropdown */}
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-surface-low focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-w-[200px]"
            >
              <option value="">— Tất cả NCC —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>

            {/* Date From */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-on-surface-variant whitespace-nowrap">Từ</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2.5 py-2 text-sm border border-outline-variant rounded-lg bg-surface-low focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Date To */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-on-surface-variant whitespace-nowrap">Đến</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2.5 py-2 text-sm border border-outline-variant rounded-lg bg-surface-low focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1 font-semibold transition-colors whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
                Xóa bộ lọc
              </button>
            )}
          </div>

          {/* Active filter summary */}
          {hasActiveFilters && (
            <div className="mt-3 pt-3 border-t border-outline-variant/50 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-on-surface-variant">Đang lọc:</span>
              {filterStatus && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                  {STATUS_MAP[filterStatus]?.label || filterStatus}
                  <button onClick={() => setFilterStatus("")} className="hover:text-rose-500">×</button>
                </span>
              )}
              {filterSupplier && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600">
                  NCC: {suppliers.find(s => s.id === filterSupplier)?.name || "..."}
                  <button onClick={() => setFilterSupplier("")} className="hover:text-rose-500">×</button>
                </span>
              )}
              {filterDiscrepancy && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600">
                  ⚠ Có chênh lệch
                  <button onClick={() => setFilterDiscrepancy(false)} className="hover:text-rose-500">×</button>
                </span>
              )}
              {dateFrom && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600">
                  Từ: {dateFrom}
                  <button onClick={() => setDateFrom("")} className="hover:text-rose-500">×</button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600">
                  Đến: {dateTo}
                  <button onClick={() => setDateTo("")} className="hover:text-rose-500">×</button>
                </span>
              )}
              <span className="text-xs text-on-surface-variant/70 ml-2">
                {requests.length} kết quả
              </span>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead>
                <tr className="bg-surface-low border-b border-outline-variant">
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Mã phiếu</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Số HĐ</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">NCC</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Ngày dự kiến</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden lg:table-cell" style={{ width: 140 }}>Tiến độ</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Trạng thái</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Dòng hàng</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden lg:table-cell">Ngày tạo</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-on-surface-variant">
                    <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
                    <p className="mt-2 text-sm">Đang tải...</p>
                  </td></tr>
                ) : requests.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[40px] opacity-30">inbox</span>
                    <p className="mt-2 text-sm">{hasActiveFilters ? "Không tìm thấy phiếu nào phù hợp." : "Chưa có phiếu nhập nào."}</p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="mt-3 text-xs text-primary hover:underline"
                      >
                        Xóa bộ lọc
                      </button>
                    )}
                  </td></tr>
                ) : (
                  pagedRequests.map((r) => {
                    const st = STATUS_MAP[r.status] || { label: r.status, color: "text-on-surface-variant", bg: "bg-surface-low", icon: "help" };
                    return (
                      <tr key={r.id} className="border-b border-outline-variant/50 hover:bg-surface-low/50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-base">
                          <Link href={`/inbound/${r.id}`} className="text-primary hover:underline">{r.code}</Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-on-surface-variant">
                          {r.invoice_no || "—"}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">
                          {r.supplier ? <span className="text-sm">{r.supplier.name}</span> : "—"}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-on-surface-variant">{formatDate(r.expected_date)}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <InboundStepper status={r.status} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.bg} ${st.color}`}>
                            <span className="material-symbols-outlined text-[14px]">{st.icon}</span>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-on-surface-variant text-sm text-center">{r._count?.lines || 0}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-on-surface-variant text-xs">{formatDate(r.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/inbound/${r.id}`}
                              className="p-1.5 rounded-lg hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors"
                              title="Xem chi tiết">
                              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                            </Link>
                            {r.status === "DRAFT" && (
                              <>
                                <button
                                  onClick={() => handleSend(r.id, r.code)}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 text-on-surface-variant hover:text-blue-600 transition-colors"
                                  title="Gửi cho Thủ kho">
                                  <span className="material-symbols-outlined text-[18px]">send</span>
                                </button>
                                <button
                                  onClick={() => handleCancel(r.id, r.code)}
                                  className="p-1.5 rounded-lg hover:bg-rose-50 text-on-surface-variant hover:text-rose-600 transition-colors"
                                  title="Hủy phiếu">
                                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                                </button>
                              </>
                            )}
                            {/* VĐ3: phiếu đã gửi vẫn hủy được — mở form nhập lý do ở trang chi tiết */}
                            {(r.status === "PENDING" || r.status === "RECEIVING") && (
                              <Link
                                href={`/inbound/${r.id}?cancel=1`}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-on-surface-variant hover:text-rose-600 transition-colors"
                                title="Hủy phiếu (kèm lý do)">
                                <span className="material-symbols-outlined text-[18px]">cancel</span>
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang */}
          {!loading && requests.length > 0 && (
            <ListPageFooter {...pg} unit="phiếu" />
          )}

          {/* Footer count */}
          {!loading && requests.length > 0 && (
            <div className="px-4 py-3 bg-surface-low border-t border-outline-variant flex items-center justify-between text-xs text-on-surface-variant">
              <span>Hiển thị <strong className="text-on-surface">{requests.length}</strong> phiếu</span>
              <span>Tổng toàn bộ: <strong className="text-on-surface">{kpis.TOTAL || 0}</strong></span>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
