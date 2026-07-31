"use client";
import React, { useState, useEffect, useRef } from "react";
// Phase 3.2: KHÔNG dùng AppLayout (đây là page mobile, layout đã có sẵn từ forklift/layout.tsx)
import Link from "next/link";
import dynamic from "next/dynamic";
import { BackButton } from "@/components/BackButton";
import { MobileToast } from "@/components/mobile";

// Phase 6 UI — UC-FK-04_TC03: lazy load barcode scanner cho mã hàng
const BarcodeScannerModal = dynamic(
  () => import("@/components/shared/BarcodeScannerModal").then((m) => m.BarcodeScannerModal),
  { ssr: false }
);

type ItemCodeOption = { id: string; code: string; short_name: string };
type FefoSuggestion = {
  pallet_line_id: string; qty_box: string; lot: string | null;
  expiry_date: string | null; days_until_expiry: number | null;
  urgency: "critical" | "warning" | "normal";
  pallet: { id: string; code: string; total_lines?: number; location?: { id: string; code: string; zone: string } | null; supplier?: { name: string } | null };
  item_code: ItemCodeOption;
};
// Vị trí khu chờ xuất (OUTBOUND_STAGING)
type StagingLocation = { id: string; code: string; pallet_count?: number };

// Phase 6 UI — Row 70: pallet đã ở khu chờ xuất (đã rút 1 phần / xuất nguyên)
type StagedPallet = {
  id: string;
  code: string;
  parent_pallet_id: string | null;
  parent: { id: string; code: string } | null;
  location: { code: string; zone: string } | null;
  total_lines: number;
  lines: Array<{ id: string; qty_box: string; item_code: { id: string; code: string; short_name: string } }>;
};

const URGENCY_MAP = {
  critical: { label: "🔴 Sắp hết hạn", color: "bg-rose-50 text-rose-700 border-rose-200" },
  warning: { label: "🟡 Cận hạn", color: "bg-amber-50 text-amber-700 border-amber-200" },
  normal: { label: "🟢 Bình thường", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export default function StageOutPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [itemSearch, setItemSearch] = useState("");
  const [itemOptions, setItemOptions] = useState<ItemCodeOption[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemCodeOption | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [suggestions, setSuggestions] = useState<FefoSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // UC-FK-04: Modal chọn TH-A (rút nguyên) vs TH-B (rút một phần) + vị trí staging
  const [extractModal, setExtractModal] = useState<{ pallet: FefoSuggestion; mode: "A" | "B"; partialQty: number; stagingLocationId: string } | null>(null);
  const [stagingLocations, setStagingLocations] = useState<StagingLocation[]>([]);
  const [loadingStaging, setLoadingStaging] = useState(false);

  // Phase 6 UI — UC-FK-04_TC03: QR scan mã hàng
  const [scannerOpen, setScannerOpen] = useState(false);

  // Phase 6 UI — Row 70: pallet đã chuyển sang khu chờ xuất cho item này
  const [stagedPallets, setStagedPallets] = useState<StagedPallet[]>([]);
  const [loadingStaged, setLoadingStaged] = useState(false);

  const searchItems = async (q: string) => {
    if (q.length < 1) { setItemOptions([]); return; }
    try {
      const res = await fetch(`${basePath}/api/item-codes?q=${encodeURIComponent(q)}`);
      const result = await res.json();
      if (result.success) setItemOptions(result.data);
    } catch (err) { console.error(err); }
  };

  const handleSearch = (v: string) => {
    setItemSearch(v); setShowSearch(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchItems(v), 300);
  };

  const handleSelectItem = (item: ItemCodeOption) => {
    setSelectedItem(item); setItemSearch(""); setShowSearch(false); setItemOptions([]);
    fetchFefo(item.id);
    fetchStaged(item.id);
  };

  // Fetch danh sách vị trí khu chờ xuất (OUTBOUND_STAGING) và số pallet hiện tại
  const fetchStagingLocations = async () => {
    setLoadingStaging(true);
    try {
      const res = await fetch(`${basePath}/api/locations?type=OUTBOUND_STAGING&active=true`);
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        setStagingLocations(result.data);
        return result.data as StagingLocation[];
      }
    } catch (err) { console.error(err); }
    finally { setLoadingStaging(false); }
    return [];
  };

  const fetchFefo = async (itemCodeId: string) => {
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`${basePath}/api/forklift/fefo-suggest?item_code_id=${itemCodeId}`);
      const result = await res.json();
      if (result.success) setSuggestions(result.data);
    } catch (err) { console.error(err); }
    finally { setLoadingSuggestions(false); }
  };

  // Phase 6 UI — Row 70: list pallet IN_STAGING của item này (đã rút 1 phần / nguyên)
  const fetchStaged = async (itemCodeId: string) => {
    setLoadingStaged(true);
    try {
      const res = await fetch(`${basePath}/api/outbound/staging`);
      const result = await res.json();
      if (result.success) {
        const filtered = (result.data as Array<StagedPallet>).filter((p) =>
          p.lines.some((l) => l.item_code.id === itemCodeId)
        );
        setStagedPallets(filtered);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStaged(false);
    }
  };

  // Phase 6 UI — UC-FK-04_TC03: nhận mã từ QR scan → tra item-codes → chọn
  const handleScanItemCode = async (code: string) => {
    setScannerOpen(false);
    try {
      const trimmedCode = code.trim();
      const res = await fetch(`${basePath}/api/item-codes?q=${encodeURIComponent(trimmedCode)}`);
      const result = await res.json();
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        const cleanCode = trimmedCode.toUpperCase();
        const exact = result.data.find((i: any) => {
          const itemCodeVal = (i.code || "").trim().toUpperCase();
          const barcodeVal = (i.product?.barcode || "").trim().toUpperCase();
          const skuVal = (i.product?.sku || "").trim().toUpperCase();
          return itemCodeVal === cleanCode || barcodeVal === cleanCode || skuVal === cleanCode;
        });
        const target = exact || result.data[0];
        handleSelectItem(target);
        setToast({ message: `Đã chọn mã hàng ${target.code}`, type: "success" });
      } else {
        setToast({ message: `Không tìm thấy mã hàng "${trimmedCode}".`, type: "error" });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Lỗi tra cứu mã hàng.", type: "error" });
    }
    setTimeout(() => setToast(null), 3000);
  };

  // UC-FK-04 TH-A: Xuất nguyên pallet
  const handleStageOutFull = async (palletId: string, palletCode: string, stagingLocationId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${basePath}/api/forklift/stage-out`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pallet_id: palletId, mode: "FULL", staging_location_id: stagingLocationId }),
      });
      const result = await res.json();
      if (result.success) {
        setToast({ message: result.message || `Pallet ${palletCode} đã chuyển sang khu chờ xuất.`, type: "success" });
        if (selectedItem) {
          fetchFefo(selectedItem.id);
          fetchStaged(selectedItem.id);
        }
        setExtractModal(null);
      } else setToast({ message: result.error, type: "error" });
    } catch { setToast({ message: "Lỗi kết nối.", type: "error" }); }
    finally { setSaving(false); setTimeout(() => setToast(null), 4000); }
  };

  // UC-FK-04 TH-B: Rút một phần (partial qty)
  const handleStageOutPartial = async (palletId: string, palletLineId: string, palletCode: string, partialQty: number, maxQty: number, stagingLocationId: string) => {
    if (partialQty <= 0 || partialQty > maxQty) {
      setToast({ message: `SL rút phải trong khoảng 1-${maxQty}`, type: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${basePath}/api/forklift/stage-out`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pallet_id: palletId, pallet_line_id: palletLineId, mode: "PARTIAL", partial_qty: partialQty, staging_location_id: stagingLocationId }),
      });
      const result = await res.json();
      if (result.success) {
        setToast({ message: result.message || `Đã rút ${partialQty}/${maxQty} từ pallet ${palletCode}.`, type: "success" });
        if (selectedItem) {
          fetchFefo(selectedItem.id);
          fetchStaged(selectedItem.id);
        }
        setExtractModal(null);
      } else setToast({ message: result.error, type: "error" });
    } catch { setToast({ message: "Lỗi kết nối.", type: "error" }); }
    finally { setSaving(false); setTimeout(() => setToast(null), 4000); }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("vi-VN") : "—";

  return (
    <div className="px-margin-mobile py-md space-y-5">
        <MobileToast toast={toast} />
        <BackButton fallback="/forklift">Quay lại</BackButton>
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[28px]">output</span> Chuyển khu chờ xuất (FEFO)
        </h1>
        <p className="text-sm text-on-surface-variant">Tìm mã hàng → hệ thống gợi ý pallet theo thứ tự hết hạn sớm nhất</p>

        {/* Search item */}
        <div className="bg-white rounded-xl border border-outline-variant p-5 shadow-sm">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Tìm mã hàng cần xuất</label>
          {selectedItem ? (
            <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div><span className="font-mono font-bold text-primary">{selectedItem.code}</span><span className="text-sm ml-2">{selectedItem.short_name}</span></div>
              <button onClick={() => { setSelectedItem(null); setSuggestions([]); }} className="p-1 hover:bg-primary/10 rounded"><span className="material-symbols-outlined text-[18px] text-on-surface-variant/70">close</span></button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
                <input type="text" placeholder="Nhập mã hàng hoặc tên..." value={itemSearch} onChange={e => handleSearch(e.target.value)} onFocus={() => setShowSearch(true)}
                  className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                {showSearch && itemOptions.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-outline-variant rounded-xl shadow-lg max-h-[240px] overflow-y-auto">
                    {itemOptions.map(item => (
                      <button key={item.id} type="button" onClick={() => handleSelectItem(item)}
                        className="w-full text-left px-4 py-3 hover:bg-surface-low transition-colors border-b border-outline-variant/30 last:border-b-0">
                        <span className="font-mono font-bold text-primary text-sm">{item.code}</span>
                        <span className="text-sm text-on-surface ml-2">{item.short_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Phase 6 UI — UC-FK-04_TC03: nút quét QR mã hàng */}
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="px-3 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:bg-on-secondary-container active:scale-95 transition-all flex items-center gap-1.5"
                aria-label="Quét mã hàng"
                title="Quét mã/QR mã hàng để chọn nhanh"
              >
                <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                Quét
              </button>
            </div>
          )}
        </div>

        {/* UC-FK-04 Modal: chọn TH-A (rút nguyên) vs TH-B (rút phần).
            Overlay canh TỪ TRÊN (items-start) + cho cuộn (overflow-y-auto), hộp thoại
            có max-h-[92vh] + overflow-y-auto: khi hộp thoại cao hơn màn hình (pallet
            nhiều mã + rút một phần trên máy màn hình thấp), người dùng vẫn cuộn xuống
            chạm được nút xác nhận. Trước đây items-center + không max-h/overflow →
            nút "Rút…" bị cắt dưới, không bấm được (lỗi "không hiện chỗ xuất"). */}
        {extractModal && (
          <div
            className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
            style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))", paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
            onClick={() => setExtractModal(null)}
          >
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-outline-variant">
                <h3 className="text-lg font-bold text-on-surface flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-500 shrink-0">output</span>
                  <span className="min-w-0">Chuyển <span className="font-mono break-all">{extractModal.pallet.pallet.code}</span> sang khu chờ xuất</span>
                </h3>
                <p className="text-xs text-on-surface-variant mt-1">SL mã <b className="font-mono text-primary">{extractModal.pallet.item_code.code}</b> trong pallet: <b className="font-mono text-primary">{Number(extractModal.pallet.qty_box)}</b> thùng · HSD {extractModal.pallet.expiry_date ? new Date(extractModal.pallet.expiry_date).toLocaleDateString("vi-VN") : "—"}</p>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                                <button
                    type="button"
                    onClick={() => setExtractModal({ ...extractModal, mode: "A", partialQty: Number(extractModal.pallet.qty_box) })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${extractModal.mode === "A" ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "border-outline-variant hover:border-outline-variant"}`}
                  >
                    <div className="font-bold text-primary text-sm">TH-A · Rút nguyên</div>
                    <div className="text-xs text-on-surface-variant mt-1">Chuyển nguyên pallet sang khu chờ xuất — vị trí cũ được giải phóng.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtractModal({ ...extractModal, mode: "B", partialQty: Math.min(10, Number(extractModal.pallet.qty_box)) })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${extractModal.mode === "B" ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "border-outline-variant hover:border-outline-variant"}`}
                  >
                    <div className="font-bold text-primary text-sm">TH-B · Rút một phần</div>
                    <div className="text-xs text-on-surface-variant mt-1">Chỉ xuất một số thùng từ pallet — phần còn lại vẫn ở vị trí cũ.</div>
                  </button>
                </div>

                {extractModal.mode === "A" && (extractModal.pallet.pallet.total_lines ?? 1) > 1 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] flex-shrink-0">warning</span>
                    <span>Pallet này có <b>{extractModal.pallet.pallet.total_lines} mã hàng</b> khác nhau. Rút nguyên sẽ chuyển <b>TẤT CẢ</b> sang khu chờ xuất. Nếu chỉ muốn xuất mã <b className="font-mono">{extractModal.pallet.item_code.code}</b>, hãy chọn <b>TH-B · Rút một phần</b>.</span>
                  </div>
                )}

                {extractModal.mode === "B" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-2">Số thùng cần rút (1 - {Number(extractModal.pallet.qty_box)}) <span className="text-rose-500">*</span></label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setExtractModal({ ...extractModal, partialQty: Math.max(1, extractModal.partialQty - 1) })}
                          className="w-10 h-10 rounded-lg bg-white border border-amber-300 text-amber-700 font-bold hover:bg-amber-100">−</button>
                        <input type="number" min={1} max={Number(extractModal.pallet.qty_box)} value={extractModal.partialQty}
                          onChange={e => setExtractModal({ ...extractModal, partialQty: Math.max(1, Math.min(Number(extractModal.pallet.qty_box), Number(e.target.value) || 1)) })}
                          className="flex-1 px-3 py-2 text-center text-lg font-bold font-mono border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                        <button type="button" onClick={() => setExtractModal({ ...extractModal, partialQty: Math.min(Number(extractModal.pallet.qty_box), extractModal.partialQty + 1) })}
                          className="w-10 h-10 rounded-lg bg-white border border-amber-300 text-amber-700 font-bold hover:bg-amber-100">+</button>
                      </div>
                    </div>
                    <div className="text-xs text-amber-800 bg-white/70 rounded p-2">
                      📊 Sau khi rút: dòng mã <b className="font-mono">{extractModal.pallet.item_code.code}</b> còn <b className="font-mono">{Number(extractModal.pallet.qty_box) - extractModal.partialQty}</b> thùng. Hệ thống tạo <b>pallet con</b> mới ở khu chờ xuất với <b className="font-mono">{extractModal.partialQty}</b> thùng (mã <span className="font-mono">{extractModal.pallet.pallet.code}-P&lt;N&gt;</span>). Nếu rút làm pallet cạn sạch, hệ thống chuyển nguyên pallet cha thay vì tạo con.
                    </div>
                  </div>
                )}

                {/* Selector vị trí khu chờ xuất - BẮt buộc */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <label className="text-xs font-bold text-blue-800 uppercase tracking-wider block">
                    <span className="material-symbols-outlined text-[14px] align-middle mr-1">location_on</span>
                    Vị trí khu chờ xuất <span className="text-rose-500">*</span>
                  </label>
                  {loadingStaging ? (
                    <div className="flex items-center gap-2 text-xs text-blue-600 py-2">
                      <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Đang tải...
                    </div>
                  ) : stagingLocations.length === 0 ? (
                    <div className="text-xs text-rose-600 py-2">
                      ⚠️ Không tìm thấy vị trí khu chờ xuất. Liên hệ quản lý để tạo vị trí OUTBOUND_STAGING.
                    </div>
                  ) : stagingLocations.length === 1 ? (
                    <div className="flex items-center gap-2 p-2 bg-blue-100 rounded-lg">
                      <span className="material-symbols-outlined text-[16px] text-blue-600">check_circle</span>
                      <span className="text-sm font-bold text-blue-800 font-mono">{stagingLocations[0].code}</span>
                      <span className="text-xs text-blue-600">(tự động chọn — chỉ có 1 khu)</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
                      {stagingLocations.map((loc) => (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => setExtractModal({ ...extractModal, stagingLocationId: loc.id })}
                          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg border-2 text-left transition-all ${
                            extractModal.stagingLocationId === loc.id
                              ? "border-blue-500 bg-blue-100"
                              : "border-outline-variant bg-white hover:border-blue-300"
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                            extractModal.stagingLocationId === loc.id ? "border-blue-500 bg-blue-500" : "border-outline-variant"
                          }`} />
                          <span className="font-mono font-bold text-sm text-on-surface">{loc.code}</span>
                          {loc.pallet_count !== undefined && (
                            <span className="ml-auto text-[11px] text-on-surface-variant">
                              {loc.pallet_count === 0 ? "Trống" : `${loc.pallet_count} pallet`}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {!extractModal.stagingLocationId && stagingLocations.length > 1 && (
                    <p className="text-[11px] text-rose-500">Vui lòng chọn vị trí trước khi xác nhận.</p>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 bg-white rounded-b-2xl px-6 py-4 border-t border-outline-variant flex justify-end gap-3">
                <button onClick={() => setExtractModal(null)} className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-low rounded-lg">Hủy</button>
                <button
                  onClick={() => {
                    // Validate vị trí staging
                    const locId = extractModal.stagingLocationId;
                    if (!locId) {
                      setToast({ message: "Vui lòng chọn vị trí khu chờ xuất.", type: "error" });
                      setTimeout(() => setToast(null), 3000);
                      return;
                    }
                    if (extractModal.mode === "A")
                      handleStageOutFull(extractModal.pallet.pallet.id, extractModal.pallet.pallet.code, locId);
                    else
                      handleStageOutPartial(extractModal.pallet.pallet.id, extractModal.pallet.pallet_line_id, extractModal.pallet.pallet.code, extractModal.partialQty, Number(extractModal.pallet.qty_box), locId);
                  }}
                  disabled={saving || !extractModal.stagingLocationId}
                  className="px-5 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[16px]">{saving ? "progress_activity" : "output"}</span>
                  {extractModal.mode === "A"
                    ? `Xuất nguyên (${Number(extractModal.pallet.qty_box)} thùng)${extractModal.stagingLocationId ? ` → ${stagingLocations.find(l => l.id === extractModal.stagingLocationId)?.code || ""}` : ""}`
                    : `Rút ${extractModal.partialQty} thùng${extractModal.stagingLocationId ? ` → ${stagingLocations.find(l => l.id === extractModal.stagingLocationId)?.code || ""}` : ""}`
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phase 6 UI — Row 70: section pallet đã chuyển sang khu chờ xuất
            của item đã chọn (gồm cả pallet con từ split). Trước fix:
            sau khi rút 1 phần, trang không hiển thị phần đã chuyển → user
            không biết kết quả. */}
        {selectedItem && stagedPallets.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-amber-200">
              <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">outbox</span>
                Đã ở khu chờ xuất — {selectedItem.short_name} ({stagedPallets.length} pallet)
              </h3>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Pallet đã được chuyển ra staging, đang chờ xe đến lấy.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-amber-100/50 border-b border-amber-200">
                    <th className="text-left px-4 py-2 font-semibold text-xs uppercase tracking-wider text-amber-800">Pallet</th>
                    <th className="text-left px-4 py-2 font-semibold text-xs uppercase tracking-wider text-amber-800">Pallet cha</th>
                    <th className="text-left px-4 py-2 font-semibold text-xs uppercase tracking-wider text-amber-800">Vị trí</th>
                    <th className="text-right px-4 py-2 font-semibold text-xs uppercase tracking-wider text-amber-800">SL</th>
                  </tr>
                </thead>
                <tbody>
                  {stagedPallets.map((p) => {
                    const itemLines = p.lines.filter((l) => l.item_code.id === selectedItem.id);
                    const qty = itemLines.reduce((sum, l) => sum + Number(l.qty_box), 0);
                    return (
                      <tr key={p.id} className="border-b border-amber-200/60">
                        <td className="px-4 py-2 font-mono font-bold text-amber-900">{p.code}</td>
                        <td className="px-4 py-2 font-mono text-xs text-amber-800">
                          {p.parent ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">call_split</span>
                              {p.parent.code}
                            </span>
                          ) : (
                            <span className="italic text-amber-700/70">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-amber-800">{p.location?.code || "—"}</td>
                        <td className="px-4 py-2 text-right font-semibold text-amber-900">{qty} thùng</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedItem && loadingStaged && (
          <div className="text-center py-4 text-amber-700 text-xs">
            <span className="material-symbols-outlined animate-spin text-[18px] align-middle">progress_activity</span>
            <span className="ml-1">Đang tải khu chờ xuất...</span>
          </div>
        )}

        {/* Phase 6 UI — Modal scan QR mã hàng */}
        <BarcodeScannerModal
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={handleScanItemCode}
          title="Quét mã hàng cần xuất"
          allowManualInput
        />

        {/* FEFO Suggestions */}
        {selectedItem && (
          <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-outline-variant">
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-amber-600">schedule</span>
                Gợi ý FEFO — {selectedItem.short_name} ({suggestions.length} pallet)
              </h3>
            </div>
            {loadingSuggestions ? (
              <div className="flex items-center justify-center py-10"><span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span></div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-8 px-6 text-on-surface-variant">
                <span className="material-symbols-outlined text-[40px] opacity-30">inventory_2</span>
                <p className="mt-2 text-sm font-semibold text-on-surface">
                  Mã <span className="font-mono text-primary">{selectedItem.code}</span> chưa có pallet trong kho
                </p>
                <p className="mt-2 text-xs text-on-surface-variant leading-relaxed max-w-md mx-auto">
                  Chuyển khu chờ xuất chỉ hoạt động với pallet đã ở trạng thái <b>Trong kho (IN_STORAGE)</b>.
                  Vui lòng kiểm tra:
                </p>
                <ul className="text-xs text-on-surface-variant mt-2 space-y-1 text-left max-w-md mx-auto list-disc list-inside">
                  <li>Pallet có chứa mã hàng này đã được <b>thủ kho xác nhận</b> chưa? <Link href="/pallets" className="text-primary hover:underline">→ Vào DS pallet</Link></li>
                  <li>Xe nâng đã <b>xếp pallet vào vị trí kho</b> chưa? <Link href="/forklift/put-away" className="text-primary hover:underline">→ Xếp vị trí</Link></li>
                  <li>Mã hàng đúng với pallet thực tế chưa? (kiểm tra trong pallet)</li>
                </ul>
              </div>
            ) : (
              <ul className="divide-y divide-outline-variant/40">
                {suggestions.map((s) => {
                  const u = URGENCY_MAP[s.urgency];
                  return (
                    <li key={s.pallet_line_id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-primary">{s.pallet.code}</span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${u.color}`}>{u.label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                        <div>Vị trí: <span className="font-semibold text-on-surface">{s.pallet.location?.code || "—"}</span></div>
                        <div>SL: <span className="font-semibold text-on-surface">{Number(s.qty_box)}</span> thùng</div>
                        <div>HSD: <span className="font-semibold text-on-surface">{formatDate(s.expiry_date)}</span></div>
                        <div>Lô: <span className="font-semibold text-on-surface">{s.lot || "—"}</span></div>
                      </div>
                      <button onClick={async () => {
                        const locs = await fetchStagingLocations();
                        const autoLocId = locs.length === 1 ? locs[0].id : "";
                        setExtractModal({ pallet: s, mode: "A", partialQty: Number(s.qty_box), stagingLocationId: autoLocId });
                      }} disabled={saving}
                        className="w-full min-h-[44px] px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">output</span> Xuất pallet này
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
    </div>
  );
}
