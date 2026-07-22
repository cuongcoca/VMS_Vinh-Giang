"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import Link from "next/link";

type LocOption = { id: string; code: string; zone: string };
type ItemOption = { id: string; code: string; short_name: string };

export default function NewStockCountPage() {
  const router = useRouter();
  const [type, setType] = useState<"BY_LOCATION" | "BY_ITEM">("BY_LOCATION");
  const [note, setNote] = useState("");
  const [locations, setLocations] = useState<LocOption[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    // ?occupied=1: lấy MỌI vị trí đang có hàng (pallet_count > 0), gồm cả vị trí FULL —
    // không lọc theo status=USING nữa vì vị trí đầy pallet có effective_status=FULL sẽ bị sót.
    fetch("/wms/api/locations?occupied=1").then(r => r.json()).then(r => { if (r.success) setLocations(r.data); });
    fetch("/wms/api/item-codes?limit=100000").then(r => r.json()).then(r => { if (r.success) setItems(r.data); });
  }, []);

  const toggleId = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  
  const options = type === "BY_LOCATION" 
    ? locations.map(l => ({ id: l.id, label: `${l.code} (Khu ${l.zone})` })) 
    : items.map(i => ({ id: i.id, label: `${i.code} — ${i.short_name}` }));

  const filteredOptions = options.filter(o => 
    o.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  const selectAll = () => {
    const activeOpts = filteredOptions.map(o => o.id);
    const allSelectedActive = activeOpts.every(id => selectedIds.includes(id));
    if (allSelectedActive) {
      // Bỏ chọn tất cả các mục đang hiển thị
      setSelectedIds(prev => prev.filter(id => !activeOpts.includes(id)));
    } else {
      // Chọn tất cả các mục đang hiển thị
      setSelectedIds(prev => {
        const next = [...prev];
        activeOpts.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) { alert("Chọn ít nhất 1 mục."); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { type, note };
      if (type === "BY_LOCATION") body.location_ids = selectedIds;
      else body.item_code_ids = selectedIds;
      const res = await fetch("/wms/api/stock-count", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json();
      if (result.success) { router.push(`/stock-count/${result.data.id}`); }
      else setToast({ message: result.error, type: "error" });
    } catch { setToast({ message: "Lỗi.", type: "error" }); }
    finally { setSaving(false); setTimeout(() => setToast(null), 4000); }
  };

  return (
    <AppLayout title="TẠO PHIÊN KIỂM KÊ">
      <div className="p-6 max-w-2xl space-y-5">
        {toast && <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 bg-rose-600 text-white`}><span className="material-symbols-outlined text-[18px]">error</span>{toast.message}</div>}
        <BackButton fallback="/stock-count">Quay lại</BackButton>
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2"><span className="material-symbols-outlined text-[28px]">add_circle</span> Tạo phiên kiểm kê</h1>
        <div className="bg-white rounded-xl border border-outline-variant p-6 shadow-sm space-y-5">
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase block mb-2">Loại kiểm kê</label>
            <div className="flex gap-3">
              {(["BY_LOCATION", "BY_ITEM"] as const).map(t => (
                <button key={t} onClick={() => { setType(t); setSelectedIds([]); setQuery(""); }} className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${type === t ? "bg-primary text-white" : "bg-surface-low hover:bg-surface-mid"}`}>
                  {t === "BY_LOCATION" ? "Theo vị trí" : "Theo mã hàng"}
                </button>
              ))}
            </div>
          </div>
          <div><label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">Ghi chú</label><input type="text" value={note} onChange={e => setNote(e.target.value)} className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm" placeholder="Ghi chú phiên kiểm kê (tuỳ chọn)" /></div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase">Chọn {type === "BY_LOCATION" ? "vị trí" : "mã hàng"} ({selectedIds.length}/{options.length})</label>
              <button onClick={selectAll} className="text-xs text-primary font-semibold hover:underline">
                {filteredOptions.length > 0 && filteredOptions.every(o => selectedIds.includes(o.id)) ? "Bỏ chọn các mục đang tìm" : "Chọn tất cả các mục đang tìm"}
              </button>
            </div>
            
            {/* Thanh tìm kiếm */}
            <div className="flex items-center gap-2 px-3 border border-outline-variant rounded-lg bg-surface-low mb-2 focus-within:border-primary">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant/70">search</span>
              <input 
                type="text" 
                value={query} 
                onChange={e => setQuery(e.target.value)} 
                placeholder={type === "BY_LOCATION" ? "Tìm vị trí (vd: AA-01)..." : "Tìm mã hàng / tên..."} 
                className="flex-1 bg-transparent py-2 text-sm focus:outline-none" 
              />
              {query && <button onClick={() => setQuery("")} className="material-symbols-outlined text-[18px] text-on-surface-variant/70">close</button>}
            </div>

            <div className="max-h-[300px] overflow-y-auto border border-outline-variant rounded-lg">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-xs text-on-surface-variant">Không tìm thấy kết quả khớp.</div>
              ) : (
                filteredOptions.map(o => (
                  <label key={o.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-low border-b border-outline-variant/30 last:border-b-0 cursor-pointer">
                    <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={() => toggleId(o.id)} className="rounded border-outline-variant" />
                    <span className="text-sm">{o.label}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <button onClick={handleSubmit} disabled={saving || selectedIds.length === 0} className="w-full px-5 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover flex items-center justify-center gap-2 disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "check_circle"}</span> Tạo phiên kiểm kê ({selectedIds.length} mục)
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
