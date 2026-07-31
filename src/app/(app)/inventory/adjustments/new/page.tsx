"use client";
import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import Link from "next/link";

type ItemCode = { id: string; code: string; short_name: string; unit?: { name: string } };
type LocationRow = { id: string; code: string };
type PalletRow = { id: string; code: string };

type AdjustLine = {
  item_code_id: string;
  item_code_display: string;
  item_name_display: string;
  location_id: string;
  pallet_id: string;
  lot: string;
  qty_before: number;
  qty_adjust: number;
  note: string;
};

const TYPES = [
  { value: "DECREASE", label: "↓ Giảm tồn", color: "text-rose-600 bg-rose-50 border-rose-200" },
  { value: "INCREASE", label: "↑ Tăng tồn", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { value: "STOCKTAKE_RESOLVE", label: "📋 Xử lý chênh lệch kiểm kê", color: "text-blue-600 bg-blue-50 border-blue-200" },
];

const REASON_CODES = [
  { value: "BROKEN", label: "Hàng hỏng / vỡ" },
  { value: "LOST", label: "Hàng mất / thiếu" },
  { value: "STOCKTAKE", label: "Chênh lệch sau kiểm kê" },
  { value: "OTHER", label: "Khác" },
];

const emptyLine = (): AdjustLine => ({
  item_code_id: "", item_code_display: "", item_name_display: "",
  location_id: "", pallet_id: "", lot: "",
  qty_before: 0, qty_adjust: 0, note: "",
});

function NewAdjustmentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [type, setType] = useState("DECREASE");
  const [reasonCode, setReasonCode] = useState("BROKEN");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<AdjustLine[]>([emptyLine()]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [pallets, setPallets] = useState<PalletRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [prefillBanner, setPrefillBanner] = useState<string | null>(null);

  // Item code search per line
  const [searchStates, setSearchStates] = useState<Record<number, { query: string; results: ItemCode[]; show: boolean }>>({});
  const debounceRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    fetch(`${basePath}/api/locations`).then(r => r.json()).then(r => { if (r.success) setLocations(r.data || []); });
    fetch(`${basePath}/api/pallets?status=IN_STORAGE,IN_STAGING`).then(r => r.json()).then(r => { if (r.success) setPallets((r.data || []).map((p: PalletRow) => ({ id: p.id, code: p.code }))); });
  }, [basePath]);

  // Pre-fill từ query string (vd: mở từ /inventory/by-location)
  useEffect(() => {
    const palletId = searchParams.get("pallet_id");
    const palletCode = searchParams.get("pallet_code");
    const itemCodeId = searchParams.get("item_code_id");
    const itemCode = searchParams.get("item_code");
    const itemName = searchParams.get("item_name") || "";
    const locationId = searchParams.get("location_id");
    const locationCode = searchParams.get("location_code");
    const lot = searchParams.get("lot") || "";
    const qtyBefore = Number(searchParams.get("qty_before") || 0);
    const from = searchParams.get("from");

    if (!palletId && !itemCodeId) return;
    setLines((prev) => {
      const next = [...prev];
      next[0] = {
        ...next[0],
        item_code_id: itemCodeId || "",
        item_code_display: itemCode || "",
        item_name_display: itemName,
        location_id: locationId || "",
        pallet_id: palletId || "",
        lot,
        qty_before: qtyBefore,
        qty_adjust: 0,
        note: "",
      };
      return next;
    });
    if (from === "by-location" && palletCode && locationCode) {
      setPrefillBanner(`Đã pre-fill từ vị trí ${locationCode} · pallet ${palletCode}${lot ? ` · lô ${lot}` : ""}. Nhập SL thực + lý do để gửi duyệt.`);
    }
  }, [searchParams]);

  const searchItemCodes = useCallback(async (idx: number, query: string) => {
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
    setLines(next);
    if (debounceRef.current[idx]) clearTimeout(debounceRef.current[idx]);
    debounceRef.current[idx] = setTimeout(() => searchItemCodes(idx, value), 300);
  };

  const selectItem = (idx: number, item: ItemCode) => {
    const next = [...lines];
    next[idx].item_code_id = item.id;
    next[idx].item_code_display = item.code;
    next[idx].item_name_display = item.short_name;
    setLines(next);
    setSearchStates(prev => ({ ...prev, [idx]: { query: "", results: [], show: false } }));
  };

  const updateLine = (idx: number, field: keyof AdjustLine, value: string | number) => {
    const next = [...lines];
    (next[idx] as Record<string, string | number>)[field] = value;
    setLines(next);
  };

  const addLine = () => setLines([...lines, emptyLine()]);
  const removeLine = (idx: number) => { if (lines.length > 1) setLines(lines.filter((_, i) => i !== idx)); };

  const totalAdjust = lines.reduce((s, l) => s + (Number(l.qty_adjust) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!reason.trim()) { setError("Vui lòng điền lý do chung."); return; }
    const validLines = lines.filter(l => l.item_code_id);
    if (validLines.length === 0) { setError("Phải có ít nhất 1 dòng hợp lệ (chọn mã hàng)."); return; }
    for (const l of validLines) {
      if (l.qty_adjust === 0) { setError("Số lượng điều chỉnh phải khác 0."); return; }
      if (type === "DECREASE" && l.qty_adjust > 0) { setError("Loại giảm tồn — SL điều chỉnh phải âm (-)."); return; }
      if (type === "INCREASE" && l.qty_adjust < 0) { setError("Loại tăng tồn — SL điều chỉnh phải dương (+)."); return; }
    }

    setSaving(true);
    try {
      const res = await fetch("/wms/api/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type, reason_code: reasonCode, reason: reason.trim(),
          lines: validLines.map(l => ({
            item_code_id: l.item_code_id,
            location_id: l.location_id || undefined,
            pallet_id: l.pallet_id || undefined,
            lot: l.lot || undefined,
            qty_before: Number(l.qty_before),
            qty_adjust: Number(l.qty_adjust),
            note: l.note || undefined,
          })),
        }),
      });
      const result = await res.json();
      if (result.success) {
        router.push(`/inventory/adjustments`);
      } else {
        setError(result.error || "Lỗi khi tạo phiếu.");
        setSaving(false);
      }
    } catch (err) { console.error(err); setError("Lỗi kết nối."); setSaving(false); }
  };

  return (
    <AppLayout title="TẠO PHIẾU ĐIỀU CHỈNH">
      <div className="p-6 max-w-5xl space-y-5">
        <BackButton fallback="/inventory/adjustments">Quay lại danh sách</BackButton>
        <div>
          <h1 className="text-2xl font-bold text-primary">Tạo phiếu điều chỉnh tồn</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">Tạo phiếu DCT-YYYY-NNN — gửi Quản lý duyệt sau khi tạo.</p>
        </div>

        {prefillBanner && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] flex-shrink-0">auto_awesome</span>
            <span>{prefillBanner}</span>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section: Loại + Lý do */}
          <div className="bg-white rounded-xl border border-outline-variant p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">tune</span>
              Loại điều chỉnh & lý do
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setType(t.value)}
                  className={`px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all text-left ${type === t.value ? `${t.color} ring-2 ring-offset-1` : "bg-white border-outline-variant hover:border-outline-variant"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Mã lý do <span className="text-rose-500">*</span></label>
              <select value={reasonCode} onChange={e => setReasonCode(e.target.value)} required className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                {REASON_CODES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Mô tả lý do <span className="text-rose-500">*</span></label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} required rows={2} placeholder="Mô tả chi tiết lý do điều chỉnh (vd: hàng vỡ do rơi, lô X đã hết hạn...)" className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
            </div>
          </div>

          {/* Section: Dòng điều chỉnh */}
          <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">list_alt</span>
                Dòng điều chỉnh ({lines.length})
              </h2>
              <button type="button" onClick={addLine} className="px-4 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 font-semibold flex items-center gap-1 transition-colors">
                <span className="material-symbols-outlined text-[16px]">add</span>Thêm dòng
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 1000 }}>
                <thead>
                  <tr className="bg-surface-low border-b border-outline-variant">
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-10">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-[200px]">Mã hàng</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-[140px]">Vị trí</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-[140px]">Pallet</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-[100px]">Lô</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-[100px]">SL trước</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-[100px]">Điều chỉnh</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant w-[100px]">SL sau</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase text-on-surface-variant min-w-[140px]">Ghi chú</th>
                    <th className="text-center px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="border-b border-outline-variant/40 hover:bg-surface-low/50">
                      <td className="px-4 py-2 text-on-surface-variant font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-2 relative">
                        <input type="text" value={line.item_code_display} onChange={e => handleItemInput(idx, e.target.value)}
                          onBlur={() => setTimeout(() => setSearchStates(prev => ({ ...prev, [idx]: { ...prev[idx], show: false } })), 200)}
                          placeholder="Tìm mã..." className={`w-full px-2 py-1.5 text-xs border rounded font-mono ${line.item_code_id ? "border-emerald-400 bg-emerald-50/20" : "border-outline-variant"}`} />
                        {searchStates[idx]?.show && searchStates[idx]?.results?.length > 0 && (
                          <div className="absolute top-full left-4 right-4 z-20 bg-white border border-outline-variant rounded-lg shadow-lg mt-1 max-h-[180px] overflow-y-auto">
                            {searchStates[idx].results.map(item => (
                              <button key={item.id} type="button" onMouseDown={() => selectItem(idx, item)}
                                className="w-full px-3 py-1.5 text-left text-xs hover:bg-primary/5 flex items-center gap-2 border-b border-outline-variant/30 last:border-b-0">
                                <span className="font-mono font-bold text-primary">{item.code}</span>
                                <span className="text-on-surface-variant">{item.short_name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {line.item_name_display && <p className="text-[10px] text-on-surface-variant mt-0.5 truncate">{line.item_name_display}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <select value={line.location_id} onChange={e => updateLine(idx, "location_id", e.target.value)} className="w-full px-2 py-1.5 text-xs border border-outline-variant rounded bg-white">
                          <option value="">—</option>
                          {locations.map(l => <option key={l.id} value={l.id}>{l.code}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select value={line.pallet_id} onChange={e => updateLine(idx, "pallet_id", e.target.value)} className="w-full px-2 py-1.5 text-xs border border-outline-variant rounded bg-white">
                          <option value="">—</option>
                          {pallets.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" value={line.lot} onChange={e => updateLine(idx, "lot", e.target.value)} placeholder="Lô..." className="w-full px-2 py-1.5 text-xs border border-outline-variant rounded font-mono" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" value={line.qty_before} onChange={e => updateLine(idx, "qty_before", parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-xs border border-outline-variant rounded text-right font-mono" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" value={line.qty_adjust} onChange={e => updateLine(idx, "qty_adjust", parseFloat(e.target.value) || 0)}
                          className={`w-full px-2 py-1.5 text-xs border rounded text-right font-mono font-bold ${line.qty_adjust > 0 ? "text-emerald-700 border-emerald-300 bg-emerald-50/20" : line.qty_adjust < 0 ? "text-rose-700 border-rose-300 bg-rose-50/20" : "border-outline-variant"}`} />
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs font-semibold text-primary">
                        {(Number(line.qty_before) + Number(line.qty_adjust)).toFixed(0)}
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" value={line.note} onChange={e => updateLine(idx, "note", e.target.value)} placeholder="Ghi chú..." className="w-full px-2 py-1.5 text-xs border border-outline-variant rounded" />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button type="button" onClick={() => removeLine(idx)} disabled={lines.length === 1} className="p-1.5 rounded-lg hover:bg-rose-50 text-on-surface-variant/70 hover:text-rose-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-surface-low border-t border-outline-variant px-6 py-3 flex items-center justify-between text-sm">
              <span className="text-on-surface-variant font-semibold">Tổng dòng: <span className="text-primary font-bold font-mono text-base">{lines.length}</span></span>
              <span className="text-on-surface-variant font-semibold">Tổng SL điều chỉnh: <span className={`font-bold font-mono text-base ${totalAdjust > 0 ? "text-emerald-700" : totalAdjust < 0 ? "text-rose-700" : "text-on-surface"}`}>{totalAdjust > 0 ? "+" : ""}{totalAdjust}</span></span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="px-6 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "save"}</span>
              {saving ? "Đang lưu..." : "Tạo phiếu & Gửi duyệt"}
            </button>
            <Link href="/inventory/adjustments" className="px-6 py-3 border border-outline-variant text-on-surface bg-white rounded-lg text-sm font-semibold hover:bg-surface-low transition-colors">
              Hủy
            </Link>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewAdjustmentPage() {
  return (
    <Suspense fallback={
      <AppLayout title="TẠO PHIẾU ĐIỀU CHỈNH">
        <div className="p-6 flex justify-center"><span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span></div>
      </AppLayout>
    }>
      <NewAdjustmentInner />
    </Suspense>
  );
}
