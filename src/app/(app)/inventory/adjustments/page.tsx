"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/Badge";
import { ExcelExport } from "@/components/ExcelExport";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type AdjustmentLine = {
  id: string;
  item_code_id: string;
  qty_before: number;
  qty_adjust: number;
  qty_after: number;
  item_code: { code: string; short_name: string };
};

type AdjustmentVoucher = {
  id: string;
  code: string;
  reason: string;
  reason_code?: string | null;          // UC-INV-09 TC04-07: mã lý do (Hỏng/Mất/Kiểm kê/Khác)
  type?: string | null;
  stocktake_session_id?: string | null; // UC-INV-09 TC01: phiếu tự tạo từ kiểm kê
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  lines: AdjustmentLine[];
};

// UC-INV-09 TC04-07: nhãn mã lý do hiển thị
const REASON_CODE_LABELS: Record<string, string> = {
  BROKEN: "Hỏng", LOST: "Mất", STOCKTAKE: "Kiểm kê", OTHER: "Khác",
};

export default function AdjustmentsPage() {
  const [data, setData] = useState<AdjustmentVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  useEffect(() => {
    fetch("/wms/api/adjustments")
      .then(r => r.json())
      .then(r => { if (r.success) setData(r.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = data.filter(d => {
    const matchSearch = !search ||
      d.code.toLowerCase().includes(search.toLowerCase()) ||
      d.reason.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const pendingCount = data.filter(d => d.status === "PENDING").length;
  const approvedCount = data.filter(d => d.status === "APPROVED").length;
  const rejectedCount = data.filter(d => d.status === "REJECTED").length;

  const statusBadge = (status: string) => {
    const map: Record<string, "warning" | "success" | "error"> = {
      PENDING: "warning",
      APPROVED: "success",
      REJECTED: "error",
    };
    const labels: Record<string, string> = {
      PENDING: "Chờ duyệt",
      APPROVED: "Đã duyệt",
      REJECTED: "Từ chối",
    };
    return <Badge variant={map[status] || "neutral"}>{labels[status] || status}</Badge>;
  };

  // Phân trang client-side cho danh sách phiếu điều chỉnh
  // Hoãn từ khoá tìm kiếm trước khi đưa vào resetKey: nếu dùng giá trị thô thì
  // mỗi ký tự gõ là một lần nhảy về trang 1.
  const debouncedSearch = useDebouncedValue(search);
  const pg = useClientPagination(filtered, { resetKey: `${debouncedSearch}|${filterStatus}` });
  const { paged: pagedFiltered } = pg;

  return (
    <AppLayout title="PHIẾU ĐIỀU CHỈNH TỒN">
      <div className="p-6 space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">Phiếu điều chỉnh tồn</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">Quản lý các phiếu điều chỉnh tồn kho sau kiểm kê</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/inventory/adjustments/new" className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 shadow-sm transition-colors">
              <span className="material-symbols-outlined text-[18px]">add</span>Tạo phiếu mới
            </Link>
            <ExcelExport
              data={filtered as unknown as Record<string, unknown>[]}
              columns={[
                { key: "code", header: "Mã phiếu" },
                { key: "reason", header: "Lý do" },
                { key: "status", header: "Trạng thái" },
                { key: "created_at", header: "Ngày tạo", transform: (v) => new Date(v as string).toLocaleDateString("vi-VN") },
              ]}
              filename="phieu_dieu_chinh_ton"
            />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border shadow-sm">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase">Tổng phiếu</span>
            <span className="text-xl font-bold mt-1 block">{data.length}</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border shadow-sm">
            <span className="text-[10px] font-semibold text-amber-500 uppercase">Chờ duyệt</span>
            <span className="text-xl font-bold mt-1 block text-amber-600">{pendingCount}</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border shadow-sm">
            <span className="text-[10px] font-semibold text-emerald-500 uppercase">Đã duyệt</span>
            <span className="text-xl font-bold mt-1 block text-emerald-600">{approvedCount}</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border shadow-sm">
            <span className="text-[10px] font-semibold text-rose-500 uppercase">Từ chối</span>
            <span className="text-xl font-bold mt-1 block text-rose-600">{rejectedCount}</span>
          </div>
        </div>

        {/* Filter + Search */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex gap-1.5">
            {[
              { key: "ALL", label: "Tất cả" },
              { key: "PENDING", label: "Chờ duyệt" },
              { key: "APPROVED", label: "Đã duyệt" },
              { key: "REJECTED", label: "Từ chối" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterStatus === f.key ? "bg-primary text-white" : "bg-surface-low hover:bg-surface-mid"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
            <input
              type="text"
              placeholder="Tìm mã phiếu, lý do..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead>
                <tr className="bg-surface-low/50 border-b border-outline-variant">
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Mã phiếu</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Lý do</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Số dòng</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Trạng thái</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Ngày tạo</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-on-surface-variant">Không có dữ liệu.</td>
                  </tr>
                ) : (
                  pagedFiltered.map(d => (
                    <tr key={d.id} className="border-b border-outline-variant/40 hover:bg-surface-low/50">
                      <td className="px-4 py-2.5">
                        <Link href={`/inventory/adjustments/${d.id}`} className="font-mono font-bold text-primary hover:underline">
                          {d.code}
                        </Link>
                        {d.stocktake_session_id && <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 align-middle">Từ kiểm kê</span>}
                      </td>
                      <td className="px-4 py-2.5 max-w-[300px]">
                        {d.reason_code && <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-low text-on-surface-variant mr-1.5 align-middle">{REASON_CODE_LABELS[d.reason_code] || d.reason_code}</span>}
                        {d.reason}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{d.lines.length}</td>
                      <td className="px-4 py-2.5 text-center">{statusBadge(d.status)}</td>
                      <td className="px-4 py-2.5 text-sm">{new Date(d.created_at).toLocaleDateString("vi-VN")}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Link href={`/inventory/adjustments/${d.id}`} className="text-sm text-secondary hover:underline">
                          Xem →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <ListPageFooter {...pg} unit="phiếu" />
        </div>
      </div>
    </AppLayout>
  );
}
