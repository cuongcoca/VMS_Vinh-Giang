"use client";
import { mobileHref } from "@/lib/mobile-href";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BackLink } from "@/components/mobile/BackLink";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";

export default function ThukhoQueuePage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [queue, setQueue] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { fetch(`${basePath}/api/forklift/queue`).then(r=>r.json()).then(j=>{ if(j.success) setQueue(j.data||[]); }).catch(console.error).finally(()=>setLoading(false)); }, []);
  const getWaitTime = (t:string|null) => { if(!t) return "—"; const m=Math.floor((Date.now()-new Date(t).getTime())/60000); return m<60?`${m}p`:`${Math.floor(m/60)}h${m%60}p`; };

  // Phân trang client-side cho danh sách pallet chờ xếp
  const pg = useClientPagination(queue, { resetKey: `len-${queue.length}` });
  const { paged: pagedQueue } = pg;

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      <BackLink href="/thukho/warehouse">Kho hàng</BackLink>
      <h1 className="text-lg font-bold text-primary flex items-center gap-2"><span className="material-symbols-outlined">pending_actions</span> Pallet chờ xếp ({queue.length})</h1>
      {loading ? <div className="py-16 text-center"><span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span></div>
      : queue.length===0 ? <div className="py-16 text-center"><span className="material-symbols-outlined text-[48px] text-success/30">check_circle</span><p className="text-sm text-on-surface-variant mt-2">Không có pallet chờ</p></div>
      : pagedQueue.map((p:any)=>(<div key={p.id} className="industrial-card p-md rounded-xl bg-surface shadow-sm"><div className="flex justify-between items-start"><div><span className="font-mono text-sm text-primary font-bold">{p.code}</span><p className="text-[11px] md:text-xs text-on-surface-variant">{p.supplier?.name||"—"}</p></div><span className="text-[11px] md:text-xs text-secondary font-mono font-bold">⏱ {getWaitTime(p.confirmed_at)}</span></div><div className="flex gap-md mt-2 text-[11px] md:text-xs text-on-surface-variant"><span>{p.total_lines} dòng</span><span>{p.total_weight_kg||"—"} kg</span></div></div>))}
      {!loading && queue.length>0 && <ListPageFooter {...pg} unit="pallet" />}
    </div>
  );
}
