"use client";
import { mobileHref } from "@/lib/mobile-href";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BackLink } from "@/components/mobile/BackLink";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";

export default function ThukhoStagingPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${basePath}/api/outbound/staging`).then(r=>r.json()).then(j=>{
      if(j.success){
        // API trả về pallet lồng `lines` → DÀN PHẲNG thành từng dòng hàng (giống desktop) để hiện đúng mã/tên/SL/HSD
        const flat:any[] = [];
        for (const p of (j.data||[])) for (const l of (p.lines||[])) flat.push({
          pallet_code: p.code,
          item_code: l.item_code?.code,
          short_name: l.item_code?.short_name,
          qty: Number(l.qty_box),
          expiry_date: l.expiry_date,
          lot: l.lot,
        });
        setItems(flat);
      }
    }).catch(console.error).finally(()=>setLoading(false));
  }, []);
  const getDaysToExpiry = (d:string|null) => { if(!d) return null; return Math.ceil((new Date(d).getTime()-Date.now())/(86400000)); };

  // Phân trang client-side cho danh sách dòng hàng khu chờ xuất
  const pg = useClientPagination(items, { resetKey: "", initialLimit: 10 });
  const { paged: pagedItems } = pg;

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      <BackLink href="/thukho/warehouse">Kho hàng</BackLink>
      <h1 className="text-lg font-bold text-primary flex items-center gap-2"><span className="material-symbols-outlined">local_shipping</span> Khu chờ xuất</h1>
      {loading ? <div className="py-16 text-center"><span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span></div>
      : items.length===0 ? <div className="py-16 text-center text-sm text-on-surface-variant">Khu chờ xuất trống</div>
      : <>{pagedItems.map((item:any,i:number)=>{
        const days=getDaysToExpiry(item.expiry_date); const hsdClass=days!==null?(days<=7?"bg-red-100 text-red-700":days<=30?"bg-amber-100 text-amber-700":"bg-green-100 text-green-700"):"";
        return (<div key={i} className="industrial-card p-md rounded-xl bg-surface shadow-sm"><div className="flex justify-between items-start"><div><span className="text-xs font-bold text-primary">{item.short_name||item.item_code||"—"}</span><p className="text-[11px] md:text-xs text-on-surface-variant">{item.item_code||"—"} · {item.pallet_code||"—"}</p></div>{days!==null&&<span className={`px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold ${hsdClass}`}>{days}d</span>}</div><div className="flex gap-md mt-2 text-[11px] md:text-xs text-on-surface-variant"><span>{item.qty||"—"} thùng</span><span>{item.expiry_date?new Date(item.expiry_date).toLocaleDateString("vi-VN"):"—"}</span></div></div>);
      })}<ListPageFooter {...pg} unit="dòng" /></>}
    </div>
  );
}
