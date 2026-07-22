"use client";
import { DateField } from "@/components/mobile";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { BackLink } from "@/components/mobile/BackLink";
import { useToast, useConfirm } from "@/components/ui";
import { labelOf, STOCKTAKE_STATUS_LABEL } from "@/lib/status-labels";

type PalletLine = {
  id: string;
  qty_box: string | number;
  lot: string | null;
  expiry_date: string | null;
  manufactured_date: string | null;
  pallet: { id: string; code: string };
  item_code: { id: string; code: string; short_name: string };
};

type CountItem = {
  id: string;
  location_id?: string | null;
  item_code_id?: string | null;
  location?: { id: string; code: string; zone: string; rack: string; level: string; type?: string } | null;
  item_code?: { id: string; code: string; short_name: string; full_name?: string | null } | null;
  system_qty: number | string;
  actual_qty: number | string | null;
  discrepancy: number | string | null;
  lot_actual: string | null;
  expiry_actual: string | null;
  note: string | null;
  pallet_lines?: PalletLine[];
  // Trạng thái đã được kế toán chấp nhận (khóa cứng, không cho sửa)
  adjusted?: boolean;
  adjusted_voucher_code?: string | null;
  // UC-INV-06: pallet phát hiện NGOÀI hệ thống khi kiểm kê
  is_outside_system?: boolean;
  found_pallet_code?: string | null;
};

type Session = {
  id: string;
  code: string;
  status: string;
  type: string;
  counts: CountItem[];
};

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("vi-VN") : "—");

const parseNote = (note: string | null) => {
  if (!note) return { prefix: "", cleanNote: "" };
  const match = note.match(/^(\[Pallet:\s*[^\]]+\])\s*(.*)$/);
  if (match) {
    return { prefix: match[1], cleanNote: match[2] };
  }
  return { prefix: "", cleanNote: note };
};

export default function KiemkeTaskDetailPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const params = useParams();
  const id = params.id as string;
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState(""); // UC-INV-06/07: tìm kiếm trong phiếu kiểm kê
  const [localCounts, setLocalCounts] = useState<
    Record<string, { actual_qty: number | null; lot: string; expiry_date: string; note: string }>
  >({});
  // Snapshot giá trị lúc tải để biết dòng nào user đã sửa (kể cả chỉ sửa Lô/HSD/ghi chú)
  const initialCountsRef = useRef<Record<string, { actual_qty: number | null; lot: string; expiry_date: string; note: string }>>({});

  // UC-INV-06: form "Thêm pallet ngoài hệ thống" — chỉ mở 1 thẻ tại 1 thời điểm
  const [extraOpenFor, setExtraOpenFor] = useState<string | null>(null);
  const [exCode, setExCode] = useState("");
  const [exResolved, setExResolved] = useState<{ id: string; code: string; name: string } | null>(null);
  const [exQty, setExQty] = useState("");
  const [exLot, setExLot] = useState("");
  const [exExpiry, setExExpiry] = useState("");
  const [exNote, setExNote] = useState("");
  const [exLookupErr, setExLookupErr] = useState<string | null>(null);
  const [exLooking, setExLooking] = useState(false);
  const [exSaving, setExSaving] = useState(false);

  const { toast } = useToast();
  const { confirm: showConfirm } = useConfirm();

  const fetchSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${basePath}/api/stock-count/${id}`);
      const json = await res.json();
      if (json.success) {
        setSession(json.data);
        const initial: Record<string, { actual_qty: number | null; lot: string; expiry_date: string; note: string }> = {};
        (json.data.counts || []).forEach((c: CountItem) => {
          // Default lô / HSD = giá trị từ pallet_line đầu tiên (nếu có) để user dễ xác nhận
          const firstPL = c.pallet_lines?.[0];
          const { cleanNote } = parseNote(c.note);
          initial[c.id] = {
            actual_qty: c.actual_qty !== null ? Number(c.actual_qty) : null,
            lot: c.lot_actual || firstPL?.lot || "",
            expiry_date: c.expiry_actual
              ? c.expiry_actual.slice(0, 10)
              : firstPL?.expiry_date
              ? String(firstPL.expiry_date).slice(0, 10)
              : "",
            note: cleanNote,
          };
        });
        initialCountsRef.current = initial;
        setLocalCounts(initial);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [basePath, id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${basePath}/api/stock-count/${id}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          setSession(json.data);
          const initial: Record<string, { actual_qty: number | null; lot: string; expiry_date: string; note: string }> = {};
          (json.data.counts || []).forEach((c: CountItem) => {
            const firstPL = c.pallet_lines?.[0];
            const { cleanNote } = parseNote(c.note);
            initial[c.id] = {
              actual_qty: c.actual_qty !== null ? Number(c.actual_qty) : null,
              lot: c.lot_actual || firstPL?.lot || "",
              expiry_date: c.expiry_actual
                ? c.expiry_actual.slice(0, 10)
                : firstPL?.expiry_date
                ? String(firstPL.expiry_date).slice(0, 10)
                : "",
              note: cleanNote,
            };
          });
          initialCountsRef.current = initial;
          setLocalCounts(initial);
        }
      } catch (e) {
        if (!cancelled) console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [basePath, id]);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(localCounts)
        .filter(([countId, val]) => {
          // Bỏ qua dòng đã adjusted (kế toán đã chấp nhận)
          const original = session?.counts.find(c => c.id === countId);
          if (original?.adjusted) return false;
          // Bỏ qua dòng pallet ngoài hệ thống (đã lưu riêng qua quick-scan, chờ duyệt)
          if (original?.is_outside_system) return false;
          // Lưu nếu user đã sửa bất kỳ thứ gì so với lúc tải: SL, Lô, HSD hoặc ghi chú
          const init = initialCountsRef.current[countId];
          if (!init) return val.actual_qty !== null && val.actual_qty !== undefined;
          return (
            init.actual_qty !== val.actual_qty ||
            init.lot !== val.lot ||
            init.expiry_date !== val.expiry_date ||
            init.note !== val.note
          );
        })
        .map(([countId, val]) => {
          const original = session?.counts.find(c => c.id === countId);
          const { prefix } = parseNote(original?.note || null);
          const finalNote = prefix ? `${prefix} ${val.note}`.trim() : val.note;
          return {
            count_id: countId,
            actual_qty: val.actual_qty,
            note: finalNote || null,
            lot: val.lot || null,
            expiry_date: val.expiry_date || null,
          };
        });
      if (updates.length === 0) {
        toast.warning("Chưa có thay đổi nào để lưu.");
        setSaving(false);
        return;
      }
      const res = await fetch(`${basePath}/api/stock-count/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counts: updates }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Đã lưu ${updates.length} dòng`);
        fetchSession();
      } else {
        toast.error(json.error || "Lưu thất bại");
      }
    } catch (e) {
      console.error(e);
      toast.error("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  };

  // UC-INV-06: reset & mở form pallet ngoài hệ thống
  const resetExtraForm = () => {
    setExCode(""); setExResolved(null); setExQty(""); setExLot("");
    setExExpiry(""); setExNote(""); setExLookupErr(null);
  };
  const openExtraForm = (countId: string) => {
    resetExtraForm();
    setExtraOpenFor(countId);
  };

  // UC-INV-06: tra mã hàng cho pallet ngoài hệ thống
  const resolveExtraItem = async () => {
    const code = exCode.trim();
    if (!code) return;
    setExCode(code);
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

  // UC-INV-06: lưu 1 pallet ngoài hệ thống vào phiên hiện tại (chờ Quản lý duyệt)
  const saveExtraPallet = async (locationId: string) => {
    if (!exResolved) { setExLookupErr("Vui lòng tra mã hàng trước."); return; }
    const q = Number(exQty);
    if (Number.isNaN(q) || q <= 0) { setExLookupErr("Số lượng phải lớn hơn 0."); return; }
    setExSaving(true);
    setExLookupErr(null);
    try {
      const res = await fetch(`${basePath}/api/stock-count/quick-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: locationId,
          session_id: id,
          items: [],
          extra_pallets: [{
            item_code_id: exResolved.id,
            actual_qty: q,
            lot: exLot.trim() || undefined,
            expiry: exExpiry || undefined,
            note: exNote.trim() || undefined,
          }],
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Đã thêm pallet ngoài hệ thống — chờ Quản lý duyệt để tạo pallet.");
        setExtraOpenFor(null);
        resetExtraForm();
        fetchSession();
      } else {
        setExLookupErr(json.error || "Lưu thất bại");
      }
    } catch {
      setExLookupErr("Lỗi kết nối");
    } finally {
      setExSaving(false);
    }
  };

  const handleComplete = async () => {
    const unCounted = session?.counts?.filter(
      (c) => localCounts[c.id]?.actual_qty === null || localCounts[c.id]?.actual_qty === undefined
    ).length || 0;
    if (unCounted > 0) {
      const ok = await showConfirm({
        title: "Hoàn tất phiên kiểm kê?",
        description: `Còn ${unCounted} dòng chưa đếm. Bạn vẫn muốn chốt phiên?`,
        confirmText: "Hoàn tất",
      });
      if (!ok) return;
    }
    try {
      const res = await fetch(`${basePath}/api/stock-count/${id}/complete`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success("Đã hoàn tất phiên kiểm kê");
        fetchSession();
      } else {
        toast.error(json.error || "Hoàn tất thất bại");
      }
    } catch (e) {
      console.error(e);
      toast.error("Lỗi kết nối");
    }
  };

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
      </div>
    );
  }

  const totalCounts = session.counts?.length || 0;
  // UC-INV-06/07: lọc danh sách theo ô tìm kiếm (vị trí / mã hàng / tên)
  const sq = search.trim().toLowerCase();
  const visibleCounts = (session.counts || []).filter(c => !sq
    || c.location?.code?.toLowerCase().includes(sq)
    || c.item_code?.code?.toLowerCase().includes(sq)
    || c.item_code?.short_name?.toLowerCase().includes(sq));
  const countedCount = Object.values(localCounts).filter(
    (v) => v.actual_qty !== null && v.actual_qty !== undefined
  ).length;
  const progress = totalCounts ? Math.round((countedCount / totalCounts) * 100) : 0;
  const isReadonly = session.status === "CLOSED" || session.status === "RECONCILING";

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      <BackLink href="/kiemke/tasks">DS nhiệm vụ</BackLink>

      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary-hover text-white rounded-2xl p-lg shadow-lg relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
        <div className="flex justify-between items-start z-10 relative">
          <div>
            <span className="font-mono text-xl font-bold">{session.code || `STK-${id.slice(0, 8)}`}</span>
            <p className="text-sm text-white/80 mt-1">
              {session.type === "BY_LOCATION" ? "📍 Kiểm kê theo vị trí" : "🏷️ Kiểm kê theo mã hàng"}
            </p>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold bg-white/20">{labelOf(STOCKTAKE_STATUS_LABEL, session.status)}</span>
        </div>
        <div className="mt-3 z-10 relative">
          <div className="flex justify-between text-[11px] md:text-xs text-white/70 mb-1">
            <span>Đã đếm {countedCount}/{totalCounts}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </div>

      {/* Count Items */}
      <div className="flex flex-col gap-sm">
        <span className="font-mono text-[11px] md:text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Danh sách {session.type === "BY_LOCATION" ? "vị trí" : "mã hàng"} ({totalCounts})
        </span>

        {/* UC-INV-06/07: tìm kiếm theo vị trí / mã hàng trong phiếu */}
        {totalCounts > 0 && (
          <div className="flex items-center gap-2 px-3 border border-outline-variant rounded-lg bg-surface-low">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant/70">search</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm vị trí / mã hàng..." className="flex-1 bg-transparent py-2 text-sm focus:outline-none" />
            {search && <button onClick={() => setSearch("")} className="material-symbols-outlined text-[18px] text-on-surface-variant/70">close</button>}
          </div>
        )}

        {totalCounts > 0 && visibleCounts.length === 0 && (
          <div className="py-8 text-center text-sm text-on-surface-variant">Không tìm thấy vị trí/mã hàng khớp &quot;{search}&quot;.</div>
        )}

        {visibleCounts.map((count, idx) => {
          const local = localCounts[count.id] || { actual_qty: null, note: "" };

          // UC-INV-06: dòng pallet NGOÀI hệ thống — hiển thị read-only, chờ duyệt
          if (count.is_outside_system) {
            return (
              <div key={count.id} className="industrial-card p-3 rounded-xl shadow-sm border bg-amber-50/50 border-amber-300 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-on-surface-variant/60 bg-surface-low rounded px-1.5 py-0.5">#{idx + 1}</span>
                      {count.location && (
                        <span className="font-mono text-sm font-bold text-amber-700 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">location_on</span>{count.location.code}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-200/70 px-1.5 py-0.5 rounded">Ngoài hệ thống</span>
                    </div>
                    {count.item_code && (
                      <p className="text-[11px] mt-0.5">
                        <span className="font-mono font-bold text-amber-800">{count.item_code.code}</span>{" "}
                        <span className="text-on-surface-variant">{count.item_code.short_name}</span>
                      </p>
                    )}
                    <p className="text-[11px] text-on-surface-variant/80 mt-0.5">
                      SL thực: <b className="text-on-surface">{Number(count.actual_qty ?? 0)}</b>
                      {count.lot_actual ? ` · Lô ${count.lot_actual}` : ""}
                      {count.expiry_actual ? ` · HSD ${fmtDate(count.expiry_actual)}` : ""}
                      {count.found_pallet_code ? ` · Pallet ${count.found_pallet_code}` : ""}
                    </p>
                  </div>
                  {count.adjusted ? (
                    <span className="shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full whitespace-nowrap">Đã duyệt</span>
                  ) : (
                    <span className="shrink-0 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full whitespace-nowrap">Chờ duyệt</span>
                  )}
                </div>
              </div>
            );
          }

          const systemQty = Number(count.system_qty);
          const diff = local.actual_qty !== null ? local.actual_qty - systemQty : null;
          const diffColor = diff === null ? "" : diff === 0 ? "text-success" : "text-error";
          const isStagingOut =
            count.location?.type === "OUTBOUND_STAGING" ||
            count.location?.zone === "STAGING_OUT" ||
            /STAGING|CHO[_-]XUAT|CHỜ XUẤT|STG-OUT|STG_OUT/i.test(count.location?.code || "");
          const palletLines = count.pallet_lines || [];
          // Khóa từng dòng đã được kế toán chấp nhận (adjusted), bất kể trạng thái phiên
          const isLineAdjusted = count.adjusted === true;
          const isLineReadonly = isReadonly || isLineAdjusted;

          return (
            <div key={count.id} className={`industrial-card p-3 rounded-xl shadow-sm space-y-3 border ${isStagingOut ? "bg-amber-50/40 border-amber-300" : "bg-surface border-outline-variant/40"}`}>
              {/* Header card: STT + vị trí + mã hàng */}
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-on-surface-variant/60 bg-surface-low rounded px-1.5 py-0.5">
                      #{idx + 1}
                    </span>
                    {count.location && (
                      <span className={`font-mono text-sm font-bold flex items-center gap-1 ${isStagingOut ? "text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200" : "text-primary"}`}>
                        <span className="material-symbols-outlined text-[14px]">{isStagingOut ? "warning" : "location_on"}</span>
                        {count.location.code} {isStagingOut && <span className="text-[11px] font-sans font-normal">(Khu chờ xuất)</span>}
                      </span>
                    )}
                    {count.item_code && (
                      <span className="font-mono text-sm font-bold text-secondary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                        {count.item_code.code}
                      </span>
                    )}
                  </div>
                  {count.location && (
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      Khu {count.location.zone} · Kệ {count.location.rack} · Tầng {count.location.level}
                    </p>
                  )}
                  {count.item_code && (
                    <p className="text-[11px] text-on-surface mt-0.5 font-medium">{count.item_code.short_name}</p>
                  )}
                </div>
                {diff !== null && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
                      diff === 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {diff > 0 ? "+" : ""}{diff}
                  </span>
                )}
              </div>

              {/* Chi tiết pallet/lô/HSD trong count */}
              {palletLines.length > 0 && (
                <div className="bg-surface-low/50 rounded-lg p-2 space-y-1.5">
                  <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    {palletLines.length === 1 ? "Pallet chi tiết" : `${palletLines.length} pallet/lô tại đây`}
                  </p>
                  {palletLines.map((pl) => (
                    <div key={pl.id} className="flex justify-between items-baseline text-[11px] gap-2 border-l-2 border-primary/30 pl-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-mono font-bold text-primary">{pl.pallet.code}</span>
                        {/* Hiện item code & name nếu chưa show ở header (vd: BY_LOCATION không có count.item_code) */}
                        {!count.item_code && pl.item_code && (
                          <span className="text-on-surface-variant ml-1">
                            · <span className="font-mono">{pl.item_code.code}</span> {pl.item_code.short_name}
                          </span>
                        )}
                        <div className="flex gap-2 text-on-surface-variant/80 mt-0.5 flex-wrap">
                          {pl.lot && <span>Lô: <span className="font-mono">{pl.lot}</span></span>}
                          {pl.expiry_date && <span>HSD: {fmtDate(pl.expiry_date)}</span>}
                          <span>SL: <strong className="text-on-surface">{Number(pl.qty_box)}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Dòng đã chấp nhận: hiển thị badge khóa thay input */}
              {isLineAdjusted ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
                    <span className="text-xs font-bold text-emerald-700">Đã chốt — kế toán chấp nhận</span>
                    {count.adjusted_voucher_code && (
                      <span className="ml-auto text-[11px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                        {count.adjusted_voucher_code}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-sm text-center">
                    <div>
                      <span className="text-[11px] text-on-surface-variant block">HT thống</span>
                      <span className="text-sm font-bold">{systemQty}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-on-surface-variant block">Đã đếm</span>
                      <span className="text-sm font-bold text-emerald-700">{local.actual_qty ?? "—"}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-on-surface-variant block">Chênh lệch</span>
                      <span className={`text-sm font-bold ${diffColor}`}>
                        {diff !== null ? (diff > 0 ? `+${diff}` : diff) : "—"}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-600/80 text-center">
                    Dòng này đã được giải quyết. Liên hệ kế toán nếu cần điều chỉnh lại.
                  </p>
                </div>
              ) : (
                <>
                  {/* Input 3 cột */}
                  <div className="grid grid-cols-3 gap-sm text-center">
                    <div>
                      <span className="text-[11px] md:text-xs text-on-surface-variant block">HT thống</span>
                      <span className="text-sm font-bold data-mono">{systemQty}</span>
                    </div>
                    <div>
                      <span className="text-[11px] md:text-xs text-on-surface-variant block">Thực đếm</span>
                      <input
                        type="number"
                        min="0"
                        value={local.actual_qty ?? ""}
                        disabled={isLineReadonly}
                        onChange={(e) =>
                          setLocalCounts((prev) => ({
                            ...prev,
                            [count.id]: { ...(prev[count.id] || { note: "" }), actual_qty: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) },
                          }))
                        }
                        className="w-full text-center text-sm font-bold border border-outline-variant rounded px-1 py-0.5 focus:border-primary focus:outline-none disabled:bg-surface-low"
                        placeholder="—"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] md:text-xs text-on-surface-variant block">Chênh lệch</span>
                      <span className={`text-sm font-bold ${diffColor}`}>
                        {diff !== null ? (diff > 0 ? `+${diff}` : diff) : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Lô + HSD nhập tay (người đếm xác nhận hoặc sửa) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-on-surface-variant uppercase block mb-0.5">
                        Lô (Lot)
                      </label>
                      <input
                        type="text"
                        placeholder="VD: LOT2026A"
                        value={local.lot}
                        disabled={isLineReadonly}
                        onChange={(e) =>
                          setLocalCounts((prev) => ({
                            ...prev,
                            [count.id]: {
                              ...(prev[count.id] || { actual_qty: null, expiry_date: "", note: "" }),
                              lot: e.target.value,
                            },
                          }))
                        }
                        className="w-full px-2 py-1.5 border border-outline-variant rounded text-xs font-mono bg-surface focus:outline-none focus:border-primary disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-on-surface-variant uppercase block mb-0.5">
                        HSD
                      </label>
                      <DateField
                        value={local.expiry_date || ""}
                        disabled={isLineReadonly}
                        onChange={(val) =>
                          setLocalCounts((prev) => ({
                            ...prev,
                            [count.id]: {
                              ...(prev[count.id] || { actual_qty: null, lot: "", note: "" }),
                              expiry_date: val,
                            },
                          }))
                        }
                        className="border-outline-variant"
                      />
                    </div>
                  </div>

                  {/* Ghi chú riêng */}
                  <div>
                    <label className="text-[11px] font-semibold text-on-surface-variant uppercase block mb-0.5">
                      Ghi chú
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ghi chú (vd: hàng vỡ, đếm lại 2 lần, lô bị trộn…)"
                      value={local.note}
                      disabled={isLineReadonly}
                      onChange={(e) =>
                        setLocalCounts((prev) => ({
                          ...prev,
                          [count.id]: {
                            ...(prev[count.id] || { actual_qty: null, lot: "", expiry_date: "" }),
                            note: e.target.value,
                          },
                        }))
                      }
                      className="w-full px-2 py-1.5 border border-outline-variant/60 rounded text-[11px] md:text-xs bg-surface-low focus:outline-none focus:border-primary disabled:opacity-60 resize-none"
                    />
                  </div>
                </>
              )}

              {/* UC-INV-06: Thêm pallet ngoài hệ thống tại chính vị trí này */}
              {!isLineReadonly && count.location?.id && (
                extraOpenFor === count.id ? (
                  <div className="rounded-xl bg-amber-50/50 border border-amber-300 p-3 space-y-2">
                    <p className="text-[11px] text-amber-800 font-semibold flex items-start gap-1">
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      Pallet có thật tại {count.location.code} nhưng hệ thống chưa ghi nhận. Sẽ chờ Quản lý duyệt rồi mới tạo pallet vào tồn.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Mã hàng / SKU (VD: Gif12348)"
                        value={exCode}
                        onChange={(e) => setExCode(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && resolveExtraItem()}
                        className="flex-1 min-w-0 px-2 py-1.5 border border-outline-variant rounded text-xs font-mono bg-surface focus:outline-none focus:border-primary"
                      />
                      <button
                        onClick={resolveExtraItem}
                        disabled={exLooking}
                        className="shrink-0 px-3 bg-amber-600 text-white rounded text-xs font-semibold disabled:opacity-50"
                      >
                        {exLooking ? "..." : "Tra"}
                      </button>
                    </div>
                    {exResolved && (
                      <div className="text-[11px] text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                        ✓ {exResolved.code} — {exResolved.name}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] text-on-surface-variant">
                        SL thực (thùng) *
                        <input
                          type="number"
                          min="1"
                          value={exQty}
                          onChange={(e) => setExQty(e.target.value)}
                          className="w-full mt-1 px-2 py-1.5 border border-outline-variant rounded text-xs focus:border-primary focus:outline-none"
                        />
                      </label>
                      <label className="text-[11px] text-on-surface-variant">
                        Lô (nếu có)
                        <input
                          type="text"
                          value={exLot}
                          onChange={(e) => setExLot(e.target.value)}
                          className="w-full mt-1 px-2 py-1.5 border border-outline-variant rounded text-xs font-mono focus:border-primary focus:outline-none"
                        />
                      </label>
                      <div className="text-[11px] text-on-surface-variant">
                        <span className="block">HSD (nếu có)</span>
                        <DateField value={exExpiry} onChange={setExExpiry} className="mt-1 border-outline-variant" />
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Ghi chú (vì sao pallet nằm ngoài hệ thống)..."
                      value={exNote}
                      onChange={(e) => setExNote(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 border border-outline-variant rounded focus:border-primary focus:outline-none"
                    />
                    {exLookupErr && (
                      <div className="text-xs text-rose-700 font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">error</span> {exLookupErr}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setExtraOpenFor(null); resetExtraForm(); }}
                        className="flex-1 py-2 border border-outline-variant rounded-lg text-xs font-semibold"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={() => count.location?.id && saveExtraPallet(count.location.id)}
                        disabled={!exResolved || exSaving}
                        className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {exSaving ? (
                          <>
                            <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                            Đang lưu…
                          </>
                        ) : (
                          "Lưu pallet ngoài HT"
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openExtraForm(count.id)}
                    className="w-full py-2 border border-dashed border-amber-400 text-amber-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 active:scale-[0.98] transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Thêm pallet ngoài hệ thống
                  </button>
                )
              )}

            </div>
          );
        })}
      </div>

      {/* Actions */}
      {!isReadonly && (
        <div className="flex flex-col gap-sm mt-2 sticky bottom-2">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="w-full py-3 bg-primary text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
          >
            <span className="material-symbols-outlined text-lg">{saving ? "progress_activity" : "save"}</span>
            {saving ? "Đang lưu..." : "Lưu tất cả"}
          </button>
          {progress >= 80 && (
            <button
              onClick={handleComplete}
              className="w-full py-3 border-2 border-green-600 text-green-600 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-green-50 bg-white"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              Hoàn tất kiểm kê
            </button>
          )}
        </div>
      )}


    </div>
  );
}
