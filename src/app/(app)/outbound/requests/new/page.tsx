"use client";
import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";

type ItemCode = { id: string; code: string; short_name: string; unit?: { name: string; symbol: string } };

type LineItem = {
  item_code_id: string;
  item_code_display: string;
  item_name_display: string;
  unit_display: string;
  qty_requested: number;
  note: string;
};

export default function NewOutboundRequestPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState("");
  const [shipDate, setShipDate] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ item_code_id: "", item_code_display: "", item_name_display: "", unit_display: "—", qty_requested: 1, note: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Item search per line
  const [searchStates, setSearchStates] = useState<Record<number, { query: string; results: ItemCode[]; show: boolean }>>({});
  const debounceRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const searchItems = useCallback(async (idx: number, query: string) => {
    if (!query || query.length < 1) { setSearchStates(prev => ({ ...prev, [idx]: { query, results: [], show: false } })); return; }
    try {
      const res = await fetch(`/wms/api/item-codes?q=${encodeURIComponent(query)}`);
      const result = await res.json();
      if (result.success) setSearchStates(prev => ({ ...prev, [idx]: { query, results: result.data || [], show: true } }));
    } catch (err) { console.error(err); }
  }, []);

  const handleItemInput = (idx: number, value: string) => {
    const next = [...lines];
    next[idx].item_code_display = value;
    next[idx].item_code_id = "";
    next[idx].item_name_display = "";
    next[idx].unit_display = "—";
    setLines(next);
    if (debounceRef.current[idx]) clearTimeout(debounceRef.current[idx]);
    debounceRef.current[idx] = setTimeout(() => searchItems(idx, value), 300);
  };

  const selectItem = (idx: number, item: ItemCode) => {
    const next = [...lines];
    next[idx].item_code_id = item.id;
    next[idx].item_code_display = item.code;
    next[idx].item_name_display = item.short_name;
    next[idx].unit_display = item.unit?.symbol || item.unit?.name || "—";
    setLines(next);
    setSearchStates(prev => ({ ...prev, [idx]: { query: "", results: [], show: false } }));
  };

  const updateLine = (idx: number, field: keyof LineItem, value: string | number) => {
    const next = [...lines];
    (next[idx] as Record<string, string | number>)[field] = value;
    setLines(next);
  };

  const addLine = () => setLines([...lines, { item_code_id: "", item_code_display: "", item_name_display: "", unit_display: "—", qty_requested: 1, note: "" }]);
  const removeLine = (idx: number) => { if (lines.length > 1) setLines(lines.filter((_, i) => i !== idx)); };

  const totalLines = lines.length;
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty_requested) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!customer.trim()) { setError("Vui lòng điền tên khách hàng."); return; }
    const validLines = lines.filter(l => l.item_code_id);
    if (validLines.length === 0) { setError("Phải có ít nhất 1 dòng hàng hợp lệ (chọn mã hàng)."); return; }
    for (const l of validLines) {
      if (l.qty_requested <= 0) { setError("SL yêu cầu phải > 0."); return; }
    }

    setSaving(true);
    try {
      const res = await fetch("/wms/api/outbound/requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: customer.trim(), ship_date: shipDate || null, note: note.trim() || null,
          lines: validLines.map(l => ({ item_code_id: l.item_code_id, qty_requested: l.qty_requested, note: l.note || null })),
        }),
      });
      const result = await res.json();
      if (result.success) router.push(`/outbound/requests/${result.data.id}`);
      else { setError(result.error || "Lỗi tạo phiếu."); setSaving(false); }
    } catch (err) { console.error(err); setError("Lỗi kết nối."); setSaving(false); }
  };

  return (
    <AppLayout title="TẠO PHIẾU PYX">
      <div className="p-6 max-w-5xl space-y-5">
        <BackButton fallback="/outbound/requests">Quay lại danh sách</BackButton>

        <div>
          <h1 className="text-2xl font-bold text-primary">Tạo phiếu yêu cầu xuất (PYX)</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">Mã tự sinh PYX-YYYY-NNNN. Sau khi tạo → Quản lý duyệt → Thủ kho/Xe nâng giao hàng.</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section: Thông tin chung */}
          <div className="bg-white rounded-xl border border-outline-variant p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">info</span>Thông tin phiếu
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Khách hàng / Người nhận <span className="text-rose-500">*</span></label>
                <input type="text" value={customer} onChange={e => setCustomer(e.target.value)} required placeholder="VD: Cửa hàng A, NPP miền Bắc..."
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Ngày giao dự kiến</label>
                <input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Ghi chú</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..."
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            </div>
          </div>

          {/* Section: Dòng hàng */}
          <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">list_alt</span>Dòng hàng ({lines.length})
              </h2>
              <button type="button" onClick={addLine} className="px-4 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">add</span>Thêm dòng
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 800 }}>
                <thead className="bg-surface-low border-b border-outline-variant">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-10">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-[220px]">Mã hàng</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant">Tên hàng</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-[100px]">ĐVT</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-[120px]">SL yêu cầu</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant min-w-[140px]">Ghi chú dòng</th>
                    <th className="text-center px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="border-b border-outline-variant/40 hover:bg-surface-low/50">
                      <td className="px-4 py-2 text-on-surface-variant/70 font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-2 relative">
                        <input type="text" value={line.item_code_display} onChange={e => handleItemInput(idx, e.target.value)}
                          onBlur={() => setTimeout(() => setSearchStates(prev => ({ ...prev, [idx]: { ...prev[idx], show: false } })), 200)}
                          placeholder="Nhập mã..." className={`w-full px-3 py-1.5 text-sm border rounded-lg font-mono ${line.item_code_id ? "border-emerald-400 bg-emerald-50/20" : "border-outline-variant"}`} />
                        {searchStates[idx]?.show && searchStates[idx]?.results?.length > 0 && (
                          <div className="absolute top-full left-4 right-4 z-20 bg-white border border-outline-variant rounded-lg shadow-lg mt-1 max-h-[200px] overflow-y-auto">
                            {searchStates[idx].results.map(item => (
                              <button key={item.id} type="button" onMouseDown={() => selectItem(idx, item)}
                                className="w-full px-3 py-2 text-left text-xs hover:bg-primary/5 flex items-center gap-2 border-b border-outline-variant/30 last:border-b-0">
                                <span className="font-mono font-bold text-primary">{item.code}</span>
                                <span className="text-on-surface-variant">{item.short_name}</span>
                                {item.unit && <span className="text-[10px] bg-surface-low px-1 rounded text-on-surface-variant">{item.unit.symbol || item.unit.name}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm">{line.item_name_display || "—"}</td>
                      <td className="px-4 py-2 text-xs">
                        <span className="px-2 py-0.5 bg-surface-low rounded text-on-surface-variant font-semibold">{line.unit_display}</span>
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" min={1} step="0.01" value={line.qty_requested} onChange={e => updateLine(idx, "qty_requested", parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-1.5 text-sm border border-outline-variant rounded-lg text-right font-mono font-semibold" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" value={line.note} onChange={e => updateLine(idx, "note", e.target.value)} placeholder="..." className="w-full px-2 py-1.5 text-xs border border-outline-variant rounded" />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button type="button" onClick={() => removeLine(idx)} disabled={lines.length === 1}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-on-surface-variant/70 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed">
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-surface-low border-t border-outline-variant px-6 py-3 flex items-center justify-between text-sm">
              <span className="font-semibold text-on-surface-variant">Tổng dòng: <span className="text-primary font-bold font-mono text-base">{totalLines}</span></span>
              <span className="font-semibold text-on-surface-variant">Tổng SL yêu cầu: <span className="text-primary font-bold font-mono text-base">{totalQty}</span></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="px-6 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 disabled:opacity-50 shadow-sm">
              <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "save"}</span>
              {saving ? "Đang tạo..." : "Tạo phiếu PYX"}
            </button>
            <Link href="/outbound/requests" className="px-6 py-3 border border-outline-variant text-on-surface bg-white rounded-lg text-sm font-semibold hover:bg-surface-low">Hủy</Link>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
