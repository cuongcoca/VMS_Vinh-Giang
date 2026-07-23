"use client";
import { mobileHref } from "@/lib/mobile-href";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BackLink } from "@/components/mobile/BackLink";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";
import { labelOf, STOCKTAKE_STATUS_LABEL } from "@/lib/status-labels";

export default function ThukhoStocktakePage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [sessions, setSessions] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { fetch(`${basePath}/api/stock-count`).then(r=>r.json()).then(j=>{ if(j.success) setSessions(j.data||[]); }).catch(console.error).finally(()=>setLoading(false)); }, []);
  const getStatusColor = (s:string) => { switch(s) { case "OPEN": return "bg-blue-100 text-blue-700"; case "COUNTING": return "bg-amber-100 text-amber-700"; case "COMPLETED": return "bg-green-100 text-green-700"; default: return "bg-gray-100 text-gray-600"; } };

  // Phân trang client-side cho danh sách phiên kiểm kê
  const pg = useClientPagination(sessions);
  const { paged: pagedSessions } = pg;

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      <BackLink href="/thukho/warehouse">Kho hàng</BackLink>
      <h1 className="text-lg font-bold text-primary flex items-center gap-2"><span className="material-symbols-outlined">fact_check</span> Kiểm kê vị trí</h1>
      {loading ? <div className="py-16 text-center"><span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span></div>
      : sessions.length===0 ? <div className="py-16 text-center text-sm text-on-surface-variant">Chưa có phiên kiểm kê</div>
      : <>
        {pagedSessions.map((s:any)=>(<div key={s.id} className="industrial-card p-md rounded-xl bg-surface shadow-sm"><div className="flex justify-between items-start"><div><span className="font-mono text-sm text-primary font-bold">{s.code||`STK-${s.id?.slice(0,8)}`}</span><p className="text-[11px] md:text-xs text-on-surface-variant">{s.type==="BY_LOCATION"?"📍 Theo vị trí":"🏷️ Theo mã hàng"}</p></div><span className={`px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold ${getStatusColor(s.status)}`}>{labelOf(STOCKTAKE_STATUS_LABEL, s.status)}</span></div>{s.progress!==undefined&&<div className="mt-2"><div className="h-1.5 bg-surface-variant rounded-full overflow-hidden"><div className="h-full bg-primary" style={{width:`${s.progress||0}%`}}></div></div><span className="text-[11px] md:text-xs text-on-surface-variant">{s.progress||0}% hoàn thành</span></div>}</div>))}
        <ListPageFooter {...pg} unit="phiên" />
      </>}
    </div>
  );
}
