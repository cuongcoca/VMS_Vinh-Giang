"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { mobileHref } from "@/lib/mobile-href";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";

export default function KiemkeTasksPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [sessions, setSessions] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [tab, setTab] = useState("");

  useEffect(() => {
    setLoading(true); const params = tab ? `?status=${tab}` : "";
    fetch(`${basePath}/api/stock-count${params}`).then(r => r.json()).then(j => { if (j.success) setSessions(j.data || []); }).catch(console.error).finally(() => setLoading(false));
  }, [tab]);

  // UC-INV: enum phiên là OPEN/COUNTING/RECONCILING/CLOSED (KHÔNG phải COMPLETED) → tab "Đã xong" trước lọc sai
  const TABS = [{ key: "", label: "Tất cả" }, { key: "OPEN", label: "Đang mở" }, { key: "COUNTING", label: "Đang đếm" }, { key: "RECONCILING", label: "Đối chiếu" }, { key: "CLOSED", label: "Đã xong" }];
  const STATUS_LABEL: Record<string, string> = { OPEN: "Đang mở", COUNTING: "Đang đếm", RECONCILING: "Đối chiếu", CLOSED: "Đã xong" };
  const getStatusColor = (s: string) => { switch (s) { case "OPEN": return "bg-blue-100 text-blue-700"; case "COUNTING": return "bg-amber-100 text-amber-700"; case "RECONCILING": return "bg-purple-100 text-purple-700"; case "CLOSED": return "bg-green-100 text-green-700"; default: return "bg-gray-100 text-gray-600"; } };

  // Phân trang client-side cho danh sách phiên kiểm kê (reset khi đổi tab lọc trạng thái)
  const pg = useClientPagination(sessions, { resetKey: tab });
  const { paged: pagedSessions } = pg;

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      <h1 className="text-lg font-bold text-primary flex items-center gap-2"><span className="material-symbols-outlined">assignment</span> Nhiệm vụ kiểm kê</h1>
      <div className="flex gap-xs overflow-x-auto custom-scroll-hide">
        {TABS.map(t => (<button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === t.key ? "bg-primary text-white" : "bg-surface-low text-on-surface-variant"}`}>{t.label}</button>))}
      </div>
      {loading ? <div className="py-16 text-center"><span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span></div>
        : sessions.length === 0 ? <div className="py-16 text-center text-sm text-on-surface-variant">Chưa có phiên nào</div>
          : <>
            {pagedSessions.map((s: any) => (
            <Link key={s.id} href={mobileHref(`/kiemke/tasks/${s.id}`)} className="industrial-card p-md rounded-xl bg-surface shadow-sm hover:border-primary/30 transition-all">
              <div className="flex justify-between items-start">
                <div><span className="font-mono text-sm text-primary font-bold">{s.code || `STK-${s.id?.slice(0, 8)}`}</span><p className="text-[11px] md:text-xs text-on-surface-variant">{s.type === "BY_LOCATION" ? "📍 Theo vị trí" : "🏷️ Theo mã hàng"}</p></div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold ${getStatusColor(s.status)}`}>{STATUS_LABEL[s.status] || s.status}</span>
              </div>
              {s.progress !== undefined && <div className="mt-2"><div className="h-1.5 bg-surface-variant rounded-full overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${s.progress || 0}%` }}></div></div><span className="text-[11px] md:text-xs text-on-surface-variant">{s.progress || 0}%</span></div>}
            </Link>))}
            <ListPageFooter {...pg} unit="phiên" />
          </>}
    </div>
  );
}
