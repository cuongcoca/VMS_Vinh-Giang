"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { ScanField, MobileToast, DateField } from "@/components/mobile";

type StagingPallet = {
  id: string;
  code: string;
  note: string | null;
  location: { id: string; code: string } | null;
  supplier: { name: string } | null;
};

type LocationOption = {
  id: string;
  code: string;
  zone: string;
  rack: string;
  level: string;
};

type PalletLineDetail = {
  id: string;
  item_code: { id: string; code: string; short_name: string; full_name?: string | null; unit?: { symbol?: string | null; name: string } | null };
  qty_box: string;
  qty_unit: string;
  lot: string | null;
  expiry_date: string | null;
  manufactured_date: string | null;
  weight_kg: string;
};

type LineDraft = {
  line_id: string;
  qty_box: string;
  lot: string;
  expiry_date: string;
  manufactured_date: string;
};

function ReturnPalletContent() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const searchParams = useSearchParams();
  const preselectedPalletId = searchParams.get("pallet_id") || "";

  const [pallets, setPallets] = useState<StagingPallet[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [palletId, setPalletId] = useState(preselectedPalletId);
  const [locationId, setLocationId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showLocationScanner, setShowLocationScanner] = useState(false);

  // Pallet lines + drafts
  const [lines, setLines] = useState<PalletLineDetail[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});

  const fetchStagingPallets = useCallback(() => {
    fetch(`${basePath}/api/pallets?status=IN_STAGING`).then(r => r.json()).then(r => {
      if (r.success) setPallets(r.data);
    });
  }, [basePath]);

  const fetchEmptyLocations = useCallback(() => {
    // Lay moi vi tri CON CHO (trong + dang dung nhung chua day), khong chi EMPTY,
    // de cho phep tra pallet ve vi tri da co hang ma van con suc chua.
    fetch(`${basePath}/api/locations/available`).then(r => r.json()).then(r => {
      if (r.success) setLocations(r.data);
    });
  }, [basePath]);

  // Load lines khi chọn pallet
  const fetchLines = useCallback(async (pid: string) => {
    if (!pid) { setLines([]); setDrafts({}); return; }
    setLinesLoading(true);
    try {
      const res = await fetch(`${basePath}/api/pallets/${pid}/lines`);
      const j = await res.json();
      if (j.success && j.data?.lines) {
        const ls: PalletLineDetail[] = j.data.lines;
        setLines(ls);
        // Init drafts từ giá trị hiện tại
        const d: Record<string, LineDraft> = {};
        for (const l of ls) {
          d[l.id] = {
            line_id: l.id,
            qty_box: String(Number(l.qty_box)),
            lot: l.lot || "",
            expiry_date: l.expiry_date ? l.expiry_date.slice(0, 10) : "",
            manufactured_date: l.manufactured_date ? l.manufactured_date.slice(0, 10) : "",
          };
        }
        setDrafts(d);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLinesLoading(false);
    }
  }, [basePath]);

  useEffect(() => { fetchStagingPallets(); fetchEmptyLocations(); }, [fetchStagingPallets, fetchEmptyLocations]);
  useEffect(() => { fetchLines(palletId); }, [palletId, fetchLines]);

  const selectedPallet = pallets.find(p => p.id === palletId);
  const selectedLocation = locations.find(l => l.id === locationId);

  // Detect xem có line nào bị sửa không
  const linesChanged = lines.some((l) => {
    const d = drafts[l.id];
    if (!d) return false;
    if (Number(d.qty_box) !== Number(l.qty_box)) return true;
    if ((d.lot || "") !== (l.lot || "")) return true;
    const lExpiry = l.expiry_date ? l.expiry_date.slice(0, 10) : "";
    if (d.expiry_date !== lExpiry) return true;
    const lMfg = l.manufactured_date ? l.manufactured_date.slice(0, 10) : "";
    if (d.manufactured_date !== lMfg) return true;
    return false;
  });

  const isReasonValid = reason.trim().length >= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!palletId || !locationId) {
      setToast({ message: "Vui lòng chọn đầy đủ pallet và vị trí.", type: "error" }); return;
    }
    if (!isReasonValid) {
      setToast({ message: "Lý do phải có ít nhất 5 ký tự.", type: "error" }); return;
    }

    // UC-FK-05_TC06: Lô hàng hoàn trả bắt buộc — chặn xóa lô đang có.
    const clearedLot = lines.find((l) => {
      const d = drafts[l.id];
      return d && (l.lot ?? "").trim() && !((d.lot ?? "").trim());
    });
    if (clearedLot) {
      setToast({ message: "Cần nhập lô hàng hoàn trả.", type: "error" }); return;
    }
    // UC-FK-05_TC08: HSD mới bắt buộc — chặn xóa HSD đang có.
    const clearedExpiry = lines.find((l) => {
      const d = drafts[l.id];
      const lExp = l.expiry_date ? l.expiry_date.slice(0, 10) : "";
      return d && lExp && !((d.expiry_date ?? "").trim());
    });
    if (clearedExpiry) {
      setToast({ message: "Cần nhập HSD mới.", type: "error" }); return;
    }

    // Build line_updates: chỉ gửi những line thực sự đổi
    const line_updates = lines
      .map((l) => {
        const d = drafts[l.id];
        if (!d) return null;
        const u: Record<string, unknown> = { line_id: l.id };
        let hasChange = false;
        if (Number(d.qty_box) !== Number(l.qty_box)) { u.qty_box = Number(d.qty_box); hasChange = true; }
        if ((d.lot || "") !== (l.lot || "")) { u.lot = d.lot || null; hasChange = true; }
        const lExpiry = l.expiry_date ? l.expiry_date.slice(0, 10) : "";
        if (d.expiry_date !== lExpiry) { u.expiry_date = d.expiry_date || null; hasChange = true; }
        const lMfg = l.manufactured_date ? l.manufactured_date.slice(0, 10) : "";
        if (d.manufactured_date !== lMfg) { u.manufactured_date = d.manufactured_date || null; hasChange = true; }
        return hasChange ? u : null;
      })
      .filter(Boolean);

    setSaving(true);
    try {
      const res = await fetch(`${basePath}/api/forklift/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pallet_id: palletId,
          location_id: locationId,
          reason: reason.trim(),
          line_updates,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setToast({ message: result.message || "Hoàn trả thành công!", type: "success" });
        setPalletId(""); setLocationId(""); setReason("");
        setLines([]); setDrafts({});
        fetchStagingPallets(); fetchEmptyLocations();
      } else {
        setToast({ message: result.error || "Hoàn trả thất bại.", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Lỗi kết nối.", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4500);
    }
  };

  return (
    <div className="px-margin-mobile py-md max-w-2xl space-y-4">
      <MobileToast toast={toast} />

      <BackButton fallback="/forklift" variant="subtle">Quay lại trang Xe nâng</BackButton>

      {/* Header đỏ — luồng đặc biệt */}
      <div className="bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-xl p-4 shadow-lg flex items-center gap-3">
        <span className="material-symbols-outlined text-[32px]">warning</span>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">Trả về vị trí</h1>
          <p className="text-xs text-white/80 mt-0.5">Hoàn trả pallet từ khu chờ xuất về vị trí kho lưu trữ</p>
        </div>
      </div>

      {/* Banner quyền đặc biệt */}
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-900">
        <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">shield</span>
        <div>
          <strong>Quyền đặc biệt:</strong> Đây là luồng <b>DUY NHẤT</b> cho phép sửa SL/Lô/Date (HSD, NSX) sau khi pallet đã xác nhận. Mã hàng giữ cố định theo pallet. Mọi thay đổi sẽ được lưu vào audit log.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-outline-variant p-5 shadow-sm space-y-5">
        {/* 1. Chọn pallet */}
        <div>
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
            Pallet / hàng tại khu chờ xuất <span className="text-rose-500">*</span>
          </label>
          <select
            value={palletId}
            onChange={e => setPalletId(e.target.value)}
            required
            className="w-full px-3 py-2.5 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">— Chọn pallet đang ở Staging-out —</option>
            {pallets.map(p => (
              <option key={p.id} value={p.id}>
                {p.code} {p.supplier ? `· ${p.supplier.name}` : ""} {p.location ? `· đã rút từ ${p.location.code}` : ""}
              </option>
            ))}
          </select>
          {selectedPallet && (
            <div className="mt-2 p-3 bg-rose-50/50 rounded-lg text-sm text-rose-800 border border-rose-100">
              Pallet <strong className="font-mono">{selectedPallet.code}</strong>
              {selectedPallet.location && (
                <span className="text-rose-700/80"> · đã rút từ <strong className="font-mono">{selectedPallet.location.code}</strong></span>
              )}
            </div>
          )}
        </div>

        {/* 2. Cập nhật nội dung từng line */}
        {palletId && (
          <div className="border-t border-outline-variant pt-4">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">edit_note</span>
              Cập nhật nội dung (nếu cần)
            </p>
            {linesLoading ? (
              <div className="flex justify-center py-6">
                <span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span>
              </div>
            ) : lines.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-4">Pallet chưa có dòng hàng.</p>
            ) : (
              <div className="space-y-4">
                {lines.map((line) => {
                  const d = drafts[line.id];
                  if (!d) return null;
                  const qtyChanged = Number(d.qty_box) !== Number(line.qty_box);
                  const lotChanged = (d.lot || "") !== (line.lot || "");
                  const lExpiry = line.expiry_date ? line.expiry_date.slice(0, 10) : "";
                  const expChanged = d.expiry_date !== lExpiry;
                  const unitLabel = line.item_code.unit?.symbol || line.item_code.unit?.name || "";

                  return (
                    <div key={line.id} className="bg-surface-low/30 rounded-lg p-3 space-y-3 border border-outline-variant/40">
                      {/* Item info */}
                      <div className="flex justify-between items-baseline">
                        <div>
                          <span className="font-mono font-bold text-sm text-primary">{line.item_code.code}</span>
                          <p className="text-[11px] text-on-surface-variant truncate">{line.item_code.short_name}</p>
                        </div>
                        <span className="text-[11px] text-on-surface-variant/60">
                          Cân hiện tại: {Number(line.weight_kg).toFixed(1)} kg
                        </span>
                      </div>

                      {/* SL */}
                      <div>
                        <label className="text-[11px] font-semibold text-on-surface-variant uppercase block mb-0.5">
                          Số lượng còn lại {unitLabel ? `(${unitLabel}/thùng đã quy đổi)` : ""} <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={d.qty_box}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [line.id]: { ...prev[line.id], qty_box: e.target.value } }))}
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                            qtyChanged ? "border-amber-400 focus:ring-amber-200 bg-amber-50/30" : "border-outline-variant focus:ring-primary/20 focus:border-primary"
                          }`}
                        />
                        {qtyChanged && (
                          <p className="text-[11px] text-amber-700 mt-0.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">change_circle</span>
                            Đã sửa từ <b>{Number(line.qty_box)}</b> → <b>{d.qty_box}</b>
                          </p>
                        )}
                      </div>

                      {/* Lô + HSD + NSX */}
                      <div className="space-y-2">
                        <div>
                          <label className="text-[11px] font-semibold text-on-surface-variant uppercase block mb-0.5">Lô</label>
                          <input
                            type="text"
                            value={d.lot}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [line.id]: { ...prev[line.id], lot: e.target.value } }))}
                            placeholder="—"
                            className={`w-full px-2 py-1.5 text-xs font-mono border rounded-lg focus:outline-none focus:ring-2 ${
                              lotChanged ? "border-amber-400 focus:ring-amber-200 bg-amber-50/30" : "border-outline-variant focus:ring-primary/20"
                            }`}
                          />
                          {lotChanged && (
                            <p className="text-[11px] text-amber-700 mt-0.5">Đã sửa lô</p>
                          )}
                        </div>
                        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
                          <div className="min-w-0">
                            <label className="text-[11px] font-semibold text-on-surface-variant uppercase block mb-0.5">HSD</label>
                            <DateField
                              value={d.expiry_date}
                              onChange={(val) => setDrafts((prev) => ({ ...prev, [line.id]: { ...prev[line.id], expiry_date: val } }))}
                              className={expChanged ? "border-amber-400 bg-amber-50/30" : "border-outline-variant"}
                            />
                            {expChanged && (
                              <p className="text-[11px] text-amber-700 mt-0.5">Đã sửa HSD</p>
                            )}
                          </div>
                          {/* UC-FK-05_TC17: NSX (ngày sản xuất) — API đã hỗ trợ manufactured_date */}
                          <div className="min-w-0">
                            <label className="text-[11px] font-semibold text-on-surface-variant uppercase block mb-0.5">NSX</label>
                            <DateField
                              value={d.manufactured_date}
                              onChange={(val) => setDrafts((prev) => ({ ...prev, [line.id]: { ...prev[line.id], manufactured_date: val } }))}
                              className="border-outline-variant"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. Vị trí trả về */}
        <div className="border-t border-outline-variant pt-4">
          <ScanField label="Vị trí trả về" required onScan={() => setShowLocationScanner(true)}>
            <select
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">— Chọn vị trí trống —</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.code} (Khu {l.zone} · Kệ {l.rack} · Tầng {l.level})</option>
              ))}
            </select>
          </ScanField>
          {selectedLocation && (
            <div className="mt-2 p-2 bg-emerald-50 rounded-lg text-xs text-emerald-800 border border-emerald-100">
              <strong className="font-mono">{selectedLocation.code}</strong> · Khu {selectedLocation.zone} · Kệ {selectedLocation.rack} · Tầng {selectedLocation.level}
            </div>
          )}
        </div>

        {/* 4. Lý do — label động */}
        <div>
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
            {linesChanged ? "Lý do thay đổi nội dung" : "Lý do hoàn trả"} <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={linesChanged
              ? "VD: Sai mã hàng khi nhập, đã đếm lại còn 180 chai sau khi xuất 60..."
              : "VD: Đơn hàng bị hủy đột xuất, cần đưa pallet trở lại vị trí cũ..."}
            required
            rows={3}
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
              linesChanged ? "border-amber-300 bg-amber-50/30 focus:ring-amber-200" : "border-outline-variant focus:ring-primary/20 focus:border-primary"
            }`}
          />
          <div className="mt-1 text-xs">
            {reason.trim().length > 0 && !isReasonValid ? (
              <span className="text-rose-600 font-medium">Quá ngắn ({reason.trim().length}/5)</span>
            ) : isReasonValid ? (
              <span className="text-emerald-600 font-medium">Hợp lệ ({reason.trim().length} ký tự)</span>
            ) : (
              <span className="text-on-surface-variant/70">Yêu cầu tối thiểu 5 ký tự.</span>
            )}
            {linesChanged && (
              <span className="ml-2 text-amber-700 font-semibold">
                · Có {lines.filter((l) => {
                  const d = drafts[l.id]; if (!d) return false;
                  const lExpiry = l.expiry_date ? l.expiry_date.slice(0, 10) : "";
                  return Number(d.qty_box) !== Number(l.qty_box) || (d.lot || "") !== (l.lot || "") || d.expiry_date !== lExpiry;
                }).length} dòng bị sửa
              </span>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !palletId || !locationId || !isReasonValid}
          className="w-full px-5 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "check_circle"}</span>
          {linesChanged ? "Xác nhận sửa + Hoàn trả pallet" : "Xác nhận hoàn trả pallet"}
        </button>
      </form>

      <BarcodeScanner
        isOpen={showLocationScanner}
        onScan={(code) => {
          setShowLocationScanner(false);
          const found = locations.find(l => l.code === code);
          if (found) setLocationId(found.id);
          else setToast({ message: `Vị trí "${code}" không có trong DS trống.`, type: "error" });
        }}
        onClose={() => setShowLocationScanner(false)}
        title="Quét QR vị trí kho"
      />
    </div>
  );
}

export default function ReturnPalletPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[60vh]">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
      </div>
    }>
      <ReturnPalletContent />
    </Suspense>
  );
}
