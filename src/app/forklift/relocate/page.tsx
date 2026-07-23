"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
// Phase 3.2: KHÔNG dùng AppLayout (đây là page mobile, layout đã có sẵn từ forklift/layout.tsx)
import { BarcodeScanner } from "@/components/BarcodeScanner";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { ScanField, MobileToast } from "@/components/mobile";
import { Modal } from "@/components/ui";

type PalletOption = { id: string; code: string; location_id: string | null; location?: { id: string; code: string; zone: string } | null; supplier?: { name: string } | null; totalWeightKg?: number };
type LocationOption = { id: string; code: string; zone: string; rack: string; level: string };
/** Pallet trả về từ `/api/locations/by-code` — dùng khi xe nâng quét nhãn dán trên kệ. */
type LocationPallet = { id: string; code: string; status: string; total_lines: number; total_weight_kg: string };
/** Vị trí đang được mở trong modal "chọn pallet trên kệ". */
type PickerLocation = { id: string; code: string; zone: string };

/**
 * Mã vị trí kho có dạng Khu-Kệ-Tầng, vd `A-03-02`, `AB-01-01`.
 * Mã pallet là `PLYYMMDD.NNN` nên hai định dạng không bao giờ đụng nhau —
 * nhờ vậy phân biệt được người dùng vừa quét nhãn kệ hay nhãn pallet.
 */
const LOCATION_CODE_RE = /^[A-Za-z]+-\d{2}-\d{2}$/;

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

function RelocateContent() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  // Dashboard Xe nâng điều hướng sang đây kèm `?pallet_id=` (ForkliftMobileDashboard
  // `getHref`). Trước đây trang bỏ qua tham số này nên ô Pallet luôn rỗng khi bấm
  // từ danh sách việc — cùng khuôn với put-away/page.tsx và return/page.tsx.
  const searchParams = useSearchParams();
  const preselectedPalletId = searchParams.get("pallet_id") || "";

  const [pallets, setPallets] = useState<PalletOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [palletId, setPalletId] = useState(preselectedPalletId);
  const [newLocationId, setNewLocationId] = useState("");
  const [reasonCode, setReasonCode] = useState<string>("");
  const [reasonNote, setReasonNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showLocationScanner, setShowLocationScanner] = useState(false);
  const [showPalletScanner, setShowPalletScanner] = useState(false);
  // Modal "chọn pallet trên kệ" khi quét nhãn vị trí có nhiều hơn 1 pallet.
  const [pickerLoc, setPickerLoc] = useState<PickerLocation | null>(null);
  const [pickerPallets, setPickerPallets] = useState<LocationPallet[]>([]);
  // Gợi ý chuyển sang màn Hoàn trả khi pallet quét được đang ở khu chờ xuất.
  const [returnHint, setReturnHint] = useState<{ id: string; code: string } | null>(null);
  // Ô "Lọc nhanh": kho lớn thì danh sách bị cắt bớt, pallet cũ không hiện trong
  // dropdown. Gõ mã pallet hoặc mã kệ để hỏi lại server thay vì lọc phía client.
  const [palletQuery, setPalletQuery] = useState("");
  const [loadingPallets, setLoadingPallets] = useState(false);

  // Load danh sách pallet đang ở trong kho — gọi lại mỗi khi đổi từ khoá lọc.
  useEffect(() => {
    const term = palletQuery.trim();
    const url =
      `${basePath}/api/pallets?status=IN_STORAGE&limit=50&skip_kpis=1` +
      (term ? `&q=${encodeURIComponent(term)}` : "");
    // Debounce để không bắn request theo từng phím gõ.
    const timer = setTimeout(() => {
      setLoadingPallets(true);
      fetch(url)
        .then((r) => r.json())
        .then((r) => {
          if (!r.success) return;
          // Giữ lại pallet đang chọn kể cả khi nó rơi ra ngoài kết quả lọc,
          // nếu không `<select>` sẽ mất giá trị đang chọn.
          setPallets((prev) => {
            const keep = prev.filter((p) => p.id === palletId && !r.data.some((x: PalletOption) => x.id === p.id));
            return [...keep, ...r.data];
          });
        })
        .finally(() => setLoadingPallets(false));
    }, term ? 300 : 0);
    return () => clearTimeout(timer);
    // `palletId` cố ý không nằm trong deps — chỉ dùng để giữ lựa chọn hiện tại,
    // đổi pallet không cần tải lại danh sách.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath, palletQuery]);

  // Pallet preselect từ Dashboard có thể không nằm trong danh sách vừa tải
  // (danh sách bị giới hạn số bản ghi) → nạp riêng để `<select>` hiển thị đúng.
  // Chỉ phụ thuộc id nên chạy đúng 1 lần, không lặp theo `pallets`.
  useEffect(() => {
    if (!preselectedPalletId) return;
    fetch(`${basePath}/api/pallets/${preselectedPalletId}`)
      .then((r) => r.json())
      .then((r) => {
        if (!r.success || !r.data) return;
        const p = r.data;
        const opt: PalletOption = {
          id: p.id,
          code: p.code,
          location_id: p.location?.id ?? null,
          location: p.location ? { id: p.location.id, code: p.location.code, zone: p.location.zone } : null,
          supplier: p.supplier ? { name: p.supplier.name } : null,
          totalWeightKg: Number(p.total_weight_kg) || 0,
        };
        setPallets((prev) => (prev.some((x) => x.id === opt.id) ? prev : [opt, ...prev]));
      })
      .catch(() => {
        /* không chặn luồng — người dùng vẫn chọn tay được */
      });
  }, [basePath, preselectedPalletId]);

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

  /**
   * Chọn một pallet lấy được từ luồng "quét nhãn kệ".
   * Phải nạp vào `pallets` state thì khối "Vị trí hiện tại" và bộ lọc
   * `locations/available?pallet_weight_kg=` mới tính đúng.
   */
  const selectPalletFromLocation = (p: LocationPallet, loc: PickerLocation) => {
    const opt: PalletOption = {
      id: p.id,
      code: p.code,
      location_id: loc.id,
      location: { id: loc.id, code: loc.code, zone: loc.zone },
      supplier: null,
      totalWeightKg: Number(p.total_weight_kg) || 0,
    };
    setPallets((prev) => (prev.some((x) => x.id === opt.id) ? prev : [opt, ...prev]));
    setPalletId(opt.id);
    setReturnHint(null);
  };

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
        setReturnHint(null);
        // Xoá từ khoá lọc → effect tự nạp lại danh sách pallet mới nhất.
        setPalletQuery("");
        fetch(`${basePath}/api/pallets?status=IN_STORAGE&limit=50&skip_kpis=1`)
          .then(r => r.json())
          .then(r => { if (r.success) setPallets(r.data); });
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
              <div className="space-y-2">
                {/* Lọc nhanh — hỏi lại server, tìm được cả pallet cũ không nằm trong danh sách mặc định. */}
                <div className="relative">
                  <input
                    type="text"
                    inputMode="search"
                    value={palletQuery}
                    onChange={(e) => setPalletQuery(e.target.value)}
                    placeholder="Lọc nhanh: mã pallet hoặc mã kệ (vd B-24)…"
                    className="w-full px-3 py-2.5 pr-9 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {loadingPallets && (
                    <span className="material-symbols-outlined animate-spin text-[18px] text-primary absolute right-2.5 top-1/2 -translate-y-1/2">
                      progress_activity
                    </span>
                  )}
                </div>
                <select value={palletId} onChange={e => setPalletId(e.target.value)} required
                  className="w-full px-3 py-2.5 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                  <option value="">— Chọn pallet đang trong kho —</option>
                  {pallets.map(p => <option key={p.id} value={p.id}>{p.code} — Vị trí: {p.location?.code || "N/A"}</option>)}
                </select>
              </div>
            </ScanField>
            <p className="mt-1.5 text-[11px] text-on-surface-variant/80">
              Quét được cả nhãn pallet lẫn nhãn kệ — quét kệ sẽ hiện pallet đang nằm ở đó.
            </p>
            {palletQuery.trim() && !loadingPallets && pallets.length === 0 && (
              <p className="mt-1.5 text-[11px] text-amber-700">
                Không có pallet nào trong kho khớp &quot;{palletQuery.trim()}&quot;.
              </p>
            )}
            {selected?.location && (
              <div className="mt-2 p-3 bg-indigo-50 rounded-lg text-sm text-indigo-800">
                Vị trí hiện tại: <strong>{selected.location.code}</strong> (Khu {selected.location.zone})
              </div>
            )}
            {/* Quét trúng pallet đang ở khu chờ xuất → chỉ đường sang đúng chức năng. */}
            {returnHint && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] shrink-0">info</span>
                <span className="min-w-0">
                  Pallet <strong>{returnHint.code}</strong> đang ở khu chờ xuất, không chuyển vị trí trực tiếp được.{" "}
                  <Link
                    href={`/forklift/return?pallet_id=${returnHint.id}`}
                    className="font-semibold underline underline-offset-2"
                  >
                    Mở màn Hoàn trả vị trí →
                  </Link>
                </span>
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
          setReturnHint(null);

          // 0) Mã có dạng vị trí (X-NN-NN) → người dùng vừa quét nhãn dán trên KỆ.
          //    Đây là thao tác tự nhiên nhất của xe nâng: đứng trước kệ, quét kệ,
          //    rồi chọn pallet cần chuyển. Trước đây luồng này báo
          //    'Pallet "B-24-02" không tồn tại' khiến người dùng tưởng kệ không có hàng.
          if (LOCATION_CODE_RE.test(code)) {
            const locCode = code.toUpperCase();
            try {
              const r = await fetch(`${basePath}/api/locations/by-code?code=${encodeURIComponent(locCode)}`);
              const j = await r.json();
              if (!j.success || !j.data) {
                setToast({ message: `Không tìm thấy vị trí "${locCode}".`, type: "error" });
              } else {
                const loc: PickerLocation = { id: j.data.id, code: j.data.code, zone: j.data.zone };
                const inStock: LocationPallet[] = (j.data.pallets || []).filter(
                  (p: LocationPallet) => p.status === "IN_STORAGE"
                );
                if (inStock.length === 0) {
                  setToast({ message: `Vị trí ${loc.code} hiện không có pallet nào trong kho.`, type: "error" });
                } else if (inStock.length === 1) {
                  selectPalletFromLocation(inStock[0], loc);
                  setToast({ message: `Đã chọn pallet ${inStock[0].code} đang ở ${loc.code}`, type: "success" });
                } else {
                  // Nhiều pallet trên cùng vị trí → để người dùng chọn.
                  setPickerLoc(loc);
                  setPickerPallets(inStock);
                  return; // modal tự đóng khi chọn xong, không hẹn giờ tắt toast
                }
              }
            } catch {
              setToast({ message: `Lỗi tra cứu vị trí "${locCode}".`, type: "error" });
            }
            setTimeout(() => setToast(null), 4000);
            return;
          }

          // 1) Khớp trong danh sách đã tải (không phân biệt hoa/thường).
          const local = pallets.find((p) => p.code.toLowerCase() === code.toLowerCase());
          if (local) {
            setPalletId(local.id);
            setToast({ message: `Đã chọn pallet ${local.code}`, type: "success" });
            setTimeout(() => setToast(null), 3000);
            return;
          }
          // 2) Tra cứu server — danh sách chỉ tải một phần nên pallet cũ hoặc khác
          //    hoa/thường vẫn tìm được; báo lỗi chính xác theo trạng thái.
          try {
            const r = await fetch(`${basePath}/api/pallets/by-code?code=${encodeURIComponent(code)}`);
            const j = await r.json();
            if (!j.success || !j.data) {
              setToast({
                message: `Không tìm thấy "${code}". Kiểm tra lại nhãn, hoặc chọn pallet từ danh sách.`,
                type: "error",
              });
            } else if (j.data.status === "IN_STAGING") {
              // Không phải lỗi — chỉ là sai chức năng. Chỉ đường sang Hoàn trả.
              setReturnHint({ id: j.data.id, code: j.data.code });
              setToast({
                message: `Pallet ${j.data.code} đang ở khu chờ xuất — dùng chức năng "Hoàn trả".`,
                type: "error",
              });
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
        title="Quét QR mã pallet hoặc mã kệ"
      />

      {/* Quét nhãn kệ mà kệ đang chứa nhiều pallet → cho chọn. */}
      <Modal open={!!pickerLoc} onClose={() => setPickerLoc(null)} size="sm">
        <Modal.Header onClose={() => setPickerLoc(null)}>
          Pallet tại vị trí {pickerLoc?.code}
        </Modal.Header>
        <Modal.Body>
          <p className="text-sm text-on-surface-variant mb-3">
            Vị trí này đang có <strong>{pickerPallets.length}</strong> pallet. Chọn pallet cần chuyển:
          </p>
          <ul className="space-y-2">
            {pickerPallets.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!pickerLoc) return;
                    selectPalletFromLocation(p, pickerLoc);
                    setToast({ message: `Đã chọn pallet ${p.code}`, type: "success" });
                    setTimeout(() => setToast(null), 3000);
                    setPickerLoc(null);
                  }}
                  className="w-full text-left min-h-[44px] px-3 py-2.5 border border-outline-variant rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <span className="block text-sm font-semibold text-primary">{p.code}</span>
                  <span className="block text-xs text-on-surface-variant">
                    {p.total_lines} dòng · {Number(p.total_weight_kg).toFixed(1)} kg
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default function RelocatePage() {
  // `useSearchParams` bắt buộc phải nằm trong Suspense boundary (Next.js App Router),
  // nếu không cả trang sẽ rơi sang client-side rendering lúc build.
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[60vh]">
          <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
        </div>
      }
    >
      <RelocateContent />
    </Suspense>
  );
}
