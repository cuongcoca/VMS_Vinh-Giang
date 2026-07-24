"use client";

import React, { useState, useEffect, use } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import Link from "next/link";
import { useToast, useConfirm } from "@/components/ui";

type ItemCodeOption = {
  id: string; code: string; short_name: string; full_name: string | null;
  specification: string | null;
  units_per_box?: number | null;
  weight_per_box: string | null;
  unit?: { id: string; name: string; symbol?: string | null } | null;
};

type PalletLineData = {
  id: string; qty_box: string; qty_unit: string; lot: string | null;
  expiry_date: string | null; manufactured_date: string | null;
  weight_kg: string; note: string | null; created_at: string;
  item_code: ItemCodeOption;
  inbound_request_id: string | null;
  inbound_request?: { id: string; code: string; invoice_no: string | null } | null;
};

type PalletDetail = {
  id: string; code: string; status: string; note: string | null;
  supplier: { id: string; code: string; name: string } | null;
  location: { id: string; code: string; zone: string | null; rack: string | null; level: string | null; status: string } | null;
  inbound_date: string | null; total_lines: number; total_weight_kg: string;
  confirmed_at: string | null;
  lines: PalletLineData[];
};

type HistoryEvent = {
  id: string;
  kind?: "audit" | "movement" | "created";
  action: string;
  label?: string;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  detail?: string | null;
  status_from?: string | null;
  status_to?: string | null;
  performed_by: string | null;
  performed_by_name?: string | null;
  performed_by_role?: string | null;
  ip_address?: string | null;
  performed_at: string;
  from_location?: { code: string; zone: string } | null;
  to_location?: { code: string; zone: string } | null;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  EMPTY: { label: "Đang thêm hàng", color: "bg-surface-low text-on-surface" },
  COUNTING: { label: "Đang thêm hàng", color: "bg-blue-50 text-blue-700" },
  CONFIRMED: { label: "Đã xác nhận", color: "bg-emerald-50 text-emerald-700" },
  IN_STORAGE: { label: "Trong kho", color: "bg-indigo-50 text-indigo-700" },
  IN_STAGING: { label: "Chờ xuất", color: "bg-amber-50 text-amber-700" },
  RELEASED: { label: "Đã xuất", color: "bg-purple-50 text-purple-700" },
  CANCELLED: { label: "Đã hủy", color: "bg-rose-50 text-rose-600" },
};

// Phase 3.5 — match action names mới từ /api/pallets/[id]/history (refactor
// Phase 2 + 3.4) — vẫn giữ alias cũ để không vỡ với phiếu audit cũ.
const ACTION_MAP: Record<string, { icon: string; label: string; color: string }> = {
  // New names
  CREATE_PALLET: { icon: "add_circle", label: "Tạo pallet", color: "text-blue-600 bg-blue-50" },
  ADD_PALLET_LINE: { icon: "add_box", label: "Thêm dòng hàng", color: "text-indigo-600 bg-indigo-50" },
  DELETE_PALLET_LINE: { icon: "delete", label: "Xóa dòng hàng", color: "text-rose-600 bg-rose-50" },
  CONFIRM_PALLET: { icon: "check_circle", label: "Xác nhận pallet", color: "text-emerald-600 bg-emerald-50" },
  UNLOCK_PALLET: { icon: "lock_open", label: "Mở khóa pallet", color: "text-amber-600 bg-amber-50" },
  CANCEL_PALLET: { icon: "cancel", label: "Hủy pallet", color: "text-rose-600 bg-rose-50" },
  // Movement
  PUT_AWAY: { icon: "where_to_vote", label: "Đưa vào vị trí", color: "text-emerald-600 bg-emerald-50" },
  RELOCATE: { icon: "swap_horiz", label: "Chuyển vị trí", color: "text-indigo-600 bg-indigo-50" },
  STAGE_OUT: { icon: "outbox", label: "Sang khu chờ xuất", color: "text-amber-600 bg-amber-50" },
  RETURN: { icon: "undo", label: "Hoàn trả vị trí", color: "text-rose-600 bg-rose-50" },
  // Backward-compat (audit log cũ trước Phase 2 refactor)
  CREATE: { icon: "add_circle", label: "Tạo pallet", color: "text-blue-600 bg-blue-50" },
  CONFIRM: { icon: "check_circle", label: "Xác nhận pallet", color: "text-emerald-600 bg-emerald-50" },
  UNLOCK: { icon: "lock_open", label: "Mở lại pallet", color: "text-amber-600 bg-amber-50" },
  ADD_LINE: { icon: "add_box", label: "Thêm hàng", color: "text-indigo-600 bg-indigo-50" },
  DELETE_LINE: { icon: "delete", label: "Xóa hàng", color: "text-rose-600 bg-rose-50" },
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Quản trị",
  MANAGER: "Quản lý",
  QUAN_LY: "Quản lý",
  KE_TOAN: "Kế toán",
  THU_KHO: "Thủ kho",
  XE_NANG: "Xe nâng",
  KIEM_KE: "Kiểm kê",
  STAFF: "Nhân viên",
};

const EMPTY_LINE = { item_code_id: "", qty_box: "", lot: "", expiry_date: "", manufactured_date: "", note: "" };

export default function PalletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [pallet, setPallet] = useState<PalletDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemSearch, setItemSearch] = useState("");
  const [itemOptions, setItemOptions] = useState<ItemCodeOption[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemCodeOption | null>(null);
  const [form, setForm] = useState(EMPTY_LINE);
  const [saving, setSaving] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // PAL-05: Unlock state
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [unlockReasonCode, setUnlockReasonCode] = useState("SAI_SL");
  const [unlockApprover, setUnlockApprover] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  // PAL-06: History tab
  const [activeTab, setActiveTab] = useState<"lines" | "history">("lines");
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // PAL-03: Barcode scanner
  const [showScanner, setShowScanner] = useState(false);

  const { toast } = useToast();
  const { confirm } = useConfirm();

  // Fetch pallet detail + lines
  const fetchPallet = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/wms/api/pallets/${id}/lines`);
      const result = await res.json();
      if (result.success) setPallet(result.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // PAL-06: Fetch history
  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch(`/wms/api/pallets/${id}/history`);
      const result = await res.json();
      if (result.success) setHistory(result.data);
    } catch (err) { console.error(err); }
    finally { setHistoryLoading(false); }
  };

  // Tìm kiếm mã hàng
  const searchItems = async (q: string) => {
    if (q.length < 1) { setItemOptions([]); return; }
    try {
      const res = await fetch(`/wms/api/item-codes?q=${encodeURIComponent(q)}`);
      const result = await res.json();
      if (result.success) setItemOptions(result.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchPallet(); }, [id]);
  useEffect(() => {
    const t = setTimeout(() => searchItems(itemSearch), 300);
    return () => clearTimeout(t);
  }, [itemSearch]);
  useEffect(() => {
    if (activeTab === "history" && history.length === 0) fetchHistory();
  }, [activeTab]);

  // Chọn mã hàng
  const handleSelectItem = (item: ItemCodeOption) => {
    setSelectedItem(item);
    setForm({ ...form, item_code_id: item.id });
    setItemSearch("");
    setShowSearch(false);
    setItemOptions([]);
  };

  // Thêm dòng hàng
  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item_code_id) { toast.warning("Vui lòng chọn mã hàng."); return; }
    if (!form.qty_box || Number(form.qty_box) <= 0) { toast.warning("Số lượng thùng phải > 0."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/wms/api/pallets/${id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_code_id: form.item_code_id,
          qty_box: Number(form.qty_box),
          lot: form.lot || null,
          expiry_date: form.expiry_date || null,
          manufactured_date: form.manufactured_date || null,
          note: form.note || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setForm(EMPTY_LINE);
        setSelectedItem(null);
        toast.success("Đã thêm dòng hàng");
        fetchPallet();
      } else {
        toast.error(result.error || "Lỗi khi thêm.");
      }
    } catch (err) { console.error(err); toast.error("Lỗi kết nối."); }
    finally { setSaving(false); }
  };

  // L1 fix — Sửa dòng hàng inline (qty_box / lot / expiry_date / note)
  // patchingLineId: id của line đang được PATCH (để hiện spinner)
  const [patchingLineId, setPatchingLineId] = useState<string | null>(null);
  // editDraft: giữ giá trị đang gõ (string để không mất focus do parse số)
  const [editDraft, setEditDraft] = useState<{ lineId: string; field: string; value: string } | null>(null);

  const handlePatchLine = async (
    lineId: string,
    patch: Partial<{ qty_box: number; lot: string | null; expiry_date: string | null; note: string | null }>,
    fieldLabel: string
  ) => {
    setPatchingLineId(lineId);
    try {
      const res = await fetch(`/wms/api/pallets/${id}/lines/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Đã cập nhật ${fieldLabel}`);
        fetchPallet();
      } else {
        toast.error(result.error || `Lỗi cập nhật ${fieldLabel}`);
        fetchPallet(); // revert UI về giá trị thật
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối.");
      fetchPallet();
    } finally {
      setPatchingLineId(null);
      setEditDraft(null);
    }
  };

  // Xóa dòng hàng
  const handleDeleteLine = async (lineId: string) => {
    const ok = await confirm({
      title: "Xóa dòng hàng?",
      description: "Dòng hàng này sẽ bị xóa khỏi pallet.",
      confirmText: "Xóa",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/wms/api/pallets/${id}/lines/${lineId}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) { toast.success("Đã xóa dòng"); fetchPallet(); }
      else toast.error(result.error || "Xóa thất bại");
    } catch (err) { console.error(err); toast.error("Lỗi kết nối"); }
  };

  // Xác nhận pallet (PAL-04)
  const handleConfirm = async () => {
    if (!pallet) return;
    const ok = await confirm({
      title: `Xác nhận pallet "${pallet.code}"?`,
      description: `Sau khi xác nhận, pallet sẽ chuyển cho xe nâng xếp vị trí. ${pallet.total_lines} dòng hàng · ${Number(pallet.total_weight_kg).toFixed(1)} kg`,
      confirmText: "Xác nhận",
    });
    if (!ok) return;
    setConfirming(true);
    try {
      const res = await fetch(`/wms/api/pallets/${id}/confirm`, { method: "POST" });
      const result = await res.json();
      if (result.success) { toast.success("Đã xác nhận pallet"); fetchPallet(); }
      else { toast.error(result.error || "Lỗi khi xác nhận."); }
    } catch (err) { console.error(err); toast.error("Lỗi kết nối."); }
    finally { setConfirming(false); }
  };

  // PAL-05: Unlock pallet (UC-PAL-05)
  const handleUnlock = async () => {
    if (unlockReason.trim().length < 5) { toast.warning("Lý do phải có ít nhất 5 ký tự."); return; }
    setUnlocking(true);
    try {
      const reasonLabels: Record<string, string> = {
        SAI_SL: "Sai SL đếm", SAI_LO: "Sai lô", SAI_MA: "Sai mã hàng",
        SAI_HSD: "Sai HSD", KHAC: "Khác",
      };
      const fullReason = `[${reasonLabels[unlockReasonCode] || unlockReasonCode}] ${unlockReason.trim()}${unlockApprover.trim() ? ` · Duyệt: ${unlockApprover.trim()}` : ""}`;
      const res = await fetch(`/wms/api/pallets/${id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: fullReason, reason_code: unlockReasonCode, approver: unlockApprover.trim() || null }),
      });
      const result = await res.json();
      if (result.success) {
        setShowUnlockModal(false);
        setUnlockReason("");
        setUnlockApprover("");
        setUnlockReasonCode("SAI_SL");
        toast.success("Đã mở khóa pallet");
        fetchPallet();
        setHistory([]);
      } else { toast.error(result.error || "Lỗi."); }
    } catch (err) { console.error(err); toast.error("Lỗi kết nối."); }
    finally { setUnlocking(false); }
  };

  // PAL-03: Barcode scan handler
  const handleBarcodeScan = async (code: string) => {
    setShowScanner(false);
    try {
      const res = await fetch(`/wms/api/item-codes?q=${encodeURIComponent(code.trim())}`);
      const result = await res.json();
      if (result.success && result.data.length > 0) {
        handleSelectItem(result.data[0]);
      } else {
        toast.warning(`Mã "${code}" không tìm thấy. Vui lòng tìm thủ công.`);
        setItemSearch(code.trim());
        setShowSearch(true);
      }
    } catch (err) { console.error(err); }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("vi-VN") : "—";
  const formatDateTime = (d: string) => new Date(d).toLocaleString("vi-VN");
  const canEdit = pallet && (pallet.status === "EMPTY" || pallet.status === "COUNTING");
  const canConfirm = pallet && pallet.status === "COUNTING" && pallet.lines.length > 0;
  const canUnlock = pallet && pallet.status === "CONFIRMED";

  if (loading) {
    return (
      <AppLayout title="CHI TIẾT PALLET">
        <div className="flex items-center justify-center h-[60vh]">
          <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
        </div>
      </AppLayout>
    );
  }

  if (!pallet) {
    return (
      <AppLayout title="PALLET">
        <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
          <span className="material-symbols-outlined text-[48px] text-rose-300">error</span>
          <p>Không tìm thấy pallet.</p>
          <Link href="/pallets" className="text-primary hover:underline text-sm">← Quay lại</Link>
        </div>
      </AppLayout>
    );
  }

  const st = STATUS_MAP[pallet.status] || { label: pallet.status, color: "bg-surface-low text-on-surface-variant" };

  return (
    <AppLayout title={`PALLET ${pallet.code}`}>
      <div className="p-6 space-y-5 min-w-0 overflow-hidden">
        {/* Breadcrumb + Header */}
        <div>
          <div className="mb-2"><BackButton fallback="/pallets">Quay lại danh sách</BackButton></div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold font-mono text-primary">{pallet.code}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${st.color}`}>{st.label}</span>
                {pallet.location ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <span className="material-symbols-outlined text-[14px]">place</span>
                    {pallet.location.code}
                  </span>
                ) : (
                  // Option B: IN_STAGING (chờ xuất) là trạng thái logic, không cần vị trí vật lý → không cảnh báo "Chưa xếp vị trí".
                  pallet.status !== "OPEN" && pallet.status !== "CANCELLED" && pallet.status !== "IN_STAGING" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-low text-on-surface-variant border border-outline-variant">
                      <span className="material-symbols-outlined text-[14px]">location_off</span>
                      Chưa xếp vị trí
                    </span>
                  )
                )}
                {pallet.supplier && <span className="text-sm text-on-surface-variant">NCC: <strong>{pallet.supplier.name}</strong></span>}
                {pallet.inbound_date && <span className="text-sm text-on-surface-variant">Ngày nhập: {formatDate(pallet.inbound_date)}</span>}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-center px-4 py-2 bg-white rounded-xl border border-outline-variant">
                <span className="text-xs text-on-surface-variant block">Dòng hàng</span>
                <span className="text-xl font-bold text-primary">{pallet.total_lines}</span>
              </div>
              <div className="text-center px-4 py-2 bg-white rounded-xl border border-outline-variant">
                <span className="text-xs text-on-surface-variant block">Trọng lượng</span>
                <span className="text-xl font-bold text-indigo-600">{Number(pallet.total_weight_kg).toFixed(1)} kg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Banner CONFIRMED + Unlock button (PAL-05) */}
        {pallet.status === "CONFIRMED" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[28px] text-emerald-600">check_circle</span>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Pallet đã xác nhận — Chờ xe nâng xếp vị trí</p>
                {pallet.confirmed_at && <p className="text-xs text-emerald-600 mt-0.5">Xác nhận lúc: {formatDateTime(pallet.confirmed_at)}</p>}
              </div>
            </div>
            <button onClick={() => setShowUnlockModal(true)}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 flex items-center gap-2 shadow-sm transition-colors">
              <span className="material-symbols-outlined text-[18px]">lock_open</span>
              Yêu cầu sửa
            </button>
          </div>
        )}

        {/* Nút Xác nhận pallet (PAL-04) */}
        {canConfirm && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[28px] text-blue-600">fact_check</span>
              <div>
                <p className="text-sm font-semibold text-blue-800">Pallet sẵn sàng xác nhận</p>
                <p className="text-xs text-blue-600 mt-0.5">{pallet.total_lines} dòng hàng · {Number(pallet.total_weight_kg).toFixed(1)} kg</p>
              </div>
            </div>
            <button onClick={handleConfirm} disabled={confirming}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 shadow-sm transition-colors">
              <span className="material-symbols-outlined text-[18px]">{confirming ? "progress_activity" : "check_circle"}</span>
              Xác nhận pallet
            </button>
          </div>
        )}

        {/* Form thêm dòng hàng */}
        {canEdit && (
          <div className="bg-white rounded-xl border border-outline-variant p-5 shadow-sm">
            <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">add_circle</span>
              Thêm dòng hàng
            </h2>
            <form onSubmit={handleAddLine} className="space-y-4">
              {/* Tìm mã hàng + nút Quét (PAL-03) */}
              <div className="relative">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Mã hàng / Quét barcode <span className="text-rose-500">*</span>
                </label>
                {selectedItem ? (
                  <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div>
                      <span className="font-mono font-bold text-primary">{selectedItem.code}</span>
                      <span className="text-sm text-on-surface-variant ml-2">{selectedItem.short_name}</span>
                      {selectedItem.specification && <span className="text-xs text-on-surface-variant/70 ml-2">({selectedItem.specification})</span>}
                    </div>
                    <button type="button" onClick={() => { setSelectedItem(null); setForm({ ...form, item_code_id: "" }); }}
                      className="p-1 hover:bg-primary/10 rounded">
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant/70">close</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">qr_code_scanner</span>
                      <input
                        type="text"
                        placeholder="Nhập mã hàng, tên, hoặc quét barcode..."
                        value={itemSearch}
                        onChange={(e) => { setItemSearch(e.target.value); setShowSearch(true); }}
                        onFocus={() => setShowSearch(true)}
                        className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      {showSearch && itemOptions.length > 0 && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-outline-variant rounded-xl shadow-lg max-h-[240px] overflow-y-auto">
                          {itemOptions.map((item) => (
                            <button
                              key={item.id} type="button"
                              onClick={() => handleSelectItem(item)}
                              className="w-full text-left px-4 py-3 hover:bg-surface-low transition-colors border-b border-outline-variant/30 last:border-b-0"
                            >
                              <span className="font-mono font-bold text-primary text-sm">{item.code}</span>
                              <span className="text-sm text-on-surface ml-2">{item.short_name}</span>
                              {item.specification && <span className="text-xs text-on-surface-variant/70 ml-2">({item.specification})</span>}
                              {item.weight_per_box && <span className="text-xs text-blue-500 ml-2">{item.weight_per_box}kg/thùng</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      {showSearch && itemSearch.length >= 1 && itemOptions.length === 0 && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-outline-variant rounded-xl shadow-lg p-4 text-center text-sm text-on-surface-variant/70">
                          Không tìm thấy mã hàng.
                        </div>
                      )}
                    </div>
                    {/* PAL-03: Nút Quét mã */}
                    <button type="button" onClick={() => setShowScanner(true)}
                      className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2 transition-colors whitespace-nowrap">
                      <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                      Quét mã
                    </button>
                  </div>
                )}
              </div>

              {/* Số lượng + Lô + HSD */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                    Số lượng (thùng) <span className="text-rose-500">*</span>
                  </label>
                  <input type="number" step="0.01" min="0.01" value={form.qty_box}
                    onChange={(e) => setForm({ ...form, qty_box: e.target.value })}
                    placeholder="VD: 10" required
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {/* L2 fix: live preview SL lẻ */}
                  {selectedItem && form.qty_box && Number(form.qty_box) > 0 && (() => {
                    const upb = selectedItem.units_per_box || 1;
                    const total = Number(form.qty_box) * upb;
                    const unitLabel = selectedItem.unit?.symbol || selectedItem.unit?.name || "lẻ";
                    return (
                      <p className="text-[11px] text-emerald-700 mt-1 font-mono">
                        = {total.toLocaleString("vi-VN")} {unitLabel} ({upb} {unitLabel}/thùng)
                      </p>
                    );
                  })()}
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Lô (Lot)</label>
                  <input type="text" value={form.lot}
                    onChange={(e) => setForm({ ...form, lot: e.target.value })}
                    placeholder="VD: LOT2026A"
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Hạn sử dụng</label>
                  <input type="date" value={form.expiry_date}
                    onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Ghi chú</label>
                  <input type="text" value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Ghi chú..."
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <button type="submit" disabled={saving || !form.item_code_id}
                className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-container flex items-center gap-2 disabled:opacity-50">
                <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "add"}</span>
                Thêm vào pallet
              </button>
            </form>
          </div>
        )}

        {/* PAL-06: Tabs Hàng hóa / Lịch sử */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="flex border-b border-outline-variant">
            <button onClick={() => setActiveTab("lines")}
              className={`flex-1 px-5 py-3 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors
                ${activeTab === "lines" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-low"}`}>
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
              Hàng hóa ({pallet.lines.length})
            </button>
            <button onClick={() => setActiveTab("history")}
              className={`flex-1 px-5 py-3 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors
                ${activeTab === "history" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-low"}`}>
              <span className="material-symbols-outlined text-[18px]">history</span>
              Lịch sử
            </button>
          </div>

          {/* Tab: Danh sách hàng */}
          {activeTab === "lines" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 700 }}>
                <thead>
                  <tr className="bg-surface-low/50 border-b border-outline-variant">
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">#</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Mã hàng</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tên</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Phiếu</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">SL Thùng</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">SL Lẻ</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Lô</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">HSD</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden lg:table-cell">KG</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant"></th>
                  </tr>
                </thead>
                <tbody>
                  {pallet.lines.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-10 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[36px] opacity-30">inventory_2</span>
                      <p className="mt-2 text-sm">Pallet trống — chưa có dòng hàng nào.</p>
                    </td></tr>
                  ) : (
                    pallet.lines.map((line, idx) => {
                      const isPatching = patchingLineId === line.id;
                      const draftQty = editDraft?.lineId === line.id && editDraft.field === "qty_box" ? editDraft.value : String(Number(line.qty_box));
                      const draftLot = editDraft?.lineId === line.id && editDraft.field === "lot" ? editDraft.value : (line.lot || "");
                      const draftExpiry = editDraft?.lineId === line.id && editDraft.field === "expiry_date" ? editDraft.value : (line.expiry_date ? line.expiry_date.slice(0, 10) : "");

                      const commitQty = () => {
                        const n = Number(draftQty);
                        if (Number.isNaN(n) || n <= 0) {
                          toast.warning("SL thùng phải > 0.");
                          setEditDraft(null);
                          return;
                        }
                        if (n === Number(line.qty_box)) { setEditDraft(null); return; }
                        handlePatchLine(line.id, { qty_box: n }, "SL thùng");
                      };
                      const commitLot = () => {
                        const v = draftLot.trim() || null;
                        if (v === (line.lot || null)) { setEditDraft(null); return; }
                        handlePatchLine(line.id, { lot: v }, "Lô");
                      };
                      const commitExpiry = () => {
                        const v = draftExpiry || null;
                        const cur = line.expiry_date ? line.expiry_date.slice(0, 10) : null;
                        if (v === cur) { setEditDraft(null); return; }
                        handlePatchLine(line.id, { expiry_date: v }, "HSD");
                      };

                      return (
                      <tr key={line.id} className={`border-b border-outline-variant/40 hover:bg-surface-low/50 transition-colors ${isPatching ? "opacity-60" : ""}`}>
                        <td className="px-4 py-2.5 text-on-surface-variant/70 text-xs">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-primary text-xs">{line.item_code.code}</td>
                        <td className="px-4 py-2.5 text-sm">{line.item_code.short_name}</td>
                        {/* Hướng A: dòng thuộc phiếu nào (pallet có thể ghép nhiều phiếu) */}
                        <td className="px-4 py-2.5 text-xs hidden md:table-cell">
                          {line.inbound_request?.code
                            ? <span className="font-mono text-on-surface-variant">{line.inbound_request.code}</span>
                            : <span className="text-amber-600">Phát sinh</span>}
                        </td>

                        {/* L1 fix — SL THÙNG editable inline */}
                        <td className="px-4 py-2.5 text-right">
                          {canEdit ? (
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={draftQty}
                              disabled={isPatching}
                              onChange={(e) => setEditDraft({ lineId: line.id, field: "qty_box", value: e.target.value })}
                              onBlur={commitQty}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                if (e.key === "Escape") { setEditDraft(null); (e.target as HTMLInputElement).blur(); }
                              }}
                              className="w-20 px-2 py-1 text-right font-semibold border border-outline-variant rounded focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-surface-low text-sm"
                            />
                          ) : (
                            <span className="font-semibold">{Number(line.qty_box)}</span>
                          )}
                        </td>

                        {/* L2 fix — SL LẺ (auto-tính, readonly) */}
                        <td className="px-4 py-2.5 text-right">
                          <span className="font-mono text-sm">
                            {Number(line.qty_unit).toLocaleString("vi-VN")}
                          </span>
                          {line.item_code.unit?.symbol && (
                            <span className="text-[10px] text-on-surface-variant/60 ml-1">
                              {line.item_code.unit.symbol}
                            </span>
                          )}
                          {line.item_code.units_per_box && line.item_code.units_per_box > 1 && (
                            <p className="text-[9px] text-on-surface-variant/50 font-mono">
                              ({line.item_code.units_per_box}/thùng)
                            </p>
                          )}
                        </td>

                        {/* LÔ editable inline */}
                        <td className="px-4 py-2.5 hidden md:table-cell text-on-surface-variant text-xs">
                          {canEdit ? (
                            <input
                              type="text"
                              value={draftLot}
                              disabled={isPatching}
                              placeholder="—"
                              onChange={(e) => setEditDraft({ lineId: line.id, field: "lot", value: e.target.value })}
                              onBlur={commitLot}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                if (e.key === "Escape") { setEditDraft(null); (e.target as HTMLInputElement).blur(); }
                              }}
                              className="w-24 px-2 py-1 border border-outline-variant rounded focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-surface-low text-xs font-mono"
                            />
                          ) : (
                            <span>{line.lot || "—"}</span>
                          )}
                        </td>

                        {/* HSD editable inline */}
                        <td className="px-4 py-2.5 hidden md:table-cell text-on-surface-variant text-xs">
                          {canEdit ? (
                            <input
                              type="date"
                              value={draftExpiry}
                              disabled={isPatching}
                              onChange={(e) => setEditDraft({ lineId: line.id, field: "expiry_date", value: e.target.value })}
                              onBlur={commitExpiry}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                if (e.key === "Escape") { setEditDraft(null); (e.target as HTMLInputElement).blur(); }
                              }}
                              className="px-2 py-1 border border-outline-variant rounded focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-surface-low text-xs"
                            />
                          ) : (
                            <span>{formatDate(line.expiry_date)}</span>
                          )}
                        </td>

                        <td className="px-4 py-2.5 text-right hidden lg:table-cell text-on-surface-variant text-xs">{Number(line.weight_kg).toFixed(1)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {isPatching ? (
                            <span className="material-symbols-outlined animate-spin text-[16px] text-primary">progress_activity</span>
                          ) : canEdit ? (
                            <button onClick={() => handleDeleteLine(line.id)}
                              className="p-1 rounded-lg hover:bg-rose-50 text-on-surface-variant hover:text-rose-600 transition-colors" title="Xóa">
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          ) : null}
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab: Lịch sử (PAL-06) */}
          {activeTab === "history" && (
            <div className="p-5">
              {historyLoading ? (
                <div className="flex items-center justify-center py-10">
                  <span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-10 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[36px] opacity-30">history</span>
                  <p className="mt-2 text-sm">Chưa có lịch sử.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline vertical line */}
                  <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-surface-mid" />
                  <div className="space-y-6">
                    {/* Phase 3.5 — TC_HISTORY_PAL_006/_014/_017, TC_EDIT_PAL_018:
                        render người thực hiện + role + IP + from→to location */}
                    {history.map((ev) => {
                      const act =
                        ACTION_MAP[ev.action] ||
                        { icon: "info", label: ev.label || ev.action, color: "text-on-surface-variant bg-surface-low" };
                      const label = ev.label || act.label;
                      const roleLabel = ev.performed_by_role ? ROLE_LABEL[ev.performed_by_role] || ev.performed_by_role : null;
                      return (
                        <div key={ev.id} className="flex gap-4 relative">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${act.color} border-2 border-white shadow-sm`}>
                            <span className="material-symbols-outlined text-[18px]">{act.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-on-surface">{label}</p>
                              {ev.kind === "movement" && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                  Vị trí
                                </span>
                              )}
                            </div>

                            {/* Movement: vị trí cũ → vị trí mới */}
                            {(ev.from_location || ev.to_location) && (
                              <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1 flex-wrap">
                                {ev.from_location && (
                                  <span className="inline-flex items-center gap-0.5">
                                    <span className="material-symbols-outlined text-[12px]">place</span>
                                    <span className="font-mono">{ev.from_location.code}</span>
                                  </span>
                                )}
                                {ev.from_location && ev.to_location && (
                                  <span className="material-symbols-outlined text-[14px] text-on-surface-variant/60">arrow_forward</span>
                                )}
                                {ev.to_location && (
                                  <span className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold">
                                    <span className="material-symbols-outlined text-[12px]">where_to_vote</span>
                                    <span className="font-mono">{ev.to_location.code}</span>
                                  </span>
                                )}
                              </p>
                            )}

                            {/* Chuyển trạng thái — TC_HISTORY_PAL_013/_015/_018/_020 */}
                            {ev.kind !== "movement" && ev.detail && (
                              <p className="text-sm font-semibold text-on-surface-variant mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span className="material-symbols-outlined text-[14px] text-on-surface-variant/60">sync_alt</span>
                                {ev.detail}
                              </p>
                            )}

                            {/* Chuyển trạng thái — TC_HISTORY_PAL_013/_015/_018/_020 */}
                            {ev.kind !== "movement" && ev.detail && (
                              <p className="text-sm font-semibold text-on-surface-variant mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span className="material-symbols-outlined text-[14px] text-on-surface-variant/60">sync_alt</span>
                                {ev.detail}
                              </p>
                            )}

                            {ev.reason && (
                              <p className="text-sm text-on-surface-variant mt-0.5">{ev.reason}</p>
                            )}

                            {/* Người thực hiện + role + IP */}
                            <div className="text-xs text-on-surface-variant/80 mt-1 flex items-center gap-2 flex-wrap">
                              <span>{formatDateTime(ev.performed_at)}</span>
                              {ev.performed_by_name && (
                                <>
                                  <span className="text-on-surface-variant/40">·</span>
                                  <span className="font-semibold text-on-surface-variant">
                                    {ev.performed_by_name}
                                    {roleLabel && (
                                      <span className="ml-1 text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-surface-low">
                                        {roleLabel}
                                      </span>
                                    )}
                                  </span>
                                </>
                              )}
                              {ev.ip_address && (
                                <>
                                  <span className="text-on-surface-variant/40">·</span>
                                  <span className="font-mono text-[10px] text-on-surface-variant/60">IP: {ev.ip_address}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* PAL-05: Modal Unlock */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowUnlockModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-outline-variant">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">lock_open</span>
                Yêu cầu sửa pallet
              </h3>
              <p className="text-sm text-on-surface-variant mt-1">Mở lại pallet <strong>{pallet.code}</strong> để chỉnh sửa. Hành động này sẽ được ghi nhận.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">
                  Phân loại lý do <span className="text-rose-500">*</span>
                </label>
                <select
                  value={unlockReasonCode}
                  onChange={(e) => setUnlockReasonCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                >
                  <option value="SAI_SL">Sai số lượng đếm</option>
                  <option value="SAI_LO">Sai số lô</option>
                  <option value="SAI_MA">Sai mã hàng</option>
                  <option value="SAI_HSD">Sai hạn sử dụng</option>
                  <option value="KHAC">Khác</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">
                  Người duyệt <span className="text-on-surface-variant/70 normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={unlockApprover}
                  onChange={(e) => setUnlockApprover(e.target.value)}
                  placeholder="Tên người duyệt yêu cầu..."
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">
                  Chi tiết lý do <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="Mô tả chi tiết tại sao cần mở lại pallet (ít nhất 5 ký tự)..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  autoFocus
                />
                <p className="text-xs text-on-surface-variant/70 mt-1">{unlockReason.trim().length}/5 ký tự tối thiểu</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3">
              <button onClick={() => setShowUnlockModal(false)} className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-low rounded-lg transition-colors">Hủy</button>
              <button onClick={handleUnlock} disabled={unlocking || unlockReason.trim().length < 5}
                className="px-5 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 flex items-center gap-2 disabled:opacity-50 transition-colors">
                <span className="material-symbols-outlined text-[16px]">{unlocking ? "progress_activity" : "lock_open"}</span>
                Xác nhận mở lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAL-03: BarcodeScanner component */}
      <BarcodeScanner
        isOpen={showScanner}
        onScan={handleBarcodeScan}
        onClose={() => setShowScanner(false)}
        title="Quét mã barcode / QR hàng hóa"
      />
    </AppLayout>
  );
}
