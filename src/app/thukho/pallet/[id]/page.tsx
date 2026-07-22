"use client";
import { DateField } from "@/components/mobile";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { mobileHref } from "@/lib/mobile-href";
import { BackLink } from "@/components/mobile/BackLink";
import { useToast, useConfirm } from "@/components/ui";

// UC-PAL-03: Modal quét barcode — dynamic import vì html5-qrcode chỉ chạy ở client
const BarcodeScannerModal = dynamic(
  () => import("@/components/shared/BarcodeScannerModal").then((m) => m.BarcodeScannerModal),
  { ssr: false }
);

type PalletLine = {
  id: string;
  item_code: { id: string; code: string; short_name: string; unit?: { name: string; symbol?: string } };
  qty_box: number;
  qty_unit: number; // TC_CONFIRM_PAL_026: số đơn vị lẻ đã quy đổi (= qty_box × units_per_box)
  lot: string | null;
  expiry_date: string | null;
  weight_kg: string | null;
  note: string | null;
};

type PalletDetail = {
  id: string;
  code: string;
  status: string;
  note: string | null;
  total_weight_kg: string | null;
  created_at: string;
  confirmed_at: string | null;
  supplier: { id: string; code: string; name: string } | null;
  inbound_request_id: string | null;
  inbound_request: { id: string; code: string } | null;
  lines: PalletLine[];
};

type HistoryItem = {
  id: string;
  kind?: "audit" | "movement" | "created";
  action: string;
  label?: string;
  reason: string | null;
  detail?: string | null;
  status_from?: string | null;
  status_to?: string | null;
  performed_by_name?: string | null;
  performed_by_role?: string | null;
  performed_at: string;
  from_location?: { code: string; zone: string } | null;
  to_location?: { code: string; zone: string } | null;
};

const PAL_ACTION_LABEL: Record<string, string> = {
  CREATE_PALLET: "Tạo pallet",
  ADD_PALLET_LINE: "Thêm dòng hàng",
  DELETE_PALLET_LINE: "Xóa dòng hàng",
  CONFIRM_PALLET: "Xác nhận pallet",
  UNLOCK_PALLET: "Mở khóa pallet",
  CANCEL_PALLET: "Hủy pallet",
  PUT_AWAY: "Đưa vào vị trí",
  RELOCATE: "Chuyển vị trí",
  STAGE_OUT: "Sang khu chờ xuất",
  STAGE_OUT_FULL: "Sang khu chờ xuất (full)",
  RETURN: "Hoàn trả vị trí",
  CREATE: "Tạo pallet",
  CONFIRM: "Xác nhận pallet",
  UNLOCK: "Mở lại pallet",
  ADD_LINE: "Thêm hàng",
  DELETE_LINE: "Xóa hàng",
};

const PAL_ROLE_LABEL: Record<string, string> = {
  ADMIN: "Quản trị",
  MANAGER: "Quản lý",
  QUAN_LY: "Quản lý",
  KE_TOAN: "Kế toán",
  THU_KHO: "Thủ kho",
  XE_NANG: "Xe nâng",
  KIEM_KE: "Kiểm kê",
  STAFF: "Nhân viên",
};
type ItemCode = {
  id: string;
  code: string;
  short_name: string;
  unit?: { name: string; symbol?: string };
  units_per_box?: number;
  // fix 1 phiếu — nhiều pallet: "còn lại theo phiếu" (chỉ có khi pallet link phiếu nhập)
  phn_qty_expected?: number;
  phn_qty_on_pallet?: number;
  phn_qty_remaining?: number;
};

export default function ThukhoPalletDetailPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const params = useParams();
  const palletId = params.id as string;

  const [pallet, setPallet] = useState<PalletDetail | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"lines" | "history">("lines");

  // Add line form
  const [itemSearch, setItemSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ItemCode[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemCode | null>(null);
  const [qty, setQty] = useState("");
  const [lot, setLot] = useState("");
  const [expiry, setExpiry] = useState("");
  const [lineNote, setLineNote] = useState("");
  const [addingLine, setAddingLine] = useState(false);

  // Confirm/unlock — UC-PAL-04
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAcknowledged, setConfirmAcknowledged] = useState(false);  // Checkbox "đã kiểm đếm"
  const [confirmWeight, setConfirmWeight] = useState("");                 // TC_CONFIRM_PAL_006: Tổng trọng lượng ước tính (kg)
  const [confirmSuccess, setConfirmSuccess] = useState(false);             // Hiện màn success sau confirm
  const [unlockReason, setUnlockReason] = useState("");
  const [showUnlock, setShowUnlock] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // UC-PAL-03: Barcode scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<{ kind: "success" | "not_found"; code: string } | null>(null);

  const { toast } = useToast();
  const { confirm } = useConfirm();

  const fetchPallet = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${basePath}/api/pallets/${palletId}`);
      const json = await res.json();
      if (json.success) setPallet(json.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [basePath, palletId]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${basePath}/api/pallets/${palletId}/history`);
      const json = await res.json();
      if (json.success) setHistory(json.data || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchPallet(); }, [fetchPallet]);
  useEffect(() => { if (activeTab === "history") fetchHistory(); }, [activeTab]);

  // UC-PAL-02: Item search debounce — nếu pallet link PHN, filter chặt theo PHN đó
  useEffect(() => {
    if (itemSearch.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const phnId = pallet?.inbound_request_id;
        const params = new URLSearchParams({ q: itemSearch });
        if (phnId) params.set("inbound_request_id", phnId);
        const res = await fetch(`${basePath}/api/item-codes?${params.toString()}`);
        const json = await res.json();
        if (json.success) setSearchResults(json.data || []);
      } catch (err) { console.error(err); }
    }, 300);
    return () => clearTimeout(t);
  }, [itemSearch, basePath, pallet?.inbound_request_id]);

  // UC-PAL-03: Quét barcode → lookup item, nếu có set selectedItem, nếu không → search manual
  const handleScanResult = async (scannedCode: string) => {
    setScannerOpen(false);
    try {
      // Thử lookup theo barcode hoặc code
      const res = await fetch(`${basePath}/api/item-codes?q=${encodeURIComponent(scannedCode)}`);
      const json = await res.json();
      const items: ItemCode[] = (json.success && Array.isArray(json.data) ? json.data : []) as ItemCode[];
      // Ưu tiên exact match (code hoặc barcode)
      const exact = items.find((i) =>
        i.code?.toLowerCase() === scannedCode.toLowerCase() ||
        (i as ItemCode & { barcode?: string }).barcode?.toLowerCase() === scannedCode.toLowerCase()
      ) || items[0];

      if (exact) {
        setSelectedItem(exact);
        setItemSearch("");
        setSearchResults([]);
        // Mặc định điền = số còn lại theo phiếu (nếu còn)
        if (exact.phn_qty_remaining != null && exact.phn_qty_remaining > 0) {
          setQty(String(exact.phn_qty_remaining));
        }
        setScanStatus({ kind: "success", code: scannedCode });
      } else {
        // Không tìm thấy → đẩy code vào search box để user tìm tay hoặc tạo mã mới
        setItemSearch(scannedCode);
        setScanStatus({ kind: "not_found", code: scannedCode });
      }
    } catch (err) {
      console.error("Lookup scan error:", err);
      setItemSearch(scannedCode);
      setScanStatus({ kind: "not_found", code: scannedCode });
    }
    setTimeout(() => setScanStatus(null), 4000);
  };

  const handleAddLine = async () => {
    if (!selectedItem || !qty) return;
    setAddingLine(true);
    try {
      const res = await fetch(`${basePath}/api/pallets/${palletId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_code_id: selectedItem.id,
          qty_box: parseInt(qty),
          lot: lot || null,
          expiry_date: expiry || null,
          note: lineNote || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSelectedItem(null); setItemSearch(""); setQty(""); setLot(""); setExpiry(""); setLineNote("");
        fetchPallet();
      }
    } catch (err) { console.error(err); }
    finally { setAddingLine(false); }
  };

  const handleDeleteLine = async (lineId: string) => {
    const ok = await confirm({
      title: "Xóa dòng hàng?",
      description: "Dòng hàng này sẽ bị xóa khỏi pallet.",
      confirmText: "Xóa",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await fetch(`${basePath}/api/pallets/${palletId}/lines/${lineId}`, { method: "DELETE" });
      toast.success("Đã xóa dòng");
      fetchPallet();
    } catch (err) { console.error(err); toast.error("Lỗi kết nối"); }
  };

  const handleConfirm = async () => {
    if (!confirmAcknowledged) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${basePath}/api/pallets/${palletId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total_weight_kg: confirmWeight.trim() !== "" ? parseFloat(confirmWeight) : null, note: "" }),
      });
      const json = await res.json();
      if (json.success) {
        setShowConfirm(false);
        setConfirmSuccess(true);  // Hiện màn success thay vì close modal luôn
        fetchPallet();
      } else {
        toast.error(json.error || "Không xác nhận được pallet.");
      }
    } catch (err) { console.error(err); toast.error("Lỗi kết nối."); }
    finally { setActionLoading(false); }
  };

  const handleUnlock = async () => {
    if (!unlockReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${basePath}/api/pallets/${palletId}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: unlockReason }),
      });
      const json = await res.json();
      if (json.success) { setShowUnlock(false); setUnlockReason(""); fetchPallet(); }
    } catch (err) { console.error(err); }
    finally { setActionLoading(false); }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      // TC_CREATE_PAL_011: pallet đang dựng (EMPTY hoặc COUNTING) = "Đang thêm hàng" cho tới khi xác nhận
      case "EMPTY": return <span className="px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold bg-gray-100 text-gray-700">Đang thêm hàng</span>;
      case "COUNTING": return <span className="px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold bg-amber-100 text-amber-700">Đang thêm hàng</span>;
      case "CONFIRMED": return <span className="px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold bg-blue-100 text-blue-700">Đã xác nhận</span>;
      case "IN_STORAGE": return <span className="px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold bg-green-100 text-green-700">Trong kho</span>;
      case "IN_STAGING": return <span className="px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold bg-purple-100 text-purple-700">Chờ xuất</span>;
      case "RELEASED": return <span className="px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold bg-gray-100 text-gray-600">Đã xuất</span>;
      case "CANCELLED": return <span className="px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold bg-rose-100 text-rose-600">Đã hủy</span>;
      default: return <span className="px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold bg-gray-100 text-gray-600">{s}</span>;
    }
  };

  if (loading || !pallet) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      {/* Header */}
      <div className="flex flex-col gap-xs">
        <BackLink href="/thukho/pallet">Danh sách pallet</BackLink>
      </div>

      {/* Pallet Header Card */}
      <div className="bg-gradient-to-br from-primary to-primary-hover text-white rounded-2xl p-lg flex flex-col gap-sm shadow-lg relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
        <div className="flex justify-between items-start z-10">
          <div>
            <span className="font-mono text-xl font-bold">{pallet.code}</span>
            <p className="text-sm text-white/80 mt-1">{pallet.supplier?.name || "Chưa có NCC"}</p>
          </div>
          {getStatusBadge(pallet.status)}
        </div>
        <div className="flex gap-md text-[11px] md:text-xs text-white/70 z-10">
          <span>{pallet.lines?.length || 0} dòng hàng</span>
          <span>{pallet.total_weight_kg ? `${pallet.total_weight_kg} kg` : "—"}</span>
          <span>{new Date(pallet.created_at).toLocaleDateString("vi-VN")}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-xs border-b border-outline-variant">
        <button onClick={() => setActiveTab("lines")} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${activeTab === "lines" ? "border-primary text-primary" : "border-transparent text-on-surface-variant"}`}>
          Hàng hóa
        </button>
        <button onClick={() => setActiveTab("history")} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${activeTab === "history" ? "border-primary text-primary" : "border-transparent text-on-surface-variant"}`}>
          Lịch sử
        </button>
      </div>

      {activeTab === "lines" ? (
        <>
          {/* Lines Table */}
          <div className="flex flex-col gap-sm">
            {pallet.lines?.length === 0 ? (
              <div className="py-8 text-center text-sm text-on-surface-variant">Chưa có hàng hóa trong pallet</div>
            ) : (
              pallet.lines?.map((line) => (
                <div key={line.id} className="industrial-card p-sm rounded-xl bg-surface shadow-sm flex justify-between items-center">
                  <div className="flex flex-col flex-1">
                    <span className="text-xs font-bold text-primary">{line.item_code?.code}</span>
                    <span className="text-[11px] md:text-xs text-on-surface-variant truncate max-w-[180px]">{line.item_code?.short_name}</span>
                    <div className="flex gap-md mt-1 text-[11px] md:text-xs text-on-surface-variant/80">
                      {/* TC_CONFIRM_PAL_026: hiện SL thùng + quy đổi sang đơn vị lẻ */}
                      <span>{Number(line.qty_box).toLocaleString("vi-VN")} thùng</span>
                      {Number(line.qty_unit) > 0 && Number(line.qty_unit) !== Number(line.qty_box) && (
                        <span className="text-primary font-semibold">
                          = {Number(line.qty_unit).toLocaleString("vi-VN")} {line.item_code?.unit?.name || line.item_code?.unit?.symbol || "đv lẻ"}
                        </span>
                      )}
                      {line.lot && <span>Lô: {line.lot}</span>}
                      {line.expiry_date && <span>HSD: {new Date(line.expiry_date).toLocaleDateString("vi-VN")}</span>}
                    </div>
                    {line.note && (
                      <div className="mt-1 text-[11px] md:text-xs text-on-surface-variant/80 italic truncate max-w-[260px]">
                        Ghi chú: {line.note}
                      </div>
                    )}
                  </div>
                  {(pallet.status === "EMPTY" || pallet.status === "COUNTING") && (
                    <button onClick={() => handleDeleteLine(line.id)} className="w-8 h-8 flex items-center justify-center text-error hover:bg-error-container/20 rounded-lg transition-all">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add Line Form — TC_CREATE_PAL_011: cho phép cả EMPTY ("Đang thêm hàng") + COUNTING */}
          {(pallet.status === "EMPTY" || pallet.status === "COUNTING") && (
            <div className="industrial-card p-md rounded-xl bg-surface-low flex flex-col gap-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">Thêm hàng vào pallet</span>
                {pallet.inbound_request ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="material-symbols-outlined text-[12px]">link</span>
                    {pallet.inbound_request.code}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="material-symbols-outlined text-[12px]">warning</span>
                    Chưa liên kết phiếu nhập
                  </span>
                )}
              </div>

              {/* UC-PAL-01 cảnh báo: pallet đang thêm hàng (EMPTY/COUNTING) mà chưa link PHN */}
              {!pallet.inbound_request_id && (pallet.status === "EMPTY" || pallet.status === "COUNTING") && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-800 flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-[14px] mt-0.5">info</span>
                  <span>Pallet này <b>chưa liên kết Phiếu nhập</b> nên hiển thị TẤT CẢ mã hàng. Để giới hạn chỉ trong phiếu nhập, tạo pallet từ "<i>Phiếu nhập → Tạo pallet</i>".</span>
                </div>
              )}

              {pallet.inbound_request_id && pallet.inbound_request && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[11px] text-emerald-800 flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-[14px] mt-0.5">check_circle</span>
                  <span>Tìm kiếm chỉ trong mã hàng thuộc <b>{pallet.inbound_request.code}</b> — tránh nhập sai.</span>
                </div>
              )}

              {!selectedItem ? (
                <>
                  <div className="flex gap-2">
                    <div className="relative flex-1 min-w-0">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">search</span>
                      <input
                        type="text"
                        placeholder="Tìm hoặc quét..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:border-primary"
                      />
                      {searchResults.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-outline-variant rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {searchResults.map((item) => {
                            const rem = item.phn_qty_remaining;
                            return (
                              <button
                                key={item.id}
                                onClick={() => {
                                  setSelectedItem(item);
                                  setItemSearch("");
                                  setSearchResults([]);
                                  // Mặc định điền = số còn lại theo phiếu (nếu còn)
                                  if (rem != null && rem > 0) setQty(String(rem));
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-surface-low text-sm border-b border-outline-variant/20 last:border-0"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="min-w-0">
                                    <span className="font-bold text-primary">{item.code}</span>
                                    <span className="text-on-surface-variant ml-2">{item.short_name}</span>
                                  </span>
                                  {rem != null && (
                                    <span className={`shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                      rem > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                                    }`}>
                                      {rem > 0 ? `còn ${rem}` : "đã đủ ✓"}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {/* UC-PAL-03: Nút quét barcode */}
                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      className="shrink-0 min-h-[44px] px-3 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold flex items-center gap-1 active:scale-[0.97] transition-all"
                      aria-label="Quét mã"
                    >
                      <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                    </button>
                  </div>
                  {/* Trạng thái scan */}
                  {scanStatus && (
                    <div className={`text-[11px] md:text-xs font-semibold px-2 py-1.5 rounded ${
                      scanStatus.kind === "success"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      {scanStatus.kind === "success"
                        ? `✓ Đã nhận diện mã: ${scanStatus.code}`
                        : `⚠ Mã ${scanStatus.code} chưa có — chuyển sang tìm tay (hoặc tạo mã tạm tại /thukho/item-code/new)`}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center p-sm bg-primary-container/20 rounded-lg">
                    <div>
                      <span className="text-xs font-bold text-primary">{selectedItem.code}</span>
                      <span className="text-[11px] md:text-xs text-on-surface-variant ml-2">{selectedItem.short_name}</span>
                    </div>
                    <button onClick={() => setSelectedItem(null)} className="text-error text-xs font-semibold">Đổi</button>
                  </div>

                  {/* fix 1 phiếu — nhiều pallet: còn lại theo phiếu (ĐK − đã lên pallet) */}
                  {selectedItem.phn_qty_remaining != null && (
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] rounded-lg bg-surface-low px-2.5 py-1.5">
                      <span className="text-on-surface-variant">Theo phiếu:</span>
                      <span className="font-semibold">ĐK {selectedItem.phn_qty_expected ?? 0}</span>
                      <span className="text-on-surface-variant/40">·</span>
                      <span className="font-semibold">đã lên {selectedItem.phn_qty_on_pallet ?? 0}</span>
                      <span className="text-on-surface-variant/40">·</span>
                      <span className={`font-bold ${(selectedItem.phn_qty_remaining ?? 0) > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                        còn {selectedItem.phn_qty_remaining}{(selectedItem.phn_qty_remaining ?? 0) <= 0 ? " ✓" : ""}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-sm">
                    <div>
                      <label className="text-[11px] md:text-xs font-bold text-on-surface-variant">SL thùng *</label>
                      <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:border-primary" />
                      {/* TC_UPDATE_PAL_001: quy đổi ra đơn vị lẻ (units_per_box) */}
                      {selectedItem.units_per_box && selectedItem.units_per_box > 1 && Number(qty) > 0 && (
                        <p className="text-[11px] text-on-surface-variant/80 mt-0.5">
                          = {Number(qty) * selectedItem.units_per_box} {selectedItem.unit?.name || "đv lẻ"}
                          <span className="text-on-surface-variant/50"> ({selectedItem.units_per_box}/thùng)</span>
                        </p>
                      )}
                      {/* Cảnh báo (không chặn) khi vượt số còn lại theo phiếu */}
                      {selectedItem.phn_qty_remaining != null && Number(qty) > (selectedItem.phn_qty_remaining ?? 0) && (
                        <p className="text-[11px] text-rose-600 font-semibold mt-0.5">
                          ⚠ Vượt còn lại theo phiếu ({selectedItem.phn_qty_remaining}) — kiểm tra lại.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] md:text-xs font-bold text-on-surface-variant">Số lô</label>
                      <input type="text" value={lot} onChange={(e) => setLot(e.target.value)} placeholder="VD: L2026A" className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-[11px] md:text-xs font-bold text-on-surface-variant">HSD</label>
                      <DateField value={expiry} onChange={(val) => setExpiry(val)} className="border-outline-variant" />
                    </div>
                    <div>
                      <label className="text-[11px] md:text-xs font-bold text-on-surface-variant">Ghi chú</label>
                      <input type="text" value={lineNote} onChange={(e) => setLineNote(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:border-primary" />
                    </div>
                  </div>

                  {/* TC_UPDATE_PAL_005: Lô + HSD là trường bắt buộc — disable nút "Thêm vào pallet"
                      khi thiếu SL/Lô/HSD. (ItemCode chưa có cờ manage_lot/manage_expiry nên
                      áp dụng bắt buộc cho mọi mã hàng theo yêu cầu nghiệp vụ FMCG.) */}
                  {(() => {
                    const missingQty = !qty || Number(qty) <= 0;
                    const missingLot = !lot.trim();
                    const missingExpiry = !expiry;
                    const disabled = addingLine || missingQty || missingLot || missingExpiry;
                    const reasons: string[] = [];
                    if (missingQty) reasons.push("SL > 0");
                    if (missingLot) reasons.push("Lô");
                    if (missingExpiry) reasons.push("HSD");
                    return (
                      <>
                        {reasons.length > 0 && (
                          <p className="text-[11px] text-amber-700 -mt-1">
                            Còn thiếu: {reasons.join(", ")}
                          </p>
                        )}
                        <button
                          onClick={handleAddLine}
                          disabled={disabled}
                          className="w-full py-2.5 bg-secondary text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 hover:bg-on-secondary-container active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">{addingLine ? "progress_activity" : "add"}</span>
                          {addingLine ? "Đang thêm..." : "Thêm vào pallet"}
                        </button>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-sm mt-2">
            {pallet.status === "COUNTING" && pallet.lines?.length > 0 && (
              <button onClick={() => setShowConfirm(true)} className="w-full py-3 bg-primary text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-[0.98] transition-all">
                <span className="material-symbols-outlined text-lg">check_circle</span> Xác nhận pallet
              </button>
            )}
            {pallet.status === "CONFIRMED" && (
              <button onClick={() => setShowUnlock(true)} className="w-full py-3 border-2 border-amber-500 text-amber-600 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-amber-50 active:scale-[0.98] transition-all">
                <span className="material-symbols-outlined text-lg">lock_open</span> Yêu cầu sửa
              </button>
            )}
          </div>

          {/* UC-PAL-04: Confirm Dialog — TỔNG KẾT + cảnh báo + checkbox */}
          {showConfirm && pallet && typeof document !== "undefined" && createPortal(
            (() => {
              const totalLines = pallet.lines.length;
              const uniqueItems = new Set(pallet.lines.map((l) => l.item_code.id)).size;
              const totalBox = pallet.lines.reduce((s, l) => s + Number(l.qty_box || 0), 0);
              const totalUnit = pallet.lines.reduce((s, l) => s + Number(l.qty_unit || 0), 0);
              const expiryDates = pallet.lines
                .map((l) => l.expiry_date)
                .filter((d): d is string => !!d)
                .map((d) => new Date(d).getTime())
                .sort((a, b) => a - b);
              const nearestExpiry = expiryDates.length > 0 ? new Date(expiryDates[0]).toLocaleDateString("vi-VN") : "—";

              return (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 pb-4 sm:pb-4 overflow-y-auto">
                  <div className="bg-white rounded-2xl w-full max-w-md flex flex-col shadow-2xl my-auto">
                    {/* Header xanh */}
                    <div className="bg-primary text-white px-5 py-4 rounded-t-2xl flex items-center gap-2">
                      <button onClick={() => setShowConfirm(false)} className="hover:bg-white/10 rounded-lg p-1 -ml-1">
                        <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                      </button>
                      <h3 className="text-base font-bold flex-1">Xác nhận pallet</h3>
                    </div>

                    <div className="p-5 flex flex-col gap-4">
                      {/* Pallet code + PHN */}
                      <div className="bg-surface-low rounded-xl p-3">
                        <div className="font-mono font-bold text-base text-primary">{pallet.code}</div>
                        {pallet.inbound_request && (
                          <div className="text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">link</span>
                            {pallet.inbound_request.code}
                          </div>
                        )}
                      </div>

                      {/* TỔNG KẾT */}
                      <div>
                        <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Tổng kết</div>
                        <div className="border border-outline-variant rounded-xl divide-y divide-outline-variant/50">
                          <div className="flex justify-between px-3 py-2.5 text-sm">
                            <span className="text-on-surface-variant">Tổng dòng hàng:</span>
                            <span className="font-mono font-bold">{totalLines}</span>
                          </div>
                          <div className="flex justify-between px-3 py-2.5 text-sm">
                            <span className="text-on-surface-variant">Tổng mã hàng:</span>
                            <span className="font-mono font-bold">{uniqueItems}</span>
                          </div>
                          {/* TC_CONFIRM_PAL_026: tách rõ Tổng thùng vs quy đổi đơn vị lẻ
                              (trước đây hiện số THÙNG nhưng gắn nhãn "đv" gây hiểu nhầm) */}
                          <div className="flex justify-between px-3 py-2.5 text-sm">
                            <span className="text-on-surface-variant">Tổng SL:</span>
                            <span className="font-mono font-bold">{totalBox.toLocaleString("vi-VN")} thùng</span>
                          </div>
                          {totalUnit !== totalBox && (
                            <div className="flex justify-between px-3 py-2.5 text-sm">
                              <span className="text-on-surface-variant">Quy đổi lẻ:</span>
                              <span className="font-mono font-bold text-primary">{totalUnit.toLocaleString("vi-VN")} đv lẻ</span>
                            </div>
                          )}
                          <div className="flex justify-between px-3 py-2.5 text-sm">
                            <span className="text-on-surface-variant">Date gần nhất:</span>
                            <span className="font-mono font-bold text-rose-600">{nearestExpiry}</span>
                          </div>
                        </div>
                      </div>

                      {/* Cảnh báo vàng */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <div className="flex items-center gap-1 text-amber-800 font-semibold text-xs mb-1.5">
                          <span className="material-symbols-outlined text-[16px]">warning</span>
                          Sau khi xác nhận:
                        </div>
                        <ul className="text-xs text-amber-800 space-y-1 ml-1 list-disc list-inside marker:text-amber-600">
                          <li>Pallet sẽ chuyển trạng thái <b>&quot;Đã xác nhận - Chờ xe nâng&quot;</b></li>
                          <li>Mã hàng, SL, Lô, Date sẽ bị <b>KHÓA</b> với Xe nâng</li>
                          <li>Chỉ có thể sửa qua quyền đặc biệt (UC-PAL-05)</li>
                        </ul>
                      </div>

                      {/* TC_CONFIRM_PAL_006: Tổng trọng lượng ước tính — tùy nhập; bỏ trống = dùng tổng tự tính */}
                      <div>
                        <label className="block text-xs font-medium text-on-surface-variant mb-1">Tổng trọng lượng ước tính (kg)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={confirmWeight}
                          onChange={(e) => setConfirmWeight(e.target.value)}
                          placeholder={pallet.total_weight_kg ? `Tự tính: ${pallet.total_weight_kg} kg` : "Nhập kg (tùy chọn)"}
                          className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      {/* Checkbox xác nhận */}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={confirmAcknowledged}
                          onChange={(e) => setConfirmAcknowledged(e.target.checked)}
                          className="w-4 h-4 accent-primary"
                        />
                        <span className="text-sm text-on-surface">Tôi xác nhận đã kiểm đếm chính xác</span>
                      </label>

                      {/* Buttons */}
                      <button
                        onClick={handleConfirm}
                        disabled={actionLoading || !confirmAcknowledged}
                        className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px]">check</span>
                        {actionLoading ? "Đang xử lý..." : "Xác nhận pallet"}
                      </button>
                      <button
                        onClick={() => { setShowConfirm(false); setConfirmAcknowledged(false); }}
                        disabled={actionLoading}
                        className="w-full py-3 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-low disabled:opacity-50"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                </div>
              );
            })(),
            document.body
          )}

          {/* UC-PAL-04: Success screen sau khi xác nhận */}
          {confirmSuccess && pallet && typeof document !== "undefined" && createPortal(
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 pb-4 sm:pb-4">
              <div className="bg-white rounded-2xl w-full max-w-md flex flex-col shadow-2xl">
                {/* Header xanh lá */}
                <div className="bg-emerald-600 text-white px-5 py-4 rounded-t-2xl text-center">
                  <h3 className="text-base font-bold flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    Đã xác nhận
                  </h3>
                </div>

                <div className="p-6 flex flex-col gap-4 items-center">
                  {/* Big check icon */}
                  <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-600 text-[48px]">check</span>
                  </div>

                  <div className="text-center">
                    <div className="text-base font-bold text-on-surface">Pallet đã xác nhận</div>
                    <div className="font-mono text-sm text-on-surface-variant mt-1">{pallet.code}</div>
                  </div>

                  {/* Trạng thái mới */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 w-full">
                    <div className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">location_on</span>
                      Trạng thái mới: <b>Chờ Xe nâng đưa vào vị trí</b>
                    </div>
                    <div className="text-[11px] text-blue-600 mt-1">Đã đẩy thông báo cho Xe nâng.</div>
                  </div>

                  {/* Buttons */}
                  <Link
                    href={mobileHref("/thukho/pallet/new")}
                    onClick={() => setConfirmSuccess(false)}
                    className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary-hover transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                    Tạo pallet mới
                  </Link>
                  <Link
                    href={mobileHref("/thukho/pallet")}
                    onClick={() => setConfirmSuccess(false)}
                    className="w-full py-3 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-low text-center"
                  >
                    ← Về danh sách
                  </Link>
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Unlock Dialog — Phase 3.4: row 148, hiện counter ký tự + disable khi < 5 ký tự (RC-2) */}
          {showUnlock && typeof document !== "undefined" && createPortal(
            (() => {
              const trimmedLen = unlockReason.trim().length;
              const minLen = 5;
              const isValid = trimmedLen >= minLen;
              return (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 pb-4 sm:pb-4">
                  <div className="bg-white rounded-2xl p-lg w-full max-w-md flex flex-col gap-md shadow-2xl">
                    <h3 className="text-lg font-bold text-amber-600">Yêu cầu sửa pallet</h3>
                    <div>
                      <label className="text-[11px] md:text-xs font-bold text-on-surface-variant">Lý do <span className="text-error">*</span></label>
                      <textarea
                        value={unlockReason}
                        onChange={(e) => setUnlockReason(e.target.value)}
                        rows={3}
                        placeholder="Nhập lý do cần chỉnh sửa..."
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm resize-none ${
                          trimmedLen > 0 && !isValid
                            ? "border-amber-400 focus:outline-amber-500"
                            : "border-outline-variant"
                        }`}
                      />
                      <div className={`text-[11px] mt-1 flex justify-between ${
                        isValid ? "text-emerald-700" : "text-amber-700"
                      }`}>
                        <span>
                          {isValid
                            ? "✓ Lý do hợp lệ"
                            : `Còn thiếu ${Math.max(0, minLen - trimmedLen)} ký tự (tối thiểu ${minLen})`}
                        </span>
                        <span className="font-mono">{trimmedLen}/{minLen}</span>
                      </div>
                    </div>
                    <div className="flex gap-sm">
                      <button onClick={() => setShowUnlock(false)} className="flex-1 py-2.5 border border-outline-variant rounded-lg text-sm font-semibold">Hủy</button>
                      <button
                        onClick={handleUnlock}
                        disabled={actionLoading || !isValid}
                        className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                      >
                        {actionLoading ? "Đang xử lý..." : "Mở khóa"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })(),
            document.body
          )}
        </>
      ) : (
        /* History Tab */
        <div className="flex flex-col gap-0 bg-surface rounded-xl p-md border border-outline-variant/30 shadow-sm">
          {history.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-8">Chưa có lịch sử</p>
          ) : (
            history.map((item, idx) => {
              const label = PAL_ACTION_LABEL[item.action] || item.label || item.action;
              const roleLabel = item.performed_by_role
                ? PAL_ROLE_LABEL[item.performed_by_role] || item.performed_by_role
                : null;
              const hasLocation = item.from_location || item.to_location;
              return (
                <div key={item.id} className="flex gap-md">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    {idx < history.length - 1 && <div className="w-[1px] h-full bg-outline-variant/50 min-h-[30px]"></div>}
                  </div>
                  <div className="flex flex-col pb-sm flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-primary font-semibold">{label}</span>
                      {item.kind === "movement" && (
                        <span className="text-[11px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-indigo-100 text-indigo-700">
                          Vị trí
                        </span>
                      )}
                    </div>
                    {hasLocation && (
                      <span className="text-[11px] md:text-xs text-on-surface-variant mt-0.5 flex items-center gap-1 flex-wrap">
                        {item.from_location && (
                          <span className="font-mono">{item.from_location.code}</span>
                        )}
                        {item.from_location && item.to_location && (
                          <span className="text-on-surface-variant/60">→</span>
                        )}
                        {item.to_location && (
                          <span className="font-mono text-emerald-700 font-semibold">{item.to_location.code}</span>
                        )}
                      </span>
                    )}
                    {/* Chuyển trạng thái — TC_HISTORY_PAL_013/_015/_018/_020 */}
                    {item.kind !== "movement" && item.detail && (
                      <span className="text-[11px] md:text-xs font-semibold text-on-surface-variant mt-0.5 flex items-center gap-1 flex-wrap">
                        <span className="material-symbols-outlined text-[13px] text-on-surface-variant/60">sync_alt</span>
                        {item.detail}
                      </span>
                    )}
                    {item.reason && <span className="text-[11px] md:text-xs text-on-surface-variant mt-0.5">{item.reason}</span>}
                    <span className="text-[11px] md:text-xs text-on-surface-variant/60 mt-0.5 flex items-center gap-1 flex-wrap">
                      <span>{new Date(item.performed_at).toLocaleString("vi-VN")}</span>
                      {item.performed_by_name && (
                        <>
                          <span className="text-on-surface-variant/40">·</span>
                          <span className="font-semibold text-on-surface-variant">
                            {item.performed_by_name}
                            {roleLabel && (
                              <span className="ml-1 text-[11px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-surface-low">
                                {roleLabel}
                              </span>
                            )}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* UC-PAL-03: Barcode scanner modal */}
      {typeof document !== "undefined" && createPortal(
        <BarcodeScannerModal
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={handleScanResult}
          title="Quét mã hàng"
          allowManualInput
          allowFromGallery
        />,
        document.body
      )}
    </div>
  );
}
