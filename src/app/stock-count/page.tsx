"use client";
import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ExcelExport } from "@/components/ExcelExport";
import { useClientPagination, ListPageFooter } from "@/components/ui";
import Link from "next/link";

type Session = { id: string; code: string; type: string; status: string; note: string | null; created_at: string; completed_at: string | null; total_counts: number; counted: number };
const STATUS_MAP: Record<string, { label: string; color: string }> = { OPEN: { label: "Mở", color: "bg-blue-50 text-blue-700" }, COUNTING: { label: "Đang đếm", color: "bg-amber-50 text-amber-700" }, RECONCILING: { label: "Đối chiếu", color: "bg-rose-50 text-rose-700" }, CLOSED: { label: "Đóng", color: "bg-emerald-50 text-emerald-700" } };

export default function StockCountPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch("/wms/api/stock-count").then(r => r.json()).then(r => { if (r.success) setSessions(r.data); }).catch(console.error).finally(() => setLoading(false)); }, []);

  // Phân trang client-side cho danh sách phiên kiểm kê
  const pg = useClientPagination(sessions, { resetKey: `${sessions.length}` });
  const { paged: pagedSessions } = pg;

  return (
    <AppLayout title="KIỂM KÊ">
      <div className="p-6 space-y-5">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-primary flex items-center gap-2"><span className="material-symbols-outlined text-[28px]">fact_check</span> Kiểm kê</h1><p className="text-sm text-on-surface-variant mt-0.5">Quản lý phiên kiểm kê hàng tồn</p></div>
          <div className="flex items-center gap-2">
            <ExcelExport
              data={sessions as unknown as Record<string, unknown>[]}
              columns={[
                { key: "code", header: "Mã phiên" },
                { key: "type", header: "Loại", transform: (v) => v === "BY_LOCATION" ? "Theo vị trí" : "Theo mã hàng" },
                { key: "status", header: "Trạng thái", transform: (v) => STATUS_MAP[v as string]?.label || String(v) },
                { key: "counted", header: "Đã đếm" },
                { key: "total_counts", header: "Tổng mục" },
                { key: "created_at", header: "Ngày tạo", transform: (v) => v ? new Date(v as string).toLocaleDateString("vi-VN") : "" },
              ]}
              filename="kiem_ke"
            />
          <Link href="/stock-count/new" className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">add</span> Tạo phiên mới</Link>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="bg-surface-low/50 border-b border-outline-variant">
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Mã phiên</th>
            <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Loại</th>
            <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Trạng thái</th>
            <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Tiến độ</th>
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden md:table-cell">Ngày tạo</th>
            <th className="text-right px-4 py-2.5"></th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="text-center py-12"><span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span></td></tr>
            : sessions.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-on-surface-variant">Chưa có phiên kiểm kê nào.</td></tr>
            : pagedSessions.map(s => {
              const st = STATUS_MAP[s.status] || { label: s.status, color: "bg-surface-low" };
              return (
                <tr key={s.id} className="border-b border-outline-variant/40 hover:bg-surface-low/50">
                  <td className="px-4 py-3"><Link href={`/stock-count/${s.id}`} className="font-mono font-bold text-primary hover:underline">{s.code}</Link></td>
                  <td className="px-4 py-3 text-center text-xs">{s.type === "BY_LOCATION" ? "Theo vị trí" : "Theo mã hàng"}</td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.color}`}>{st.label}</span></td>
                  <td className="px-4 py-3 text-center font-mono text-xs">{s.counted}/{s.total_counts}</td>
                  <td className="px-4 py-3 text-xs hidden md:table-cell">{new Date(s.created_at).toLocaleDateString("vi-VN")}</td>
                  <td className="px-4 py-3 text-right"><Link href={`/stock-count/${s.id}`} className="text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined text-[18px]">open_in_new</span></Link></td>
                </tr>
              );
            })}
          </tbody></table>
          <ListPageFooter {...pg} unit="phiên" />
        </div>
      </div>
    </AppLayout>
  );
}
