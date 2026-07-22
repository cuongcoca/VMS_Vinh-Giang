"use client";
import React, { useState, useEffect } from "react";
// Phase 3.2: KHÔNG dùng AppLayout (đây là page mobile, layout đã có sẵn từ forklift/layout.tsx)
import { BarcodeScanner } from "@/components/BarcodeScanner";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { ScanField, MobileToast } from "@/components/mobile";

type PalletOption = { id: string; code: string; location_id: string | null; location?: { id: string; code: string; zone: string } | null; supplier?: { name: string } | null; totalWeightKg?: number };
type LocationOption = { id: string; code: string; zone: string; rack: string; level: string };

// Sprint A · F3-001: 4 lý do chuyển vị trí theo mockup wms_mockups_4.html UC-FK-03.
const RELOCATE_REASONS = [
  { value: "REARRANGE", label: "Sắp xếp lại kho" },
  { value: "CONSOLIDATE_LOT", label: "Gom hàng cùng lô" },
  { value: "FREE_LOCATION", label: "Giải phóng vị trí" },
  { value: "OTHER", label: "Khác" },
] as const;

/**
 * Chuẩn hoá nội dung QR trước khi tra cứu.
 * Gốc lỗi quét báo "không tồn tại / đã sử dụng": QR có thể là URL, có khoảng
 * trắng thừa hoặc khác hoa/thường so với mã trong DB. Hàm này bóc tách mã sạch.
 */
function extractScannedCode(raw: string): string {
  let s = (raw || "").trim();
  if (!s) return s;
  // QR dạng URL → ưu tiên param ?code=/?c=, nếu không có thì lấy segment cuối path.
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const param =
        u.searchParams.get("code") ||
        u.searchParams.get("c") ||
        u.searchParams.get("loc") ||
        u.searchParams.get("pallet");
      if (param) {
        s = param;
      } else {
        const seg = u.pathname.split("/").filter(Boolean).pop();
        if (seg) s = decodeURIComponent(seg);
      }
    } catch {
      /* không phải URL hợp lệ → giữ nguyên chuỗi gốc */
    }
  }
  // bỏ nháy bao quanh + khoảng trắng thừa
  return s.replace(/^["'\s]+|["'\s]+$/g, "");
}

export default function RelocatePage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [pallets, setPallets] = useState<PalletOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [palletId, setPalletId] = useState("");
  const [newLocationId, setNewLocationId] = useState("");
  const [reasonCode, setReasonCode] = useState<string>("");
  const [reasonNote, setReasonNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showLocationScanner, setShowLocationScanner] = useState(false);
  const [showPalletScanner, setShowPalletScanner] = useState(false);

  // Load danh sách pallet đang ở trong kho
  useEffect(() => {
    fetch(`${basePath}/api/pallets?status=IN_STORAGE`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setPallets(r.data);
      });
  }, [basePath]);

  // Load danh sách vị trí khả dụng (còn sức chứa và cân nặng tương ứng với pallet được chọn)
  useEffect(() => {
    const selected = pallets.find((p) => p.id === palletId);
    const weight = selected?.totalWeightKg || 0;
    fetch(`${basePath}/api/locations/available?pallet_weight_kg=${weight}`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setLocations(r.data);
      });
  }, [palletId, pallets, basePath]);

  const selected = pallets.find(p => p.id === palletId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!palletId || !newLocationId) return;
    setSaving(true);
    try {
      // Compose reason: chọn lý do từ dropdown + ghi chú thêm (nếu có).
      // Backend `relocate/route.ts` đã hỗ trợ `reason` field → lưu vào Movement.reason + audit.
      const reasonLabel = RELOCATE_REASONS.find((r) => r.value === reasonCode)?.label || "";
      const reason = [reasonLabel, reasonNote.trim()].filter(Boolean).join(" — ") || null;
      const res = await fetch(`${basePath}/api/forklift/relocate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pallet_id: palletId,
          new_location_id: newLocationId,
          reason,
          reason_code: reasonCode || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setToast({ message: result.message || "Đã chuyển!", type: "success" });
        setPalletId(""); setNewLocationId(""); setReasonCode(""); setReasonNote("");
        fetch(`${basePath}/api/pallets?status=IN_STORAGE`).then(r => r.json()).then(r => { if (r.success) setPallets(r.data); });
      } else setToast({ message: result.error, type: "error" });
    } catch { setToast({ message: "Lỗi kết nối.", type: "error" }); }
    finally { setSaving(false); setTimeout(() => setToast(null), 4000); }
  };

  return (
    <>
    <div className="px-margin-mobile py-md max-w-xl space-y-5">
        <MobileToast toast={toast} />
        <BackButton fallback="/forklift">Quay lại</BackButton>
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[28px]">swap_horiz</span> Chuyển vị trí pallet
        </h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-outline-variant p-6 shadow-sm space-y-5">
          <div>
            <ScanField label="Pallet" required onScan={() => setShowPalletScanner(true)}>
              <select value={palletId} onChange={e => setPalletId(e.target.value)} required
                className="w-full px-3 py-2.5 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                <option value="">— Chọn pallet đang trong kho —</option>
                {pallets.map(p => <option key={p.id} value={p.id}>{p.code} — Vị trí: {p.location?.code || "N/A"}</option>)}
              </select>
            </ScanField>
            {selected?.location && (
              <div className="mt-2 p-3 bg-indigo-50 rounded-lg text-sm text-indigo-800">
                Vị trí hiện tại: <strong>{selected.location.code}</strong> (Khu {selected.location.zone})
              </div>
            )}
          </div>
          <div className="flex items-center justify-center"><span className="material-symbols-outlined text-[28px] text-on-surface-variant/50">arrow_downward</span></div>
          <ScanField label="Vị trí mới" required onScan={() => setShowLocationScanner(true)}>
            <select value={newLocationId} onChange={e => setNewLocationId(e.target.value)} required
              className="w-full px-3 py-2.5 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="">— Chọn vị trí khả dụng (trống / còn sức chứa) —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.code} (Khu {l.zone} · Kệ {l.rack} · Tầng {l.level})</option>)}
            </select>
          </ScanField>
          {/* Sprint A · F3-001: dropdown lý do chuyển vị trí (tuỳ chọn) — match mockup UC-FK-03. */}
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Lý do (tùy chọn)</label>
            <select value={reasonCode} onChange={e => setReasonCode(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="">— Không chỉ định —</option>
              {RELOCATE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {reasonCode === "OTHER" && (
              <input type="text" value={reasonNote} onChange={e => setReasonNote(e.target.value)}
                placeholder="Ghi chú chi tiết lý do…" maxLength={200}
                className="mt-2 w-full px-3 py-2.5 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            )}
          </div>
          <button type="submit" disabled={saving || !palletId || !newLocationId}
            className="w-full px-5 py-3 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
            <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "swap_horiz"}</span>
            Xác nhận chuyển
          </button>
        </form>
      </div>

      <BarcodeScanner
        isOpen={showLocationScanner}
        onScan={async (raw) => {
          setShowLocationScanner(false);
          const extracted = extractScannedCode(raw);
          // Mã vị trí dạng X-NN-NN → tách đúng pattern nếu QR lẫn ký tự khác.
          const m = extracted.match(/[A-Za-z]+-\d{2}-\d{2}/);
          const code = (m ? m[0] : extracted).toUpperCase();
          if (!code) return;
          // 1) Khớp trong danh sách vị trí khả dụng đã tải (không phân biệt hoa/thường).
          const local = locations.find((l) => l.code.toUpperCase() === code);
          if (local) {
            setNewLocationId(local.id);
            setToast({ message: `Đã chọn vị trí ${local.code}`, type: "success" });
            setTimeout(() => setToast(null), 3000);
            return;
          }
          // 2) Tra cứu server — phân biệt rõ "không tồn tại" với "đầy / bảo trì /
          //    không phải vị trí chứa" thay vì gộp chung thành "đã sử dụng".
          try {
            const r = await fetch(`${basePath}/api/locations/by-code?code=${encodeURIComponent(code)}`);
            const j = await r.json();
            if (!j.success || !j.data) {
              setToast({ message: j.error || `Vị trí "${code}" không tồn tại.`, type: "error" });
            } else {
              const loc = j.data;
              if (loc.type && loc.type !== "STORAGE") {
                setToast({ message: `Vị trí "${loc.code}" không phải vị trí chứa (${loc.type}).`, type: "error" });
              } else if (loc.status === "MAINTENANCE") {
                setToast({ message: `Vị trí "${loc.code}" đang bảo trì.`, type: "error" });
              } else if (loc.is_active === false) {
                setToast({ message: `Vị trí "${loc.code}" đang ngừng hoạt động.`, type: "error" });
              } else if (loc.is_full) {
                setToast({ message: `Vị trí "${loc.code}" đã đầy (${loc.current_pallets_count}/${loc.max_pallets}).`, type: "error" });
              } else {
                // Hợp lệ nhưng chưa có trong danh sách (vd: vừa trống ra) → thêm & chọn.
                const opt: LocationOption = { id: loc.id, code: loc.code, zone: loc.zone, rack: loc.rack, level: loc.level };
                setLocations((prev) => (prev.some((x) => x.id === opt.id) ? prev : [opt, ...prev]));
                setNewLocationId(opt.id);
                setToast({ message: `Đã chọn vị trí ${opt.code}`, type: "success" });
              }
            }
          } catch {
            setToast({ message: "Lỗi tra cứu vị trí.", type: "error" });
          }
          setTimeout(() => setToast(null), 3800);
        }}
        onClose={() => setShowLocationScanner(false)}
        title="Quét QR vị trí kho mới"
      />

      <BarcodeScanner
        isOpen={showPalletScanner}
        onScan={async (raw) => {
          setShowPalletScanner(false);
          const code = extractScannedCode(raw);
          if (!code) return;
          // 1) Khớp trong danh sách đã tải (không phân biệt hoa/thường).
          const local = pallets.find((p) => p.code.toLowerCase() === code.toLowerCase());
          if (local) {
            setPalletId(local.id);
            setToast({ message: `Đã chọn pallet ${local.code}`, type: "success" });
            setTimeout(() => setToast(null), 3000);
            return;
          }
          // 2) Tra cứu server — danh sách chỉ tải 200 pallet mới nhất nên pallet cũ
          //    hoặc khác hoa/thường vẫn tìm được; báo lỗi chính xác theo trạng thái.
          try {
            const r = await fetch(`${basePath}/api/pallets/by-code?code=${encodeURIComponent(code)}`);
            const j = await r.json();
            if (!j.success || !j.data) {
              setToast({ message: j.error || `Pallet "${code}" không tồn tại.`, type: "error" });
            } else if (j.data.status !== "IN_STORAGE") {
              setToast({ message: `Pallet ${j.data.code} không ở trong kho (trạng thái: ${j.data.status}).`, type: "error" });
            } else {
              const p = j.data;
              const opt: PalletOption = {
                id: p.id,
                code: p.code,
                location_id: p.location?.id ?? null,
                location: p.location ? { id: p.location.id, code: p.location.code, zone: p.location.zone } : null,
                supplier: p.supplier ? { name: p.supplier.name } : null,
                totalWeightKg: Number(p.total_weight_kg) || 0,
              };
              setPallets((prev) => (prev.some((x) => x.id === opt.id) ? prev : [opt, ...prev]));
              setPalletId(opt.id);
              setToast({ message: `Đã chọn pallet ${opt.code}`, type: "success" });
            }
          } catch {
            setToast({ message: "Lỗi tra cứu pallet.", type: "error" });
          }
          setTimeout(() => setToast(null), 3500);
        }}
        onClose={() => setShowPalletScanner(false)}
        title="Quét QR mã pallet"
      />
    </>
  );
}
