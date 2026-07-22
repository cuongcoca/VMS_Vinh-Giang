"use client";
import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import { useToast } from "@/components/ui";
import Link from "next/link";

type ReorderItem = {
  item_code_id: string; item_code: string; item_name: string;
  group_code: string | null; group_name: string | null; unit_name: string | null;
  current_stock: number; min_stock: number; max_stock: number;
  avg_per_day: number; demand_n_days: number;
  shortage: number; days_left: number | null;
  category: "SHORT_SEVERE" | "SHORT_WARN" | "OK" | "SLOW" | "OUT_OF_STOCK";
  history_qty: number; history_moves: number;
};

const CATEGORIES = {
  SHORT_SEVERE: { label: "🔴 Thiếu nhiều", color: "bg-rose-50 text-rose-700 border-rose-200", row: "bg-rose-50/30" },
  SHORT_WARN: { label: "🟡 Sắp thiếu", color: "bg-amber-50 text-amber-700 border-amber-200", row: "bg-amber-50/20" },
  OUT_OF_STOCK: { label: "⚫ Hết hàng", color: "bg-surface-mid text-on-surface border-outline-variant", row: "bg-surface-low" },
  SLOW: { label: "🐌 Bán chậm", color: "bg-blue-50 text-blue-700 border-blue-200", row: "" },
  OK: { label: "🟢 Đủ", color: "bg-emerald-50 text-emerald-700 border-emerald-200", row: "" },
};

export default function ReorderPage() {
  const [data, setData] = useState<ReorderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysReserve, setDaysReserve] = useState<number | "">(14);
  const [lookback, setLookback] = useState(30);
  const [filterCategory, setFilterCategory] = useState<keyof typeof CATEGORIES | "ALL">("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchData = () => {
    setLoading(true);
    fetch(`/wms/api/outbound/reorder-suggest?days=${daysReserve || 14}&lookback=${lookback || 30}`)
      .then(r => r.json())
      .then(r => { if (r.success) setData(r.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const summary = useMemo(() => {
    const acc = { SHORT_SEVERE: 0, SHORT_WARN: 0, OK: 0, SLOW: 0, OUT_OF_STOCK: 0 };
    data.forEach(d => { acc[d.category] = (acc[d.category] || 0) + 1; });
    return acc;
  }, [data]);

  const filtered = filterCategory === "ALL" ? data : data.filter(d => d.category === filterCategory);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllInView = () => {
    const ids = filtered.filter(d => d.category === "SHORT_SEVERE" || d.category === "SHORT_WARN" || d.category === "OUT_OF_STOCK").map(d => d.item_code_id);
    setSelected(new Set(ids));
  };

  const createInboundFromSelected = () => {
    const selectedItems = data.filter(d => selected.has(d.item_code_id));
    if (selectedItems.length === 0) return;
    // Encode prefill data vào URL query (BE inbound/new sẽ đọc)
    const prefill = encodeURIComponent(JSON.stringify(selectedItems.map(s => ({
      item_code_id: s.item_code_id,
      item_code: s.item_code,
      item_name: s.item_name,
      qty: s.shortage,
      unit_name: s.unit_name,
    }))));
    window.location.href = `/wms/inbound/new?prefill=${prefill}`;
  };

  return (
    <AppLayout title="GỢI Ý NHẬP HÀNG">
      <div className="p-6 space-y-5">
        <BackButton fallback="/outbound">Quay lại</BackButton>

        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[28px]">analytics</span> Gợi ý nhập hàng
            </h1>
            <p className="text-sm text-on-surface-variant mt-0.5">Dựa trên <b>forecast bình quân xuất × số ngày dự trữ</b> (mockup UC-OUT-04).</p>
          </div>
        </div>

        {/* Filter input */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4 flex flex-col sm:flex-row items-end gap-3">
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Số ngày dự trữ</label>
            <input type="number" min={1} max={180} value={daysReserve} onChange={e => {
                const v = e.target.value;
                // TC_OUT04_013/014: hiển thị ĐÚNG giá trị người dùng gõ (kể cả rỗng / 0),
                // KHÔNG thầm lặng kẹp về 1 hay 14. Validate khi bấm "Tính lại".
                setDaysReserve(v === "" ? "" : Number(v));
              }}
              className="w-32 px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Lookback (ngày)</label>
            <input type="number" min={7} max={365} value={lookback} onChange={e => setLookback(Math.max(7, Number(e.target.value) || 30))}
              className="w-32 px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <button
            onClick={() => {
              // TC_OUT04_013/014: validate số ngày dự trữ thay vì tự về 14.
              if (daysReserve === "" || !Number.isFinite(daysReserve) || daysReserve < 1) {
                toast.warning("Vui lòng nhập số ngày dự trữ (tối thiểu 1 ngày).");
                return;
              }
              fetchData();
            }}
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">{loading ? "progress_activity" : "refresh"}</span>
            Tính lại
          </button>
          <span className="text-xs text-on-surface-variant pb-2">Tổng {data.length} mã hàng</span>
        </div>

        {/* KPI 5 box */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(Object.keys(CATEGORIES) as Array<keyof typeof CATEGORIES>).map(cat => (
            <button key={cat} onClick={() => setFilterCategory(filterCategory === cat ? "ALL" : cat)}
              className={`text-left p-4 rounded-xl border shadow-sm hover:shadow-md transition-all ${CATEGORIES[cat].color} ${filterCategory === cat ? "ring-2 ring-offset-1" : ""}`}>
              <div className="text-xs font-semibold uppercase">{CATEGORIES[cat].label}</div>
              <div className="text-2xl font-bold font-mono mt-1">{summary[cat] || 0}</div>
            </button>
          ))}
        </div>

        {/* Action bar */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-3 flex flex-wrap items-center gap-3">
          {filterCategory !== "ALL" && (
            <button onClick={() => setFilterCategory("ALL")} className="px-3 py-1.5 bg-surface-low text-on-surface-variant rounded-lg text-xs font-semibold hover:bg-surface-mid flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">close</span>Bỏ filter {CATEGORIES[filterCategory].label}
            </button>
          )}
          <button onClick={selectAllInView} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">checklist</span>Chọn tất cả mã thiếu
          </button>
          {selected.size > 0 && (
            <span className="text-xs text-on-surface-variant">Đã chọn <b className="text-primary">{selected.size}</b> mã</span>
          )}
          {/* TC_OUT04_018: nút luôn hiển thị; chưa chọn SP thì xám + bấm vào báo lỗi (thay vì ẩn hẳn). */}
          <button
            onClick={() => {
              if (selected.size === 0) {
                toast.warning("Vui lòng chọn ít nhất 1 sản phẩm trước khi tạo phiếu.");
                return;
              }
              createInboundFromSelected();
            }}
            className={`ml-auto px-4 py-2 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors ${
              selected.size > 0
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-rose-600 hover:bg-rose-700"
            }`}>
            <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
            {selected.size > 0 ? `Tạo phiếu nhập từ ${selected.size} mã đã chọn` : "Tạo phiếu nhập"}
          </button>
          <span className="text-xs text-on-surface-variant ml-auto">Hiển thị {filtered.length}/{data.length}</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 1100 }}>
              <thead>
                <tr className="bg-surface-low/50 border-b border-outline-variant">
                  <th className="text-left px-3 py-2.5 w-10"><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(filtered.map(d => d.item_code_id)) : new Set())} className="rounded border-outline-variant" /></th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Mã hàng</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tên</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Nhóm</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tồn HT</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">BQ xuất/ngày</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Nhu cầu {daysReserve}d</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Cần nhập</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Còn lại</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Cảnh báo</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="text-center py-12"><span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[40px] opacity-30">check_circle</span>
                    <p className="mt-2 text-sm">Không có mã hàng nào trong nhóm "{filterCategory === "ALL" ? "tất cả" : CATEGORIES[filterCategory].label}".</p>
                  </td></tr>
                ) : filtered.map(row => {
                  const cat = CATEGORIES[row.category];
                  const isSel = selected.has(row.item_code_id);
                  return (
                    <tr key={row.item_code_id} className={`border-b border-outline-variant/40 hover:bg-surface-low/50 transition-colors ${cat.row} ${isSel ? "ring-2 ring-inset ring-primary/30" : ""}`}>
                      <td className="px-3 py-2.5"><input type="checkbox" checked={isSel} onChange={() => toggleSelect(row.item_code_id)} className="rounded border-outline-variant" /></td>
                      <td className="px-4 py-2.5 font-mono font-bold text-primary text-sm">{row.item_code}</td>
                      <td className="px-4 py-2.5">{row.item_name}</td>
                      <td className="px-4 py-2.5 text-xs hidden md:table-cell">{row.group_code ? <span className="inline-flex px-1.5 py-0.5 rounded bg-surface-low text-on-surface-variant font-semibold">{row.group_code}</span> : <span className="text-on-surface-variant/70">—</span>}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">{row.current_stock}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-indigo-600 font-semibold">{row.avg_per_day}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold">{row.demand_n_days}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-bold ${row.shortage > 0 ? "text-rose-600" : "text-emerald-600"}`}>{row.shortage > 0 ? row.shortage : "—"}</td>
                      <td className={`px-4 py-2.5 text-right font-mono text-xs hidden md:table-cell ${row.days_left === null ? "text-on-surface-variant/70" : row.days_left <= 7 ? "text-rose-600 font-bold" : row.days_left <= 14 ? "text-amber-600" : "text-emerald-600"}`}>
                        {row.days_left === null ? "∞" : `${row.days_left}d`}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${cat.color}`}>{cat.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-xs text-on-surface-variant/70 flex items-center gap-2 pt-2">
          <span className="material-symbols-outlined text-[14px]">info</span>
          <span>Công thức: <b>Nhu cầu N ngày = BQ xuất × Ngày dự trữ</b>. Mã hàng "Bán chậm" có tồn nhưng 0 lượt xuất {lookback} ngày qua.</span>
        </div>
      </div>
    </AppLayout>
  );
}
