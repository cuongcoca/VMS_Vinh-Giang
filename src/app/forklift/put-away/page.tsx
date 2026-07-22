"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
// Phase 3.2: KHÔNG dùng AppLayout (đây là page mobile, layout đã có sẵn từ forklift/layout.tsx)
import { BarcodeScanner } from "@/components/BarcodeScanner";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { ScanField, MobileToast } from "@/components/mobile";

type QueuePallet = { id: string; code: string; total_lines: number; total_weight_kg: string; supplier: { name: string } | null };
type LocationOption = {
  id: string; code: string; zone: string; rack: string; level: string;
  status: string;
  current_pallets: number;
  remaining_pallets: number | null;
  current_weight_kg: number;
  remaining_weight_kg: number | null;
  max_pallets: number | null;
  max_weight_kg: number | null;
};

function PutAwayContent() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const searchParams = useSearchParams();
  const preselectedPalletId = searchParams.get("pallet_id") || "";

  const [pallets, setPallets] = useState<QueuePallet[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [palletId, setPalletId] = useState(preselectedPalletId);
  const [locationId, setLocationId] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showLocationScanner, setShowLocationScanner] = useState(false);

  // Load queue 1 lần
  useEffect(() => {
    fetch(`${basePath}/api/forklift/queue`).then(r => r.json()).then(r => { if (r.success) setPallets(r.data); });
  }, [basePath]);

  const selectedPallet = pallets.find(p => p.id === palletId);

  // Khi đổi pallet → reload vị trí available dựa trên weight của pallet đó (để pre-filter overweight)
  useEffect(() => {
    const w = selectedPallet ? Number(selectedPallet.total_weight_kg) : 0;
    const url = `${basePath}/api/locations/available${w > 0 ? `?pallet_weight_kg=${w}` : ""}`;
    fetch(url).then(r => r.json()).then(r => {
      if (r.success) {
        setLocations(r.data);
        // Nếu locationId đang chọn không còn trong list → reset
        if (locationId && !r.data.find((l: LocationOption) => l.id === locationId)) {
          setLocationId("");
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath, palletId]);

  const selectedLocation = locations.find(l => l.id === locationId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!palletId || !locationId) { setToast({ message: "Vui lòng chọn pallet và vị trí.", type: "error" }); return; }
    setSaving(true);
    try {
      const res = await fetch(`${basePath}/api/forklift/put-away`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pallet_id: palletId, location_id: locationId }),
      });
      const result = await res.json();
      if (result.success) {
        setToast({ message: result.message || "Đã xếp thành công!", type: "success" });
        setPalletId(""); setLocationId("");
        // Refresh lists
        fetch(`${basePath}/api/forklift/queue`).then(r => r.json()).then(r => { if (r.success) setPallets(r.data); });
        fetch(`${basePath}/api/locations/available`).then(r => r.json()).then(r => { if (r.success) setLocations(r.data); });
      } else {
        setToast({ message: result.error || "Lỗi.", type: "error" });
      }
    } catch { setToast({ message: "Lỗi kết nối.", type: "error" }); }
    finally { setSaving(false); setTimeout(() => setToast(null), 4000); }
  };

  return (
    <div className="px-margin-mobile py-md max-w-xl space-y-5">
      <MobileToast toast={toast} />
      <BackButton fallback="/forklift">Quay lại</BackButton>
      <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
        <span className="material-symbols-outlined text-[28px]">input</span> Xếp pallet vào vị trí
      </h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-outline-variant p-6 shadow-sm space-y-5">
        <div>
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Chọn Pallet <span className="text-rose-500">*</span></label>
          <select value={palletId} onChange={e => setPalletId(e.target.value)} required
            className="w-full px-3 py-2.5 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="">— Chọn pallet —</option>
            {pallets.map(p => <option key={p.id} value={p.id}>{p.code} — {p.supplier?.name || "N/A"} ({p.total_lines} dòng, {Number(p.total_weight_kg).toFixed(1)}kg)</option>)}
          </select>
          {selectedPallet && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
              <strong>{selectedPallet.code}</strong> · {selectedPallet.total_lines} dòng · {Number(selectedPallet.total_weight_kg).toFixed(1)} kg
            </div>
          )}
        </div>
        <div>
          <ScanField
            label="Vị trí đích"
            required
            onScan={() => setShowLocationScanner(true)}
            hint={
              <span className="ml-2 text-caption font-normal normal-case text-on-surface-variant/70">
                (Trống & chưa đầy · Đã loại vị trí quá tải{selectedPallet ? ` cho pallet ${Number(selectedPallet.total_weight_kg).toFixed(1)}kg` : ""})
              </span>
            }
          >
            <select value={locationId} onChange={e => setLocationId(e.target.value)} required
              className="w-full px-3 py-2.5 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="">— Chọn vị trí —</option>
              {locations.map(l => {
                const slotInfo = l.max_pallets != null
                  ? `${l.current_pallets}/${l.max_pallets}P`
                  : `${l.current_pallets}P`;
                const weightInfo = l.remaining_weight_kg != null
                  ? `còn ${l.remaining_weight_kg.toLocaleString("vi-VN")}kg`
                  : "không giới hạn cân";
                const tag = l.status === "EMPTY" ? "[Trống]" : "[Chưa đầy]";
                return (
                  <option key={l.id} value={l.id}>
                    {tag} {l.code} — Khu {l.zone} · {slotInfo} · {weightInfo}
                  </option>
                );
              })}
            </select>
          </ScanField>
          {locations.length === 0 && (
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] flex-shrink-0">warning</span>
              <span>
                Không có vị trí nào còn nhận được pallet này
                {selectedPallet ? ` (${Number(selectedPallet.total_weight_kg).toFixed(1)}kg)` : ""}.
                Kiểm tra kho có vị trí trống hay không, hoặc giảm cân pallet trước khi xếp.
              </span>
            </div>
          )}
          {selectedLocation && (
            <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 space-y-1">
              <p>
                <strong>{selectedLocation.code}</strong> · Khu {selectedLocation.zone} · Kệ {selectedLocation.rack} · Tầng {selectedLocation.level}
              </p>
              <p className="text-xs">
                Đang chứa: <strong>{selectedLocation.current_pallets}</strong>
                {selectedLocation.max_pallets != null && <>/<strong>{selectedLocation.max_pallets}</strong> pallet</>}
                {selectedLocation.remaining_pallets != null && <> · còn {selectedLocation.remaining_pallets} slot</>}
              </p>
              <p className="text-xs">
                Cân hiện tại: <strong>{selectedLocation.current_weight_kg.toLocaleString("vi-VN")}</strong>
                {selectedLocation.max_weight_kg != null && <>/<strong>{selectedLocation.max_weight_kg.toLocaleString("vi-VN")}</strong> kg</>}
                {selectedLocation.remaining_weight_kg != null && <> · còn {selectedLocation.remaining_weight_kg.toLocaleString("vi-VN")}kg</>}
              </p>
              {selectedPallet && selectedLocation.max_weight_kg != null && (
                <p className="text-xs">
                  Sau khi xếp: <strong>{(selectedLocation.current_weight_kg + Number(selectedPallet.total_weight_kg)).toLocaleString("vi-VN")}</strong>/{selectedLocation.max_weight_kg.toLocaleString("vi-VN")} kg
                </p>
              )}
            </div>
          )}
        </div>
        <button type="submit" disabled={saving || !palletId || !locationId}
          className="w-full px-5 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
          <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "check_circle"}</span>
          Xác nhận xếp vị trí
        </button>
      </form>

      <BarcodeScanner
        isOpen={showLocationScanner}
        onScan={async (code) => {
          setShowLocationScanner(false);
          // 1) Match nhanh trong list đã load
          const found = locations.find(l => l.code === code);
          if (found) {
            setLocationId(found.id);
            return;
          }
          // UC-FK-02_TC06: QR sai ĐỊNH DẠNG mã vị trí → báo "Mã vị trí không hợp lệ"
          // (không gọi lookup). Mã hợp lệ: Khu-Kệ-Tầng, vd A-03-02.
          const LOC_CODE_REGEX = /^[A-Z]{1,3}-\d{1,3}-\d{1,2}$/;
          if (!LOC_CODE_REGEX.test(code.trim().toUpperCase())) {
            setToast({ message: "Mã vị trí không hợp lệ.", type: "error" });
            return;
          }
          // 2) Fallback: hỏi server (vị trí có thể chưa nằm trong list cached)
          try {
            const res = await fetch(`${basePath}/api/locations/by-code?code=${encodeURIComponent(code)}`);
            const result = await res.json();
            if (result.success && result.data) {
              if (result.data.type !== "STORAGE") {
                setToast({ message: `Vị trí "${code}" không phải vị trí chứa (${result.data.type}).`, type: "error" });
                return;
              }
              if (result.data.status === "MAINTENANCE") {
                setToast({ message: `Vị trí "${code}" đang bảo trì.`, type: "error" });
                return;
              }
              setLocationId(result.data.id);
              setToast({ message: `Đã nhận diện vị trí ${code}.`, type: "success" });
            } else {
              setToast({ message: `Vị trí "${code}" không tồn tại trong hệ thống.`, type: "error" });
            }
          } catch {
            setToast({ message: `Lỗi tra cứu vị trí "${code}".`, type: "error" });
          }
        }}
        onClose={() => setShowLocationScanner(false)}
        title="Quét QR vị trí kho"
      />
    </div>
  );
}

export default function PutAwayPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[60vh]"><span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span></div>}>
      <PutAwayContent />
    </Suspense>
  );
}
