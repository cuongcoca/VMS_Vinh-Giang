"use client";
import { mobileHref } from "@/lib/mobile-href";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BackLink } from "@/components/mobile/BackLink";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export default function ThukhoInventoryPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [search, setSearch] = useState("");
  useEffect(() => { fetch(`${basePath}/api/inventory/by-item`).then(r=>r.json()).then(j=>{ if(j.success) setItems(j.data||[]); }).catch(console.error).finally(()=>setLoading(false)); }, []);
  const filtered = search ? items.filter((i:any)=>(i.item_code||'').toLowerCase().includes(search.toLowerCase())||(i.item_name||'').toLowerCase().includes(search.toLowerCase())) : items;
  // Phân trang client-side cho danh sách tồn theo mã
  // Hoãn từ khoá tìm kiếm trước khi đưa vào resetKey: nếu dùng giá trị thô thì
  // mỗi ký tự gõ là một lần nhảy về trang 1.
  const debouncedSearch = useDebouncedValue(search);
  const pg = useClientPagination(filtered, { resetKey: `${debouncedSearch}` });
  const { paged: pagedItems } = pg;

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      <BackLink href="/thukho/warehouse">Kho hàng</BackLink>
      <h1 className="text-lg font-bold text-primary flex items-center gap-2"><span className="material-symbols-outlined">inventory</span> Tồn kho theo mã</h1>
      <div className="relative"><span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">search</span>
        <input type="text" placeholder="Tìm mã hàng, tên..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-lg text-sm bg-surface" /></div>
      {loading ? <div className="py-16 text-center"><span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span></div>
      : filtered.length===0 ? <div className="py-16 text-center text-sm text-on-surface-variant">Không có dữ liệu</div>
      : <>{pagedItems.map((item:any)=>(
        <div key={item.item_code_id||item.item_code} className="industrial-card p-md rounded-xl bg-surface shadow-sm"><div className="flex justify-between items-start"><div><span className="text-xs font-bold text-primary">{item.item_code}</span><p className="text-[11px] md:text-xs text-on-surface-variant">{item.item_name}</p></div></div>
          <div className="grid grid-cols-3 gap-sm mt-2 text-center"><div className="min-w-0"><span className="text-[11px] md:text-xs text-on-surface-variant block">Tổng</span><span className="text-sm font-bold text-primary tabular-nums break-words block">{item.total_qty||0}</span></div><div className="min-w-0"><span className="text-[11px] md:text-xs text-on-surface-variant block">Khả dụng</span><span className="text-sm font-bold text-success tabular-nums break-words block">{item.available_qty||0}</span></div><div className="min-w-0"><span className="text-[11px] md:text-xs text-on-surface-variant block">Chờ xuất</span><span className="text-sm font-bold text-amber-600 tabular-nums break-words block">{item.staging_qty||0}</span></div></div></div>))}
        <ListPageFooter {...pg} unit="mã hàng" /></>}
    </div>
  );
}
