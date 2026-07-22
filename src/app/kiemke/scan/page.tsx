"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { mobileHref } from "@/lib/mobile-href";

// UC-INV-06: Modal quét QR vị trí — dynamic vì html5-qrcode chỉ chạy ở client
const BarcodeScannerModal = dynamic(
  () => import("@/components/shared/BarcodeScannerModal").then((m) => m.BarcodeScannerModal),
  { ssr: false }
);

type LineItem = {
  pallet_id: string;
  pallet_code: string;
  line_id: string;
  item_code_id: string;
  item_code: string;
  item_name: string;
  lot: string | null;
  expiry_date: string | null;
  qty_box: number;
};

type LocationDetail = {
  id: string;
  code: string;
  zone: string;
  rack: string;
  level: string;
};

// UC-INV-06: Pallet phát hiện NGOÀI hệ thống khi kiểm kê
type ExtraPallet = {
  tempId: string;
  item_code_id: string;
  item_code: string;
  item_name: string;
  qty: number;
  lot: string;
  expiry: string;
  found_pallet_code: string;
  note: string;
};

export default function KiemkeScanPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [locationCode, setLocationCode] = useState("");
  const [locationData, setLocationData] = useState<LocationDetail | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  // Per item_code_id, aggregate actual qty (1 item_code có thể nhiều line/lô — gộp lại để đếm theo mã)
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  // UC-INV-06: "blind count" — ẩn SL hệ thống trước khi user nhập
  const [blindCount, setBlindCount] = useState(true);

  // UC-INV-06: state cho "Thêm pallet ngoài hệ thống"
  const [extraPallets, setExtraPallets] = useState<ExtraPallet[]>([]);
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [exCodeInput, setExCodeInput] = useState("");
  const [exResolved, setExResolved] = useState<{ id: string; code: string; name: string } | null>(null);
  const [exQty, setExQty] = useState("");
  const [exLot, setExLot] = useState("");
  const [exExpiry, setExExpiry] = useState("");
  const [exFoundCode, setExFoundCode] = useState("");
  const [exNote, setExNote] = useState("");
  const [exLookupErr, setExLookupErr] = useState<string | null>(null);
  const [exLooking, setExLooking] = useState(false);
  const [exScannerOpen, setExScannerOpen] = useState(false);

  const handleSearch = async (overrideCode?: string) => {
    const code = (overrideCode ?? locationCode).trim();
    if (!code) return;
    if (overrideCode) setLocationCode(code);
    setLoading(true);
    setScanError(null);
    try {
      // Fix #1: dùng ?code= (không phải location_id) — đọc detail.lines
      const res = await fetch(
        `${basePath}/api/inventory/by-location?code=${encodeURIComponent(code.toUpperCase())}`
      );
      const json = await res.json();
      if (json.success && json.detail) {
        setLocationData({
          id: json.detail.id,
          code: json.detail.code,
          zone: json.detail.zone,
          rack: json.detail.rack,
          level: json.detail.level,
        });
        setItems(json.detail.lines || []);
        setCounts({});
        setNotes({});
        setExtraPallets([]);
        setShowExtraForm(false);
        setStep(2);
      } else {
        setScanError(json.error || `Không tìm thấy vị trí "${code}"`);
      }
    } catch (e) {
      console.error(e);
      setScanError("Lỗi mạng");
    } finally {
      setLoading(false);
    }
  };

  // UC-INV-06: Quét QR vị trí → tự search
  const handleScanLocation = (scannedCode: string) => {
    setScannerOpen(false);
    handleSearch(scannedCode);
  };

  // UC-INV-06: tra mã hàng cho pallet ngoài hệ thống
  const resolveExtraItem = async (overrideCode?: string) => {
    const code = (overrideCode ?? exCodeInput).trim().toUpperCase();
    if (!code) return;
    if (overrideCode) setExCodeInput(code);
    setExLooking(true);
    setExLookupErr(null);
    try {
      const res = await fetch(`${basePath}/api/item-codes/by-code?code=${encodeURIComponent(code)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setExResolved({
          id: json.data.id,
          code: json.data.code,
          name: json.data.short_name || json.data.product?.name || json.data.code,
        });
      } else {
        setExResolved(null);
        setExLookupErr(json.error || `Không tìm thấy mã hàng "${code}"`);
      }
    } catch {
      setExLookupErr("Lỗi mạng khi tra mã hàng");
    } finally {
      setExLooking(false);
    }
  };

  const addExtraPallet = () => {
    if (!exResolved) {
      setExLookupErr("Vui lòng tra mã hàng trước.");
      return;
    }
    const q = Number(exQty);
    if (Number.isNaN(q) || q <= 0) {
      setExLookupErr("Số lượng phải lớn hơn 0.");
      return;
    }
    setExtraPallets((prev) => [
      ...prev,
      {
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        item_code_id: exResolved.id,
        item_code: exResolved.code,
        item_name: exResolved.name,
        qty: q,
        lot: exLot.trim(),
        expiry: exExpiry,
        found_pallet_code: exFoundCode.trim(),
        note: exNote.trim(),
      },
    ]);
    // reset form
    setShowExtraForm(false);
    setExCodeInput("");
    setExResolved(null);
    setExQty("");
    setExLot("");
    setExExpiry("");
    setExFoundCode("");
    setExNote("");
    setExLookupErr(null);
  };

  const removeExtraPallet = (tempId: string) =>
    setExtraPallets((prev) => prev.filter((p) => p.tempId !== tempId));

  const resetAll = () => {
    setStep(1);
    setLocationCode("");
    setLocationData(null);
    setItems([]);
    setCounts({});
    setNotes({});
    setExtraPallets([]);
    setShowExtraForm(false);
    setScanError(null);
  };

  // Group items theo item_code_id để đếm gộp
  const itemGroups = items.reduce((acc, item) => {
    if (!acc[item.item_code_id]) {
      acc[item.item_code_id] = {
        item_code_id: item.item_code_id,
        item_code: item.item_code,
        item_name: item.item_name,
        system_qty: 0,
        lots: [] as string[],
      };
    }
    acc[item.item_code_id].system_qty += Number(item.qty_box);
    if (item.lot) acc[item.item_code_id].lots.push(item.lot);
    return acc;
  }, {} as Record<string, { item_code_id: string; item_code: string; item_name: string; system_qty: number; lots: string[] }>);
  const groupedItems = Object.values(itemGroups);

  // Fix #1 — handleSave gọi API thực sự
  const handleSave = async () => {
    if (!locationData) return;
    const itemsToSave = groupedItems
      .filter((g) => counts[g.item_code_id] !== undefined && counts[g.item_code_id] !== null)
      .map((g) => ({
        item_code_id: g.item_code_id,
        actual_qty: counts[g.item_code_id],
        note: notes[g.item_code_id] || undefined,
      }));

    // UC-INV-06: payload pallet ngoài hệ thống
    const extrasToSave = extraPallets.map((p) => ({
      item_code_id: p.item_code_id,
      actual_qty: p.qty,
      lot: p.lot || undefined,
      expiry: p.expiry || undefined,
      found_pallet_code: p.found_pallet_code || undefined,
      note: p.note || undefined,
    }));

    if (itemsToSave.length === 0 && extrasToSave.length === 0) {
      setScanError("Vui lòng nhập ít nhất 1 dòng SL thực hoặc thêm 1 pallet ngoài hệ thống.");
      return;
    }

    setSaving(true);
    setScanError(null);
    try {
      const res = await fetch(`${basePath}/api/stock-count/quick-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: locationData.id,
          items: itemsToSave,
          extra_pallets: extrasToSave,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSavedMessage(json.message || "Đã lưu kết quả kiểm kê.");
        // Sau 2s: chuyển sang task detail của session vừa tạo
        setTimeout(() => {
          if (json.session_id) {
            router.push(mobileHref(`/kiemke/tasks/${json.session_id}`));
          } else {
            // Reset form
            setSavedMessage(null);
            resetAll();
          }
        }, 2000);
      } else {
        setScanError(json.error || "Lưu thất bại.");
      }
    } catch (e) {
      console.error(e);
      setScanError("Lỗi kết nối.");
    } finally {
      setSaving(false);
    }
  };

  const totalRows = Object.keys(counts).length + extraPallets.length;

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      <h1 className="text-lg font-bold text-primary flex items-center gap-2">
        <span className="material-symbols-outlined">qr_code_scanner</span> Quét & Đếm nhanh
      </h1>

      {savedMessage && (
        <div className="p-md bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
          <span className="material-symbols-outlined">check_circle</span> {savedMessage}
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-md items-center py-6">
          <div className="w-24 h-24 rounded-2xl bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[48px]">qr_code_scanner</span>
          </div>
          <p className="text-sm text-on-surface-variant text-center">Quét QR vị trí hoặc nhập tay</p>

          <button
            onClick={() => setScannerOpen(true)}
            className="w-full py-3 bg-violet-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">photo_camera</span>
            Mở camera quét QR vị trí
          </button>

          <div className="w-full flex items-center gap-2">
            <div className="flex-1 h-px bg-surface-mid" />
            <span className="text-[11px] md:text-xs text-on-surface-variant/70 font-semibold uppercase">hoặc nhập tay</span>
            <div className="flex-1 h-px bg-surface-mid" />
          </div>

          <div className="w-full flex gap-sm">
            <input
              type="text"
              placeholder="VD: A-03-02"
              value={locationCode}
              onChange={(e) => setLocationCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 min-w-0 px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-surface focus:outline-none focus:border-primary font-mono"
            />
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="shrink-0 min-h-[44px] px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "..." : "Tìm"}
            </button>
          </div>

          {scanError && (
            <div className="w-full p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">error</span> {scanError}
            </div>
          )}

          <label className="w-full flex items-center gap-2 text-[11px] md:text-xs text-on-surface-variant cursor-pointer">
            <input
              type="checkbox"
              checked={blindCount}
              onChange={(e) => setBlindCount(e.target.checked)}
              className="accent-primary"
            />
            <span>
              <b>Đếm mù</b> — ẩn SL hệ thống đến khi nhập xong (giảm thiên kiến khi đếm)
            </span>
          </label>
        </div>
      )}

      {step === 2 && locationData && (
        <>
          <div className="industrial-card p-md rounded-xl bg-primary-container/20 border-primary/30">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary text-[24px]">location_on</span>
              <div>
                <span className="text-sm font-bold text-primary font-mono">{locationData.code}</span>
                <p className="text-[11px] md:text-xs text-on-surface-variant">
                  Khu {locationData.zone} · Kệ {locationData.rack} · Tầng {locationData.level}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-sm">
            <span className="font-mono text-[11px] md:text-xs font-semibold text-on-surface-variant uppercase">
              Hàng tại vị trí ({groupedItems.length} mã, {items.length} dòng)
            </span>
            {groupedItems.length === 0 ? (
              <p className="text-sm text-on-surface-variant py-4 text-center">Vị trí trống</p>
            ) : (
              groupedItems.map((g) => {
                const actual = counts[g.item_code_id];
                const hasEntered = actual !== undefined && actual !== null;
                const diff = hasEntered ? actual - g.system_qty : null;
                const showSystemQty = !blindCount || hasEntered;
                return (
                  <div key={g.item_code_id} className="industrial-card p-sm rounded-xl bg-surface shadow-sm space-y-2">
                    <div>
                      <span className="text-xs font-bold text-primary font-mono">{g.item_code}</span>
                      <p className="text-[11px] md:text-xs text-on-surface-variant">{g.item_name}</p>
                      {g.lots.length > 0 && (
                        <p className="text-[11px] text-on-surface-variant/70">Lô: {g.lots.join(", ")}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-sm text-center">
                      <div>
                        <span className="text-[11px] md:text-xs text-on-surface-variant block">HT</span>
                        <span className="text-sm font-bold">
                          {showSystemQty ? g.system_qty : <span className="text-on-surface-variant/50">•••</span>}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] md:text-xs text-on-surface-variant block">Thực</span>
                        <input
                          type="number"
                          min="0"
                          value={actual ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCounts((prev) => {
                              const next = { ...prev };
                              if (v === "") delete next[g.item_code_id];
                              else next[g.item_code_id] = Math.max(0, Number(v)); // UC-INV-06-TC16: chặn SL âm
                              return next;
                            });
                          }}
                          className="w-full text-center text-sm font-bold border border-outline-variant rounded px-2 py-2 min-h-[44px] focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] md:text-xs text-on-surface-variant block">CL</span>
                        <span
                          className={`text-sm font-bold ${
                            diff === null ? "" : diff === 0 ? "text-success" : "text-error"
                          }`}
                        >
                          {diff !== null ? (diff > 0 ? `+${diff}` : diff) : "—"}
                        </span>
                      </div>
                    </div>
                    {diff !== null && diff !== 0 && (
                      <input
                        type="text"
                        placeholder="Ghi chú lý do chênh lệch..."
                        value={notes[g.item_code_id] || ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [g.item_code_id]: e.target.value }))}
                        className="w-full text-xs px-2 py-1 border border-amber-300 rounded bg-amber-50/30 focus:border-amber-500 focus:outline-none"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ─── UC-INV-06: PALLET NGOÀI HỆ THỐNG ─── */}
          <div className="flex flex-col gap-sm">
            {extraPallets.length > 0 && (
              <span className="font-mono text-[11px] md:text-xs font-semibold text-amber-700 uppercase">
                Pallet ngoài hệ thống ({extraPallets.length})
              </span>
            )}
            {extraPallets.map((p) => (
              <div key={p.tempId} className="industrial-card p-sm rounded-xl bg-amber-50/40 border border-amber-300 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-amber-800 font-mono">{p.item_code}</span>
                    <span className="ml-2 text-[10px] font-bold text-amber-700 bg-amber-200/60 px-1.5 py-0.5 rounded">Ngoài HT</span>
                    <p className="text-[11px] md:text-xs text-on-surface-variant truncate">{p.item_name}</p>
                    <p className="text-[11px] text-on-surface-variant/80">
                      SL thực: <b>{p.qty}</b>
                      {p.lot ? ` · Lô ${p.lot}` : ""}
                      {p.expiry ? ` · HSD ${p.expiry}` : ""}
                      {p.found_pallet_code ? ` · Pallet ${p.found_pallet_code}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => removeExtraPallet(p.tempId)}
                    className="shrink-0 text-rose-600 p-1"
                    aria-label="Xóa pallet ngoài hệ thống"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))}

            {!showExtraForm ? (
              <button
                onClick={() => {
                  setShowExtraForm(true);
                  setExLookupErr(null);
                }}
                className="w-full py-2.5 border border-dashed border-amber-400 text-amber-700 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 active:scale-[0.98] transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Thêm pallet ngoài hệ thống
              </button>
            ) : (
              <div className="industrial-card p-md rounded-xl bg-amber-50/30 border border-amber-300 space-y-2">
                <p className="text-[11px] md:text-xs text-amber-800 font-semibold flex items-start gap-1">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  Pallet có thật ở vị trí nhưng hệ thống chưa ghi nhận. Sẽ chờ Quản lý duyệt rồi mới tạo pallet vào tồn.
                </p>
                {/* Tra mã hàng */}
                <div className="flex gap-sm">
                  <input
                    type="text"
                    placeholder="Mã hàng (VD: VG-NM-001)"
                    value={exCodeInput}
                    onChange={(e) => setExCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && resolveExtraItem()}
                    className="flex-1 min-w-0 px-3 py-2 border border-outline-variant rounded-lg text-sm bg-surface focus:outline-none focus:border-primary font-mono"
                  />
                  <button
                    onClick={() => setExScannerOpen(true)}
                    className="shrink-0 min-h-[40px] px-3 border border-outline-variant rounded-lg text-sm"
                    aria-label="Quét mã hàng"
                  >
                    <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                  </button>
                  <button
                    onClick={() => resolveExtraItem()}
                    disabled={exLooking}
                    className="shrink-0 min-h-[40px] px-3 bg-amber-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    {exLooking ? "..." : "Tra"}
                  </button>
                </div>
                {exResolved && (
                  <div className="text-[11px] md:text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                    ✓ {exResolved.code} — {exResolved.name}
                  </div>
                )}
                {/* SL + Lô + HSD + mã pallet */}
                <div className="grid grid-cols-2 gap-sm">
                  <label className="text-[11px] text-on-surface-variant">
                    SL thực (thùng) *
                    <input
                      type="number"
                      min="1"
                      value={exQty}
                      onChange={(e) => setExQty(e.target.value)}
                      className="w-full mt-1 px-2 py-2 border border-outline-variant rounded text-sm focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label className="text-[11px] text-on-surface-variant">
                    Lô (nếu có)
                    <input
                      type="text"
                      value={exLot}
                      onChange={(e) => setExLot(e.target.value)}
                      className="w-full mt-1 px-2 py-2 border border-outline-variant rounded text-sm focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label className="text-[11px] text-on-surface-variant">
                    HSD (nếu có)
                    <input
                      type="date"
                      value={exExpiry}
                      onChange={(e) => setExExpiry(e.target.value)}
                      className="w-full mt-1 px-2 py-2 border border-outline-variant rounded text-sm focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label className="text-[11px] text-on-surface-variant">
                    Mã pallet hiện trường
                    <input
                      type="text"
                      placeholder="(nếu pallet có nhãn)"
                      value={exFoundCode}
                      onChange={(e) => setExFoundCode(e.target.value)}
                      className="w-full mt-1 px-2 py-2 border border-outline-variant rounded text-sm focus:border-primary focus:outline-none"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Ghi chú (vì sao pallet này nằm ngoài hệ thống)..."
                  value={exNote}
                  onChange={(e) => setExNote(e.target.value)}
                  className="w-full text-xs px-2 py-2 border border-outline-variant rounded focus:border-primary focus:outline-none"
                />
                {exLookupErr && (
                  <div className="text-xs text-rose-700 font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span> {exLookupErr}
                  </div>
                )}
                <div className="flex gap-sm">
                  <button
                    onClick={() => {
                      setShowExtraForm(false);
                      setExLookupErr(null);
                    }}
                    className="flex-1 py-2 border border-outline-variant rounded-lg text-sm font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={addExtraPallet}
                    disabled={!exResolved}
                    className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    Thêm vào danh sách
                  </button>
                </div>
              </div>
            )}
          </div>

          {scanError && (
            <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">error</span> {scanError}
            </div>
          )}

          <div className="flex gap-sm">
            <button
              onClick={resetAll}
              disabled={saving}
              className="flex-1 py-2.5 border border-outline-variant rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              Quay lại
            </button>
            <button
              onClick={handleSave}
              disabled={saving || totalRows === 0}
              className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  Đang lưu…
                </>
              ) : (
                `Lưu ${totalRows} dòng`
              )}
            </button>
          </div>
        </>
      )}

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanLocation}
        title="Quét QR vị trí"
        allowManualInput
      />

      {/* UC-INV-06: quét mã hàng cho pallet ngoài hệ thống */}
      <BarcodeScannerModal
        open={exScannerOpen}
        onClose={() => setExScannerOpen(false)}
        onScan={(code) => {
          setExScannerOpen(false);
          resolveExtraItem(code);
        }}
        title="Quét mã hàng"
        allowManualInput
      />
    </div>
  );
}
