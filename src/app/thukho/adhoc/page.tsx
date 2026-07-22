"use client";
import { mobileHref } from "@/lib/mobile-href";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";
import { labelOf, INBOUND_TEMP_STATUS_LABEL } from "@/lib/status-labels";

export default function ThukhoAdhocPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<{total_receipts:number;total_lines:number}>({total_receipts:0,total_lines:0});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${basePath}/api/inbound-temp`).then(r=>r.json()),
      fetch(`${basePath}/api/inbound-temp/summary`).then(r=>r.json()).catch(()=>({success:false})),
    ]).then(([listJ,sumJ])=>{ if(listJ.success) setItems(listJ.data||[]); if(sumJ.success&&sumJ.data) setSummary(sumJ.data); }).catch(console.error).finally(()=>setLoading(false));
  }, []);

  // Phân trang client-side cho danh sách phiếu nhập đột xuất
  const pg = useClientPagination(items, { resetKey: `${items.length}` });
  const { paged: pagedItems } = pg;

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-primary flex items-center gap-2"><span className="material-symbols-outlined text-[22px]">note_add</span> Nhập đột xuất</h1>
        <Link href={mobileHref("/thukho/adhoc/new")} className="px-3 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-sm">add</span> Tạo phiếu</Link>
      </div>
      <div className="grid grid-cols-2 gap-gutter">
        <div className="industrial-card p-md rounded-xl bg-surface flex flex-col items-center"><span className="text-2xl font-bold font-jetbrains text-primary">{summary.total_receipts}</span><span className="text-[11px] md:text-xs text-on-surface-variant">Phiếu tạm</span></div>
        <div className="industrial-card p-md rounded-xl bg-surface flex flex-col items-center"><span className="text-2xl font-bold font-jetbrains text-secondary">{summary.total_lines}</span><span className="text-[11px] md:text-xs text-on-surface-variant">Dòng hàng</span></div>
      </div>
      <div className="flex flex-col gap-sm">
        {loading ? <div className="py-16 text-center"><span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span></div>
        : items.length===0 ? <div className="py-16 text-center text-sm text-on-surface-variant">Chưa có phiếu tạm nào</div>
        : pagedItems.map((item:any)=>(
          <Link key={item.id} href={mobileHref(`/thukho/adhoc/${item.id}`)} className="industrial-card p-md rounded-xl bg-surface shadow-sm hover:border-primary/30 transition-all">
            <div className="flex justify-between items-start"><div><span className="font-mono text-sm text-primary font-bold">{item.code}</span><p className="text-[11px] md:text-xs text-on-surface-variant">{item.supplier?.name||"—"}</p></div>
              <span className="px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold bg-amber-100 text-amber-700">{labelOf(INBOUND_TEMP_STATUS_LABEL, item.status)}</span></div>
            <div className="flex gap-md mt-2 text-[11px] md:text-xs text-on-surface-variant"><span>{item.total_lines} dòng</span><span>{new Date(item.created_at).toLocaleDateString("vi-VN")}</span></div>
          </Link>))}
        {!loading && items.length>0 && <ListPageFooter {...pg} unit="phiếu" />}
      </div>
    </div>
  );
}
