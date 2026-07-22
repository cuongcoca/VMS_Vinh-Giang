"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import AttachmentPanel from "@/components/AttachmentPanel";

type Supplier = { id: string; code: string; name: string };
type ItemCode = { id: string; code: string; short_name: string };
type InboundLine = {
  id: string;
  item_code_id: string;
  item_code?: { code: string; short_name: string };
  qty_expected: number;
  qty_received: number | null;
  qty_accepted: number | null;
  recon_accepted?: boolean;
  lot: string | null;
  expiry_date: string | null;
  note: string | null;
  discrepancy_note: string | null;
};
type InboundRequest = {
  id: string;
  code: string;
  status: string;
  supplier_id: string | null;
  supplier: Supplier | null;
  expected_date: string | null;
  invoice_no: string | null;
  note: string | null;
  received_at: string | null;
  reconciled_at: string | null;
  completed_at: string | null;
  lines: InboundLine[];
  created_at: string;
  updated_at: string;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  DRAFT: { label: "Nháp", color: "bg-surface-low text-on-surface-variant", icon: "edit_note" },
  PENDING: { label: "Chờ tiếp nhận", color: "bg-amber-50 text-amber-700", icon: "hourglass_top" },
  RECEIVING: { label: "Đang nhận hàng", color: "bg-blue-50 text-blue-700", icon: "inventory" },
  RECONCILING: { label: "Đang đối chiếu", color: "bg-purple-50 text-purple-700", icon: "compare_arrows" },
  COMPLETED: { label: "Hoàn tất", color: "bg-emerald-50 text-emerald-700", icon: "check_circle" },
  CANCELLED: { label: "Đã hủy", color: "bg-rose-50 text-rose-600", icon: "cancel" },
};

export default function InboundDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const [request, setRequest] = useState<InboundRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // UC-IN-03: stats từ API
  type ReconStats = {
    total_expected: number;
    total_on_pallets?: number;
    total_received: number;
    total_accepted: number;
    diff: number;
    diff_percent: number;
    lines_count: number;
    temp_codes_count: number;
    pallets: { total: number; counting: number; confirmed: number; in_storage: number; in_staging: number };
    extra_lines_count: number;
    // fix 1 phiếu — nhiều pallet: số mã lệch giữa đã-lên-pallet và thực-nhận
    pallet_received_mismatch_count?: number;
  };
  type ExtraLine = {
    item_code_id: string;
    item_code: { id: string; code: string; short_name: string; status?: string };
    total_qty: number;
    pallets: string[];
  };
  // fix 1 phiếu — nhiều pallet: đối chiếu đã-lên-pallet vs thực-nhận theo từng mã
  type ReconcileItem = { item_code_id: string; code: string; short_name: string; qty_expected: number; qty_received: number | null; qty_on_pallet: number; diff: number | null };
  const [stats, setStats] = useState<ReconStats | null>(null);
  const [palletsByItem, setPalletsByItem] = useState<Record<string, string[]>>({});
  const [extraLines, setExtraLines] = useState<ExtraLine[]>([]);
  const [reconcileByItem, setReconcileByItem] = useState<ReconcileItem[]>([]);

  // UC-IN-04: ghi chú khi chốt + UC-IN-03: lý do yêu cầu kiểm lại
  const [closeNote, setCloseNote] = useState("");
  // Sprint A · P4-005: quyết định xử lý chênh lệch (lưu vào InboundRequest.discrepancy_decision).
  const [discrepancyDecision, setDiscrepancyDecision] = useState<"ACCEPT" | "REVIEW_AGAIN" | "CREATE_ADJUSTMENT">("ACCEPT");
  const [showRecheckModal, setShowRecheckModal] = useState(false);
  const [recheckReason, setRecheckReason] = useState("");
  // VĐ3: hủy phiếu đã gửi kèm lý do
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Edit form state
  const [editForm, setEditForm] = useState({ expected_date: "", invoice_no: "", note: "" });
  const [editLines, setEditLines] = useState<InboundLine[]>([]);

  // New line addition
  const [showAddLine, setShowAddLine] = useState(false);
  const [newLineSearch, setNewLineSearch] = useState("");
  const [newLineResults, setNewLineResults] = useState<ItemCode[]>([]);
  const [showNewLineDropdown, setShowNewLineDropdown] = useState(false);
  const [newLine, setNewLine] = useState({ item_code_id: "", item_code_display: "", item_name_display: "", expected_qty: 1, lot: "", expiry_date: "", note: "" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Receiving state: track qty_received per line locally
  const [receivingQty, setReceivingQty] = useState<Record<string, string>>({});
  const [receivingNote, setReceivingNote] = useState<Record<string, string>>({});
  const [savingLineId, setSavingLineId] = useState<string | null>(null);

  // Reconciling state: track qty_accepted per line locally
  const [acceptedQty, setAcceptedQty] = useState<Record<string, string>>({});
  const [acceptedNote, setAcceptedNote] = useState<Record<string, string>>({});

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch detail
  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/wms/api/inbound/${id}`);
      const result = await res.json();
      if (result.success) {
        setRequest(result.data);
        // UC-IN-03: stats + pallets_by_item + extra_lines
        if (result.stats) setStats(result.stats);
        if (result.pallets_by_item) setPalletsByItem(result.pallets_by_item);
        if (result.extra_lines) setExtraLines(result.extra_lines);
        if (result.reconcile_by_item) setReconcileByItem(result.reconcile_by_item);
        // Initialize receiving quantities from existing data
        const qtyMap: Record<string, string> = {};
        const noteMap: Record<string, string> = {};
        const accQtyMap: Record<string, string> = {};
        const accNoteMap: Record<string, string> = {};
        result.data.lines?.forEach((line: InboundLine) => {
          if (line.qty_received !== null && line.qty_received !== undefined) {
            qtyMap[line.id] = String(line.qty_received);
          }
          if (line.discrepancy_note) {
            noteMap[line.id] = "";
          }
          if (line.qty_accepted !== null && line.qty_accepted !== undefined) {
            accQtyMap[line.id] = String(line.qty_accepted);
          }
        });
        setReceivingQty(qtyMap);
        setReceivingNote(noteMap);
        setAcceptedQty(accQtyMap);
        setAcceptedNote(accNoteMap);
      } else {
        alert(result.error || "Không tìm thấy phiếu.");
        router.push("/inbound");
      }
    } catch (err) {
      console.error("Fetch detail error:", err);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // VĐ3: mở sẵn modal hủy khi vào từ danh sách với ?cancel=1 (phiếu đã gửi)
  const cancelDeepLinkHandled = useRef(false);
  useEffect(() => {
    if (cancelDeepLinkHandled.current || !request) return;
    if (searchParams.get("cancel") === "1" && (request.status === "PENDING" || request.status === "RECEIVING")) {
      cancelDeepLinkHandled.current = true;
      setShowCancelModal(true);
    }
  }, [request, searchParams]);

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("vi-VN");
  };

  const formatDateTime = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("vi-VN");
  };

  // Enter edit mode
  const startEditing = () => {
    if (!request) return;
    setEditForm({
      expected_date: request.expected_date ? request.expected_date.substring(0, 10) : "",
      invoice_no: request.invoice_no || "",
      note: request.note || "",
    });
    setEditLines([...request.lines]);
    setEditing(true);
  };

  // Save edits
  const saveEdits = async () => {
    if (!request) return;
    if (!editForm.invoice_no.trim()) {
      showToast("Vui lòng nhập Số hoá đơn.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/wms/api/inbound/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expected_date: editForm.expected_date || null,
          invoice_no: editForm.invoice_no.trim(),
          note: editForm.note || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setEditing(false);
        fetchDetail();
      } else {
        alert(result.error || "Lỗi khi lưu.");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối.");
    } finally {
      setSaving(false);
    }
  };

  // Send phiếu
  const handleSend = async () => {
    if (!request) return;
    if (!confirm(`Gửi phiếu "${request.code}" cho Thủ kho?`)) return;
    try {
      const res = await fetch(`/wms/api/inbound/${id}/send`, { method: "POST" });
      const result = await res.json();
      if (result.success) fetchDetail();
      else alert(result.error);
    } catch (err) {
      console.error(err);
    }
  };

  // Cancel phiếu
  const handleCancel = async () => {
    if (!request) return;
    if (!confirm(`Hủy phiếu "${request.code}"?`)) return;
    try {
      const res = await fetch(`/wms/api/inbound/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        router.push("/inbound");
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // VĐ3: hủy phiếu ĐÃ GỬI (PENDING/RECEIVING) — bắt buộc lý do
  const handleCancelWithReason = async () => {
    if (!request) return;
    if (!cancelReason.trim()) {
      alert("Vui lòng nhập lý do hủy phiếu.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/wms/api/inbound/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const result = await res.json();
      if (result.success) {
        setShowCancelModal(false);
        setCancelReason("");
        router.push("/inbound");
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối.");
    } finally {
      setSaving(false);
    }
  };

  // ═══════════════════════════════════════════
  // RECEIVING HANDLERS (Bước 7)
  // ═══════════════════════════════════════════

  // Bắt đầu tiếp nhận: PENDING → RECEIVING
  const handleStartReceiving = async () => {
    if (!request) return;
    if (!confirm(`Bắt đầu tiếp nhận hàng cho phiếu "${request.code}"?\nSau khi bắt đầu, bạn sẽ nhập số lượng thực nhận từng dòng.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/wms/api/inbound/${id}/receive`, { method: "POST" });
      const result = await res.json();
      if (result.success) {
        showToast("Đã bắt đầu tiếp nhận hàng!");
        fetchDetail();
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối.");
    } finally {
      setSaving(false);
    }
  };

  // Lưu SL thực nhận cho 1 dòng
  const handleSaveLineReceive = async (lineId: string) => {
    const qtyStr = receivingQty[lineId];
    if (qtyStr === undefined || qtyStr === "") {
      alert("Vui lòng nhập số lượng thực nhận.");
      return;
    }
    const qty = Number(qtyStr);
    if (isNaN(qty) || qty < 0) {
      alert("Số lượng thực nhận phải ≥ 0.");
      return;
    }

    setSavingLineId(lineId);
    try {
      const res = await fetch(`/wms/api/inbound/${id}/lines/${lineId}/receive`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qty_received: qty,
          note: receivingNote[lineId]?.trim() || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        showToast("Đã lưu SL thực nhận!");
        fetchDetail();
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối.");
    } finally {
      setSavingLineId(null);
    }
  };

  // Lưu tất cả dòng chưa lưu
  const handleSaveAllLines = async () => {
    if (!request) return;
    const unsavedLines = request.lines.filter(
      (line) => line.qty_received === null || line.qty_received === undefined
    );
    if (unsavedLines.length === 0) {
      showToast("Tất cả dòng đã có SL thực nhận!", "success");
      return;
    }

    // Validate all unsaved have qty entered
    for (const line of unsavedLines) {
      const qtyStr = receivingQty[line.id];
      if (!qtyStr && qtyStr !== "0") {
        alert(`Dòng "${line.item_code?.code}" chưa nhập SL thực nhận.`);
        return;
      }
    }

    setSaving(true);
    let successCount = 0;
    for (const line of unsavedLines) {
      try {
        const qty = Number(receivingQty[line.id]);
        const res = await fetch(`/wms/api/inbound/${id}/lines/${line.id}/receive`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qty_received: qty,
            note: receivingNote[line.id]?.trim() || null,
          }),
        });
        const result = await res.json();
        if (result.success) successCount++;
      } catch (err) {
        console.error(err);
      }
    }
    setSaving(false);
    showToast(`Đã lưu ${successCount}/${unsavedLines.length} dòng!`);
    fetchDetail();
  };

  // VĐ2: số thùng đã xếp lên pallet theo từng mã (lấy từ reconcile_by_item của API)
  const qtyOnPalletForItem = (itemCodeId: string): number => {
    const r = reconcileByItem.find((x) => x.item_code_id === itemCodeId);
    return r ? Number(r.qty_on_pallet) : 0;
  };

  // VĐ1: điền SL thực nhận cho 1 dòng bằng số đã lên pallet (vẫn cho sửa tay trước khi Lưu)
  const fillFromPalletLine = (line: InboundLine) => {
    const onPallet = qtyOnPalletForItem(line.item_code_id);
    if (onPallet <= 0) {
      showToast("Mã này chưa có hàng trên pallet nào.", "error");
      return;
    }
    setReceivingQty((prev) => ({ ...prev, [line.id]: String(onPallet) }));
  };

  // VĐ1: điền tất cả dòng từ pallet (chỉ dòng đã có hàng trên pallet & chưa lưu SL thực nhận)
  const fillAllFromPallet = () => {
    if (!request) return;
    const next = { ...receivingQty };
    let count = 0;
    for (const line of request.lines) {
      const onPallet = qtyOnPalletForItem(line.item_code_id);
      const already = line.qty_received !== null && line.qty_received !== undefined;
      if (onPallet > 0 && !already) {
        next[line.id] = String(onPallet);
        count++;
      }
    }
    setReceivingQty(next);
    if (count === 0) {
      showToast("Không có dòng nào để lấy (chưa có pallet hoặc đã nhập hết).", "error");
    } else {
      showToast(`Đã điền ${count} dòng từ pallet — kiểm tra rồi bấm "Lưu tất cả".`);
    }
  };

  // Hoàn tất tiếp nhận: RECEIVING → RECONCILING
  const handleCompleteReceiving = async () => {
    if (!request) return;
    const unsavedLines = request.lines.filter(
      (line) => line.qty_received === null || line.qty_received === undefined
    );
    if (unsavedLines.length > 0) {
      alert(`Còn ${unsavedLines.length} dòng chưa nhập SL thực nhận. Vui lòng nhập hết trước khi hoàn tất.`);
      return;
    }
    if (!confirm(`Hoàn tất tiếp nhận phiếu "${request.code}"?\nPhiếu sẽ chuyển sang trạng thái Đối chiếu.`)) return;

    setSaving(true);
    try {
      const res = await fetch(`/wms/api/inbound/${id}/receive`, { method: "PUT" });
      const result = await res.json();
      if (result.success) {
        showToast("Hoàn tất tiếp nhận! Phiếu chuyển sang Đối chiếu.");
        fetchDetail();
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối.");
    } finally {
      setSaving(false);
    }
  };

  // ═══════════════════════════════════════════
  // RECONCILING HANDLERS (Bước 8 + 9)
  // ═══════════════════════════════════════════

  // Lưu SL chấp nhận cho 1 dòng
  const handleSaveLineAccept = async (lineId: string) => {
    const qtyStr = acceptedQty[lineId];
    if (qtyStr === undefined || qtyStr === "") {
      alert("Vui lòng nhập số lượng chấp nhận.");
      return;
    }
    const qty = Number(qtyStr);
    if (isNaN(qty) || qty < 0) {
      alert("Số lượng chấp nhận phải ≥ 0.");
      return;
    }

    setSavingLineId(lineId);
    try {
      const res = await fetch(`/wms/api/inbound/${id}/lines/${lineId}/accept`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qty_accepted: qty,
          discrepancy_note: acceptedNote[lineId]?.trim() || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        showToast("Đã lưu SL chấp nhận!");
        fetchDetail();
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối.");
    } finally {
      setSavingLineId(null);
    }
  };

  // Chấp nhận tất cả dòng (auto-fill SL thực nhận nếu chưa nhập)
  const handleAcceptAllLines = async () => {
    if (!request) return;
    const linesToAccept = request.lines.filter(
      (line) => line.qty_accepted === null || line.qty_accepted === undefined
    );
    if (linesToAccept.length === 0) {
      showToast("Tất cả dòng đã có SL chấp nhận!", "success");
      return;
    }

    setSaving(true);
    let successCount = 0;
    for (const line of linesToAccept) {
      try {
        // Nếu kế toán chưa nhập qty_accepted → mặc định bằng qty_received
        const qty = acceptedQty[line.id] !== undefined && acceptedQty[line.id] !== ""
          ? Number(acceptedQty[line.id])
          : Number(line.qty_received);
        const res = await fetch(`/wms/api/inbound/${id}/lines/${line.id}/accept`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qty_accepted: qty,
            discrepancy_note: acceptedNote[line.id]?.trim() || null,
          }),
        });
        const result = await res.json();
        if (result.success) successCount++;
      } catch (err) {
        console.error(err);
      }
    }
    setSaving(false);
    showToast(`Đã chấp nhận ${successCount}/${linesToAccept.length} dòng!`);
    fetchDetail();
  };

  // Chốt phiếu: RECONCILING → COMPLETED
  const handleCompleteInbound = async () => {
    if (!request) return;
    const unacceptedLines = request.lines.filter(
      (line) => line.qty_accepted === null || line.qty_accepted === undefined
    );
    if (unacceptedLines.length > 0) {
      alert(`Còn ${unacceptedLines.length} dòng chưa nhập SL chấp nhận. Vui lòng hoàn tất đối chiếu trước.`);
      return;
    }

    // UC-IN-04: bắt buộc close_note nếu có chênh lệch
    const hasDiscrepancy = request.lines.some(
      (l) => Number(l.qty_accepted || 0) !== Number(l.qty_expected)
    );
    if (hasDiscrepancy && !closeNote.trim()) {
      alert("Phiếu có chênh lệch — vui lòng nhập 'Ghi chú khi chốt' (truy vết quyết định).");
      return;
    }

    // fix 1 phiếu — nhiều pallet: cảnh báo (không chặn) nếu tổng trên pallet lệch thực nhận
    const palletMismatchCount = reconcileByItem.filter(
      (r) => r.qty_received !== null && r.diff !== 0
    ).length;
    const confirmMsg =
      palletMismatchCount > 0
        ? `Chốt phiếu "${request.code}"?\n\n⚠ ${palletMismatchCount} mã có SL trên pallet LỆCH với thực nhận — nên kiểm lại hàng đã xếp lên pallet.\n\nSau khi chốt, phiếu sẽ không thể sửa đổi.`
        : `Chốt phiếu "${request.code}"?\nSau khi chốt, phiếu sẽ không thể sửa đổi.`;
    if (!confirm(confirmMsg)) return;

    setSaving(true);
    try {
      const res = await fetch(`/wms/api/inbound/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          close_note: closeNote || null,
          discrepancy_decision: hasDiscrepancy ? discrepancyDecision : null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        showToast("🎉 Phiếu đã chốt thành công!");
        setCloseNote("");
        fetchDetail();
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối.");
    } finally {
      setSaving(false);
    }
  };

  // UC-IN-03: Kế toán yêu cầu thủ kho kiểm lại (RECONCILING → RECEIVING)
  const handleRequestRecheck = async () => {
    if (!recheckReason.trim()) {
      alert("Vui lòng nhập lý do yêu cầu kiểm lại.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/wms/api/inbound/${id}/request-recheck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: recheckReason }),
      });
      const result = await res.json();
      if (result.success) {
        showToast("Đã gửi yêu cầu kiểm lại — phiếu chuyển về RECEIVING.");
        setShowRecheckModal(false);
        setRecheckReason("");
        fetchDetail();
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối.");
    } finally {
      setSaving(false);
    }
  };

  // Search item codes for new line
  const searchItemCodes = async (query: string) => {
    if (!query || query.length < 1) {
      setNewLineResults([]);
      setShowNewLineDropdown(false);
      return;
    }
    try {
      const res = await fetch(`/wms/api/item-codes?q=${encodeURIComponent(query)}`);
      const result = await res.json();
      if (result.success) {
        setNewLineResults(result.data || []);
        setShowNewLineDropdown(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewLineSearchInput = (value: string) => {
    setNewLineSearch(value);
    setNewLine({ ...newLine, item_code_id: "", item_code_display: value, item_name_display: "" });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchItemCodes(value), 300);
  };

  const selectNewLineItem = (item: ItemCode) => {
    setNewLine({ ...newLine, item_code_id: item.id, item_code_display: item.code, item_name_display: item.short_name });
    setNewLineSearch(item.code);
    setShowNewLineDropdown(false);
  };

  // Add line
  const handleAddLine = async () => {
    if (!newLine.item_code_id) {
      alert("Vui lòng chọn mã hàng.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/wms/api/inbound/${id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_code_id: newLine.item_code_id,
          expected_qty: newLine.expected_qty,
          lot: newLine.lot || null,
          expiry_date: newLine.expiry_date || null,
          note: newLine.note || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setShowAddLine(false);
        setNewLine({ item_code_id: "", item_code_display: "", item_name_display: "", expected_qty: 1, lot: "", expiry_date: "", note: "" });
        setNewLineSearch("");
        fetchDetail();
      } else {
        alert(result.error || "Lỗi khi thêm dòng hàng.");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối.");
    } finally {
      setSaving(false);
    }
  };

  // Remove line
  const handleRemoveLine = async (lineId: string) => {
    if (!confirm("Xóa dòng hàng này?")) return;
    try {
      const res = await fetch(`/wms/api/inbound/${id}/lines`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_id: lineId }),
      });
      const result = await res.json();
      if (result.success) fetchDetail();
      else alert(result.error);
    } catch (err) {
      console.error(err);
    }
  };

  // ═══════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════

  const getDiffBadge = (expected: number, received: number | null) => {
    if (received === null || received === undefined) return null;
    const diff = Number(received) - Number(expected);
    if (diff === 0) {
      return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600">✓ Khớp</span>;
    }
    if (diff > 0) {
      return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600">+{diff}</span>;
    }
    return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600">{diff}</span>;
  };

  const getReconcilingProgress = () => {
    if (!request) return { done: 0, total: 0, pct: 0 };
    const total = request.lines.length;
    const done = request.lines.filter(
      (l) => l.qty_accepted !== null && l.qty_accepted !== undefined
    ).length;
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  const getReceivingProgress = () => {
    if (!request) return { done: 0, total: 0, pct: 0 };
    const total = request.lines.length;
    const done = request.lines.filter(
      (l) => l.qty_received !== null && l.qty_received !== undefined
    ).length;
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  if (loading) {
    return (
      <AppLayout title="CHI TIẾT PHIẾU NHẬP">
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
        </div>
      </AppLayout>
    );
  }

  if (!request) {
    return (
      <AppLayout title="CHI TIẾT PHIẾU NHẬP">
        <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
          <span className="material-symbols-outlined text-[48px] opacity-30">error</span>
          <p className="mt-2">Không tìm thấy phiếu nhập.</p>
          <Link href="/inbound" className="mt-4 text-primary hover:underline text-sm">← Quay lại</Link>
        </div>
      </AppLayout>
    );
  }

  const st = STATUS_MAP[request.status] || { label: request.status, color: "bg-surface-low text-on-surface-variant", icon: "help" };
  const isDraft = request.status === "DRAFT";
  const isPending = request.status === "PENDING";
  const isReceiving = request.status === "RECEIVING";
  const isReconciling = request.status === "RECONCILING";
  const reconProgress = getReconcilingProgress();
  const isCompleted = request.status === "COMPLETED";
  const isCancelled = request.status === "CANCELLED";
  const progress = getReceivingProgress();

  return (
    <AppLayout title="CHI TIẾT PHIẾU NHẬP">
      <div className="p-6 space-y-5 min-w-0 overflow-hidden">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-slide-in ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}>
            <span className="material-symbols-outlined text-[18px]">
              {toast.type === "success" ? "check_circle" : "error"}
            </span>
            {toast.message}
          </div>
        )}

        {/* Back link + Header */}
        <div>
          <div className="mb-3"><BackButton fallback="/inbound" variant="link">Quay lại danh sách</BackButton></div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold tracking-tight text-primary font-mono">{request.code}</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${st.color}`}>
                <span className="material-symbols-outlined text-[14px]">{st.icon}</span>
                {st.label}
              </span>
            </div>

            {/* Action buttons based on status */}
            <div className="flex items-center gap-2 flex-wrap">
              {isDraft && (
                <>
                  {!editing ? (
                    <button
                      onClick={startEditing}
                      className="px-4 py-2 text-sm border border-outline-variant rounded-lg flex items-center gap-2 hover:bg-surface-low font-medium transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                      Sửa phiếu
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditing(false)}
                        className="px-4 py-2 text-sm border border-outline-variant rounded-lg hover:bg-surface-low transition-colors"
                      >
                        Hủy sửa
                      </button>
                      <button
                        onClick={saveEdits}
                        disabled={saving}
                        className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover flex items-center gap-2 disabled:opacity-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "save"}</span>
                        Lưu
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleSend}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    Gửi cho Thủ kho
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm border border-rose-300 text-rose-600 rounded-lg hover:bg-rose-50 flex items-center gap-2 font-medium transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                    Hủy phiếu
                  </button>
                </>
              )}

              {isPending && (
                <>
                  <button
                    onClick={handleStartReceiving}
                    disabled={saving}
                    className="px-5 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-semibold disabled:opacity-50 transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px]">inventory</span>
                    Bắt đầu tiếp nhận hàng
                  </button>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    disabled={saving}
                    className="px-4 py-2 text-sm border border-rose-300 text-rose-600 rounded-lg hover:bg-rose-50 flex items-center gap-2 font-medium disabled:opacity-50 transition-colors"
                    title="Hủy phiếu tạo sai (kèm lý do)"
                  >
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                    Hủy phiếu
                  </button>
                </>
              )}

              {isReconciling && (
                <>
                  <Link
                    href={`/pallets?new_phn=${request.id}`}
                    className="px-4 py-2 text-sm border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 flex items-center gap-2 font-medium transition-colors"
                    title="Tạo pallet mới, link sẵn với phiếu này"
                  >
                    <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                    Tạo pallet
                  </Link>
                  <button
                    onClick={handleAcceptAllLines}
                    disabled={saving}
                    className="px-4 py-2 text-sm border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 flex items-center gap-2 font-medium disabled:opacity-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">done_all</span>
                    Chấp nhận tất cả
                  </button>
                  {/* UC-IN-03: Yêu cầu thủ kho kiểm lại */}
                  <button
                    onClick={() => setShowRecheckModal(true)}
                    disabled={saving}
                    className="px-4 py-2 text-sm border border-orange-400 text-orange-700 rounded-lg hover:bg-orange-50 flex items-center gap-2 font-medium disabled:opacity-50 transition-colors"
                    title="Quay về trạng thái Đang nhập để thủ kho kiểm lại"
                  >
                    <span className="material-symbols-outlined text-[18px]">replay</span>
                    Yêu cầu kiểm lại
                  </button>
                  <button
                    onClick={handleCompleteInbound}
                    disabled={saving || reconProgress.done < reconProgress.total}
                    className="px-5 py-2.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 font-semibold disabled:opacity-50 transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px]">lock</span>
                    Chốt phiếu nhập
                  </button>
                </>
              )}

              {isReceiving && (
                <>
                  <Link
                    href={`/pallets?new_phn=${request.id}`}
                    className="px-4 py-2 text-sm border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 flex items-center gap-2 font-medium transition-colors"
                    title="Tạo pallet mới, link sẵn với phiếu này"
                  >
                    <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                    Tạo pallet
                  </Link>
                  <button
                    onClick={fillAllFromPallet}
                    disabled={saving}
                    className="px-4 py-2 text-sm border border-outline-variant text-on-surface-variant rounded-lg hover:bg-surface-low flex items-center gap-2 font-medium disabled:opacity-50 transition-colors"
                    title="Điền SL thực nhận từ số đã xếp lên pallet — kiểm tra rồi bấm Lưu tất cả"
                  >
                    <span className="material-symbols-outlined text-[18px]">move_down</span>
                    Lấy từ pallet
                  </button>
                  <button
                    onClick={handleSaveAllLines}
                    disabled={saving}
                    className="px-4 py-2 text-sm border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-2 font-medium disabled:opacity-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Lưu tất cả
                  </button>
                  <button
                    onClick={handleCompleteReceiving}
                    disabled={saving || progress.done < progress.total}
                    className="px-5 py-2.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 font-semibold disabled:opacity-50 transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    Hoàn tất tiếp nhận
                  </button>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    disabled={saving}
                    className="px-4 py-2 text-sm border border-rose-300 text-rose-600 rounded-lg hover:bg-rose-50 flex items-center gap-2 font-medium disabled:opacity-50 transition-colors"
                    title="Hủy phiếu (kèm lý do)"
                  >
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                    Hủy phiếu
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* UC-IN-03: 4 KPI Cards — luôn hiển thị khi có stats (Phase 1.2 fix UC-IN-03 row 79) */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Tổng yêu cầu */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
              <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Tổng yêu cầu</div>
              <div className="text-2xl font-bold text-on-surface mt-1 font-mono">{stats.total_expected}</div>
              <div className="text-[11px] text-on-surface-variant mt-0.5">{stats.lines_count} mã hàng</div>
            </div>
            {/* Tổng thực nhập */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
              <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Tổng thực nhập</div>
              <div className={`text-2xl font-bold mt-1 font-mono ${
                stats.diff === 0 ? "text-emerald-600" : stats.diff < 0 ? "text-rose-600" : "text-amber-600"
              }`}>{stats.total_received}</div>
              <div className={`text-[11px] mt-0.5 font-semibold ${
                stats.diff === 0 ? "text-emerald-600" : stats.diff < 0 ? "text-rose-600" : "text-amber-600"
              }`}>
                {stats.diff > 0 ? "+" : ""}{stats.diff} ({stats.diff_percent > 0 ? "+" : ""}{stats.diff_percent}%)
              </div>
            </div>
            {/* Pallet đã tạo */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
              <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Pallet đã tạo</div>
              <div className="text-2xl font-bold text-blue-600 mt-1 font-mono">{stats.pallets.total}</div>
              <div className="text-[11px] text-on-surface-variant mt-0.5">
                {stats.pallets.confirmed + stats.pallets.in_storage} đã XN · {stats.pallets.counting} đang đếm
              </div>
            </div>
            {/* Mã tạm */}
            <div className={`rounded-xl border shadow-sm p-4 ${
              stats.temp_codes_count > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-outline-variant"
            }`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${
                stats.temp_codes_count > 0 ? "text-amber-700" : "text-on-surface-variant"
              }`}>Mã tạm</div>
              <div className={`text-2xl font-bold mt-1 font-mono ${
                stats.temp_codes_count > 0 ? "text-amber-700" : "text-on-surface"
              }`}>{stats.temp_codes_count}</div>
              <div className={`text-[11px] mt-0.5 ${
                stats.temp_codes_count > 0 ? "text-amber-600" : "text-on-surface-variant"
              }`}>{stats.temp_codes_count > 0 ? "Cần KT chuẩn hóa" : "Đã chuẩn hóa hết"}</div>
            </div>
          </div>
        )}

        {/* 1 phiếu — nhiều pallet: tiến độ thùng đã quét lên pallet so với tổng yêu cầu */}
        {stats && stats.total_expected > 0 && (
          <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <span className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">inventory_2</span>
                Đã lên pallet
              </span>
              <span className="text-sm font-mono font-bold text-on-surface">
                {stats.total_on_pallets || 0}/{stats.total_expected} thùng
                {(stats.total_on_pallets || 0) >= stats.total_expected ? (
                  <span className="text-emerald-600 font-semibold"> · đã đủ ✓</span>
                ) : (
                  <span className="text-amber-600 font-semibold"> · còn {stats.total_expected - (stats.total_on_pallets || 0)}</span>
                )}
              </span>
            </div>
            <div className="h-2.5 bg-surface-low rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (stats.total_on_pallets || 0) >= stats.total_expected ? "bg-emerald-500" : "bg-primary"
                }`}
                style={{
                  width: `${Math.min(100, Math.round(((stats.total_on_pallets || 0) / stats.total_expected) * 100))}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1.5">
              Số thùng đã quét lên các pallet của phiếu, so với tổng yêu cầu. Mỗi pallet chỉ chứa số thật xếp lên.
            </p>
          </div>
        )}

        {/* fix 1 phiếu — nhiều pallet: đối chiếu ĐÃ LÊN PALLET vs THỰC NHẬN theo từng mã */}
        {(isReceiving || isReconciling) && (() => {
          const mismatches = reconcileByItem.filter((r) => r.qty_received !== null && r.diff !== 0);
          if (mismatches.length === 0) return null;
          return (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-rose-800 flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-[18px]">rule</span>
                Lệch: tổng trên pallet ≠ thực nhận — {mismatches.length} mã
              </h3>
              <p className="text-[12px] text-rose-700/80 mb-2">
                Số thùng đã xếp lên các pallet không khớp với SL thực nhận thủ kho ghi. Nên kiểm tra lại trước khi chốt.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-rose-200 text-[11px] text-rose-800 uppercase">
                      <th className="text-left px-3 py-2">Mã hàng</th>
                      <th className="text-left px-3 py-2">Tên</th>
                      <th className="text-right px-3 py-2">Thực nhận</th>
                      <th className="text-right px-3 py-2">Trên pallet</th>
                      <th className="text-right px-3 py-2">Lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mismatches.map((r) => (
                      <tr key={r.item_code_id} className="border-b border-rose-100">
                        <td className="px-3 py-2 font-mono font-semibold text-rose-900">{r.code}</td>
                        <td className="px-3 py-2 text-rose-900">{r.short_name}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.qty_received}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.qty_on_pallet}</td>
                        <td className={`px-3 py-2 text-right font-mono font-bold ${(r.diff ?? 0) > 0 ? "text-amber-700" : "text-rose-700"}`}>
                          {(r.diff ?? 0) > 0 ? "+" : ""}{r.diff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* UC-IN-03: Section "Hàng phát sinh" (PalletLine có ItemCode không thuộc InboundLine) */}
        {(isReceiving || isReconciling) && extraLines.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[18px]">new_releases</span>
              🆕 Hàng phát sinh — {extraLines.length} mã (không nằm trong phiếu gốc)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-200">
                    <th className="text-left px-3 py-2 text-[11px] font-bold text-amber-800 uppercase">Mã hàng</th>
                    <th className="text-left px-3 py-2 text-[11px] font-bold text-amber-800 uppercase">Tên</th>
                    <th className="text-right px-3 py-2 text-[11px] font-bold text-amber-800 uppercase">SL</th>
                    <th className="text-left px-3 py-2 text-[11px] font-bold text-amber-800 uppercase">Pallet</th>
                    <th className="text-left px-3 py-2 text-[11px] font-bold text-amber-800 uppercase">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {extraLines.map((el) => (
                    <tr key={el.item_code_id} className="border-b border-amber-100">
                      <td className="px-3 py-2 font-mono font-semibold text-amber-900">{el.item_code.code}</td>
                      <td className="px-3 py-2 text-amber-900">{el.item_code.short_name}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-amber-900">+{el.total_qty}</td>
                      <td className="px-3 py-2 font-mono text-xs text-amber-700">{el.pallets.join(", ")}</td>
                      <td className="px-3 py-2">
                        {el.item_code.code.startsWith("TMP-") ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                            Chờ chuẩn hóa
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">
                            Hàng phát sinh
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-amber-700 mt-2 italic">
              ⚠️ Mã &quot;TMP-...&quot; cần kế toán chuẩn hóa thành mã chính thức trước khi chốt phiếu.
            </p>
          </div>
        )}

        {/* UC-IN-03: Modal "Yêu cầu kiểm lại" */}
        {showRecheckModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowRecheckModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-bold text-orange-700 flex items-center gap-2">
                <span className="material-symbols-outlined">replay</span>
                Yêu cầu thủ kho kiểm lại
              </h3>
              <p className="text-sm text-on-surface-variant mt-2">
                Phiếu sẽ chuyển từ <b>RECONCILING</b> về <b>RECEIVING</b> để thủ kho điều chỉnh lại.
              </p>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mt-4 mb-1.5">
                Lý do <span className="text-rose-600">*</span>
              </label>
              <textarea
                value={recheckReason}
                onChange={(e) => setRecheckReason(e.target.value)}
                rows={3}
                placeholder="VD: SL thực nhận chênh quá lớn, cần kiểm tra lại thùng hàng..."
                className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 resize-none"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => { setShowRecheckModal(false); setRecheckReason(""); }}
                  className="px-4 py-2 text-sm border border-outline-variant rounded-lg hover:bg-surface-low"
                >
                  Hủy
                </button>
                <button
                  onClick={handleRequestRecheck}
                  disabled={saving || !recheckReason.trim()}
                  className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-semibold"
                >
                  {saving ? "Đang gửi..." : "Gửi yêu cầu"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VĐ3: Modal "Hủy phiếu (kèm lý do)" — cho phiếu đã gửi (PENDING/RECEIVING) */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowCancelModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-bold text-rose-700 flex items-center gap-2">
                <span className="material-symbols-outlined">cancel</span>
                Hủy phiếu nhập {request.code}
              </h3>
              <p className="text-sm text-on-surface-variant mt-2">
                Phiếu sẽ chuyển sang <b>Đã hủy</b> và không dùng để nhận hàng nữa. Lý do được lưu lại để truy vết.
              </p>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mt-4 mb-1.5">
                Lý do hủy <span className="text-rose-600">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="VD: Tạo nhầm nhà cung cấp / trùng phiếu / sai mã hàng..."
                className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 resize-none"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => { setShowCancelModal(false); setCancelReason(""); }}
                  className="px-4 py-2 text-sm border border-outline-variant rounded-lg hover:bg-surface-low"
                >
                  Quay lại
                </button>
                <button
                  onClick={handleCancelWithReason}
                  disabled={saving || !cancelReason.trim()}
                  className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 font-semibold"
                >
                  {saving ? "Đang hủy..." : "Xác nhận hủy"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reconciling Progress Bar (only when RECONCILING) */}
        {isReconciling && (
          <>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">compare_arrows</span>
                  Kế toán đang đối chiếu
                </span>
                <span className="text-sm font-bold text-purple-700 font-mono">
                  {reconProgress.done}/{reconProgress.total} dòng ({reconProgress.pct}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-purple-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${reconProgress.pct}%` }}
                ></div>
              </div>
              {reconProgress.done === reconProgress.total && reconProgress.total > 0 && (
                <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Tất cả dòng đã đối chiếu — Có thể &quot;Chốt phiếu nhập&quot;
                </p>
              )}
            </div>

            {/* UC-IN-04: Checklist 7 điều kiện chốt phiếu (gồm 2 check pallet status) */}
            {(() => {
              const allLinesReconciled = reconProgress.done === reconProgress.total && reconProgress.total > 0;
              const noPendingTempCodes = !(request.lines || []).some(l => (l.item_code?.code || "").toUpperCase().startsWith("TMP-")) && (stats?.extra_lines_count ?? 0) === 0;
              const totalExpected = (request.lines || []).reduce((s, l) => s + Number(l.qty_expected || 0), 0);
              const totalReceived = (request.lines || []).reduce((s, l) => s + Number(l.qty_received || 0), 0);
              const totalsMatch = totalExpected > 0 && Math.abs(totalReceived - totalExpected) / totalExpected < 0.05;
              const hasItemsReceived = (request.lines || []).some(l => Number(l.qty_received || 0) > 0);
              const acceptedAll = (request.lines || []).every(l => l.recon_accepted === true || Math.abs(Number(l.qty_received || 0) - Number(l.qty_expected || 0)) === 0);
              // UC-IN-04: thêm 2 check pallet status
              const palletsTotal = stats?.pallets.total ?? 0;
              const palletsConfirmed = (stats?.pallets.confirmed ?? 0) + (stats?.pallets.in_storage ?? 0) + (stats?.pallets.in_staging ?? 0);
              const palletsInStorage = stats?.pallets.in_storage ?? 0;
              const allPalletsConfirmed = palletsTotal > 0 && palletsConfirmed === palletsTotal;
              const allPalletsInStorage = palletsTotal > 0 && palletsInStorage === palletsTotal;

              const checks = [
                { ok: allLinesReconciled, label: "Tất cả dòng đã đối chiếu" },
                { ok: hasItemsReceived, label: "Đã có dòng nhận thực tế (qty > 0)" },
                { ok: noPendingTempCodes, label: `Mã tạm đã chuẩn hóa (không còn TMP-…)${(stats?.extra_lines_count ?? 0) > 0 ? ` — còn ${stats?.extra_lines_count} hàng phát sinh` : ""}` },
                { ok: acceptedAll, label: "Mọi chênh lệch đã xử lý" },
                { ok: totalsMatch, label: "Tổng SL khớp ±5%" },
                { ok: allPalletsConfirmed, label: `Tất cả pallet đã xác nhận (${palletsConfirmed}/${palletsTotal})` },
                { ok: allPalletsInStorage, label: `Tất cả pallet đã đưa vào vị trí (${palletsInStorage}/${palletsTotal})` },
              ];
              const passedCount = checks.filter(c => c.ok).length;
              const hasDiscrepancy = !acceptedAll || !totalsMatch;

              return (
                <div className="bg-white border-2 border-purple-300 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wider flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">checklist</span>
                      Điều kiện chốt phiếu ({passedCount}/{checks.length})
                    </h3>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${passedCount === checks.length ? "bg-emerald-100 text-emerald-700" : passedCount >= 5 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                      {passedCount === checks.length ? "Đủ điều kiện chốt" : passedCount >= 5 ? "Cần kiểm tra" : "Chưa đủ"}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {checks.map((c, i) => (
                      <li key={i} className={`flex items-center gap-2 text-sm ${c.ok ? "text-emerald-700" : "text-on-surface-variant"}`}>
                        <span className={`material-symbols-outlined text-[20px] ${c.ok ? "text-emerald-600" : "text-on-surface-variant/50"}`}>
                          {c.ok ? "check_circle" : "radio_button_unchecked"}
                        </span>
                        {c.label}
                      </li>
                    ))}
                  </ul>

                  {/* UC-IN-04: Ghi chú khi chốt (bắt buộc nếu có chênh lệch) */}
                  <div className="mt-4 pt-3 border-t border-outline-variant/50">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[14px]">edit_note</span>
                      Ghi chú khi chốt
                      {hasDiscrepancy && <span className="text-rose-600">* (bắt buộc khi có chênh lệch)</span>}
                    </label>
                    <textarea
                      value={closeNote}
                      onChange={(e) => setCloseNote(e.target.value)}
                      rows={2}
                      placeholder={hasDiscrepancy ? "VD: Chấp nhận chênh lệch theo biên bản số XXX/2026..." : "Tùy chọn — ghi chú nếu cần truy vết..."}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none ${
                        hasDiscrepancy && !closeNote.trim() ? "border-rose-300 bg-rose-50/30" : "border-outline-variant"
                      }`}
                    />
                  </div>

                  <div className="mt-3">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Xử lý chênh lệch</label>
                    <select
                      value={discrepancyDecision}
                      onChange={(e) => setDiscrepancyDecision(e.target.value as "ACCEPT" | "REVIEW_AGAIN" | "CREATE_ADJUSTMENT")}
                      className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    >
                      <option value="ACCEPT">✓ Chấp nhận chênh lệch</option>
                      <option value="REVIEW_AGAIN">↻ Yêu cầu kiểm lại</option>
                      <option value="CREATE_ADJUSTMENT">📝 Tạo phiếu điều chỉnh tồn (UC-INV-09)</option>
                    </select>
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* Completed Banner */}
        {isCompleted && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-[28px] text-emerald-600">verified</span>
            <div>
              <p className="text-sm font-semibold text-emerald-700">Phiếu nhập đã chốt thành công</p>
              <p className="text-xs text-emerald-600 mt-0.5">Hoàn tất lúc {formatDateTime(request.completed_at)}</p>
            </div>
          </div>
        )}

        {/* Receiving Progress Bar (only when RECEIVING) */}
        {isReceiving && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">inventory</span>
                Đang tiếp nhận hàng
              </span>
              <span className="text-sm font-bold text-blue-700 font-mono">
                {progress.done}/{progress.total} dòng ({progress.pct}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${progress.pct}%` }}
              ></div>
            </div>
            {progress.done === progress.total && progress.total > 0 && (
              <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Tất cả dòng đã nhập SL thực nhận — Có thể &quot;Hoàn tất tiếp nhận&quot;
              </p>
            )}
          </div>
        )}

        {/* Info Card */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Nhà cung cấp</span>
              <span className="text-sm text-on-surface font-medium">{request.supplier ? `${request.supplier.code} — ${request.supplier.name}` : "—"}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Số hoá đơn</span>
              {editing ? (
                <input
                  type="text"
                  value={editForm.invoice_no}
                  onChange={(e) => setEditForm({ ...editForm, invoice_no: e.target.value })}
                  placeholder="VD: 1C26TAA-0001234"
                  className="w-full px-2 py-1 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              ) : (
                <span className="text-sm text-on-surface font-medium">{request.invoice_no || "—"}</span>
              )}
            </div>
            <div>
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Ngày dự kiến</span>
              {editing ? (
                <input
                  type="date"
                  value={editForm.expected_date}
                  onChange={(e) => setEditForm({ ...editForm, expected_date: e.target.value })}
                  className="w-full px-2 py-1 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              ) : (
                <span className="text-sm text-on-surface">{formatDate(request.expected_date)}</span>
              )}
            </div>
            <div>
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Ngày tạo</span>
              <span className="text-sm text-on-surface">{formatDateTime(request.created_at)}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                {isReceiving || isReconciling || isCompleted ? "Bắt đầu nhận" : "Ghi chú"}
              </span>
              {isReceiving || isReconciling || isCompleted ? (
                <span className="text-sm text-on-surface">{formatDateTime(request.received_at)}</span>
              ) : editing ? (
                <textarea
                  rows={2}
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  className="w-full px-2 py-1 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              ) : (
                <span className="text-sm text-on-surface">{request.note || "—"}</span>
              )}
            </div>
          </div>
        </div>

        {/* Lines Table */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
            <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">list_alt</span>
              Dòng hàng ({request.lines?.length || 0})
            </h2>
            {isDraft && (
              <button
                onClick={() => setShowAddLine(!showAddLine)}
                className="px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 font-semibold flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">{showAddLine ? "close" : "add"}</span>
                {showAddLine ? "Đóng" : "Thêm dòng"}
              </button>
            )}
          </div>

          {/* Add line form */}
          {showAddLine && isDraft && (
            <div className="px-6 py-4 bg-primary/5 border-b border-outline-variant">
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
                <div className="sm:col-span-2 relative">
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Mã hàng</label>
                  <input
                    type="text"
                    value={newLineSearch}
                    onChange={(e) => handleNewLineSearchInput(e.target.value)}
                    onBlur={() => setTimeout(() => setShowNewLineDropdown(false), 200)}
                    placeholder="Tìm mã hàng..."
                    className={`w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      newLine.item_code_id ? "border-emerald-300 bg-emerald-50/30" : "border-outline-variant"
                    }`}
                  />
                  {newLine.item_name_display && (
                    <span className="text-xs text-emerald-600 mt-0.5 block">{newLine.item_name_display}</span>
                  )}
                  {showNewLineDropdown && newLineResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 bg-white border border-outline-variant rounded-lg shadow-lg mt-1 max-h-[200px] overflow-y-auto">
                      {newLineResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={() => selectNewLineItem(item)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-primary/5 flex items-center gap-2 border-b border-outline-variant/30 last:border-b-0"
                        >
                          <span className="font-mono font-bold text-primary text-xs">{item.code}</span>
                          <span className="text-on-surface-variant">{item.short_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">SL thùng</label>
                  <input
                    type="number"
                    min={1}
                    value={newLine.expected_qty}
                    onChange={(e) => setNewLine({ ...newLine, expected_qty: parseInt(e.target.value) || 1 })}
                    className="w-full px-2 py-1.5 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-center"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">Lô</label>
                  <input
                    type="text"
                    value={newLine.lot}
                    onChange={(e) => setNewLine({ ...newLine, lot: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1">HSD</label>
                  <input
                    type="date"
                    value={newLine.expiry_date}
                    onChange={(e) => setNewLine({ ...newLine, expiry_date: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <button
                    onClick={handleAddLine}
                    disabled={saving || !newLine.item_code_id}
                    className="w-full px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Thêm
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 800 }}>
              <thead>
                <tr className="bg-surface-low border-b border-outline-variant">
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant w-[50px]">STT</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Mã hàng</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tên hàng</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">SL dự kiến</th>
                  {(isReceiving || isReconciling || isCompleted) && (
                    <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-blue-600">SL thực nhận</th>
                  )}
                  {(isReconciling || isCompleted) && (
                    <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-purple-600">SL chấp nhận</th>
                  )}
                  {(isReceiving || isReconciling || isCompleted) && (
                    <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant" title="Số thùng đã xếp lên các pallet của phiếu">Đã lên pallet</th>
                  )}
                  {(isReceiving || isReconciling || isCompleted) && (
                    <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Chênh lệch</th>
                  )}
                  {/* UC-IN-03: cột Pallet (hiển thị mã pallet chứa hàng) — luôn hiển thị (Phase 1.2) */}
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden lg:table-cell">Pallet</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Lô</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">HSD</th>
                  {(isReceiving || isReconciling) && (
                    <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant w-[80px]"></th>
                  )}
                  {isDraft && (
                    <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant w-[50px]"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {(!request.lines || request.lines.length === 0) ? (
                  <tr><td colSpan={13} className="text-center py-10 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[36px] opacity-30">inventory_2</span>
                    <p className="mt-2 text-sm">Chưa có dòng hàng nào.</p>
                  </td></tr>
                ) : (
                  request.lines.map((line, idx) => {
                    const lineHasReceived = line.qty_received !== null && line.qty_received !== undefined;
                    const lineHasAccepted = line.qty_accepted !== null && line.qty_accepted !== undefined;
                    const isLineSaving = savingLineId === line.id;
                    const onPallet = qtyOnPalletForItem(line.item_code_id);
                    return (
                      <tr
                        key={line.id}
                        className={`border-b border-outline-variant/50 hover:bg-surface-low/50 transition-colors ${
                          isReceiving && !lineHasReceived ? "bg-amber-50/30" : ""
                        } ${
                          isReconciling && !lineHasAccepted ? "bg-purple-50/30" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-on-surface-variant font-mono text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-primary text-sm">{line.item_code?.code || "—"}</span>
                            {line.item_code?.code?.startsWith("TMP-") && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200" title="Mã tạm — cần chuẩn hóa">
                                TMP
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">{line.item_code?.short_name || "—"}</td>
                        <td className="px-4 py-3 font-semibold text-center">{line.qty_expected}</td>

                        {/* SL Thực nhận column */}
                        {(isReceiving || isReconciling || isCompleted) && (
                          <td className="px-4 py-3 text-center">
                            {isReceiving ? (
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={receivingQty[line.id] ?? (lineHasReceived ? String(line.qty_received) : "")}
                                  onChange={(e) => setReceivingQty({ ...receivingQty, [line.id]: e.target.value })}
                                  placeholder="0"
                                  className={`w-20 px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-center font-mono font-bold ${
                                    lineHasReceived
                                      ? "border-emerald-300 bg-emerald-50/30 text-emerald-700"
                                      : "border-amber-300 bg-amber-50/30 text-amber-700"
                                  }`}
                                />
                                {onPallet > 0 && Number(receivingQty[line.id] ?? line.qty_received ?? -1) !== onPallet && (
                                  <button
                                    type="button"
                                    onClick={() => fillFromPalletLine(line)}
                                    className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                                    title={`Điền ${onPallet} từ số đã lên pallet`}
                                  >
                                    <span className="material-symbols-outlined text-[12px]">move_down</span>
                                    Lấy {onPallet} từ pallet
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className={`font-mono font-bold ${
                                line.qty_received !== null ? "text-blue-700" : "text-on-surface-variant/70"
                              }`}>
                                {line.qty_received !== null ? line.qty_received : "—"}
                              </span>
                            )}
                          </td>
                        )}

                        {/* SL Chấp nhận column (Reconciling / Completed) */}
                        {(isReconciling || isCompleted) && (
                          <td className="px-4 py-3 text-center">
                            {isReconciling ? (
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={acceptedQty[line.id] ?? (lineHasAccepted ? String(line.qty_accepted) : "")}
                                onChange={(e) => setAcceptedQty({ ...acceptedQty, [line.id]: e.target.value })}
                                placeholder={lineHasReceived ? String(line.qty_received) : "0"}
                                className={`w-20 px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-center font-mono font-bold ${
                                  lineHasAccepted
                                    ? "border-emerald-300 bg-emerald-50/30 text-emerald-700"
                                    : "border-purple-300 bg-purple-50/30 text-purple-700"
                                }`}
                              />
                            ) : (
                              <span className={`font-mono font-bold ${
                                line.qty_accepted !== null ? "text-purple-700" : "text-on-surface-variant/70"
                              }`}>
                                {line.qty_accepted !== null ? line.qty_accepted : "—"}
                              </span>
                            )}
                          </td>
                        )}

                        {/* VĐ2: cột "Đã lên pallet" — số thùng đã xếp lên pallet của phiếu */}
                        {(isReceiving || isReconciling || isCompleted) && (
                          <td className="px-4 py-3 text-center">
                            {onPallet > 0 ? (
                              <span className="font-mono font-bold text-on-surface">{onPallet}</span>
                            ) : (
                              <span className="text-xs text-on-surface-variant/50">—</span>
                            )}
                          </td>
                        )}

                        {/* Chênh lệch column */}
                        {(isReceiving || isReconciling || isCompleted) && (
                          <td className="px-4 py-3 text-center">
                            {isReceiving ? (
                              getDiffBadge(
                                Number(line.qty_expected),
                                receivingQty[line.id] !== undefined && receivingQty[line.id] !== ""
                                  ? Number(receivingQty[line.id])
                                  : line.qty_received
                              )
                            ) : (
                              getDiffBadge(Number(line.qty_expected), line.qty_received)
                            )}
                          </td>
                        )}

                        {/* UC-IN-03: cell Pallet — luôn hiển thị (Phase 1.2) */}
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {palletsByItem[line.item_code_id]?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {palletsByItem[line.item_code_id].map((code) => (
                                <span key={code} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                  {code}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-amber-600 italic">Chưa có pallet</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-on-surface-variant">{line.lot || "—"}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-on-surface-variant">{formatDate(line.expiry_date)}</td>

                        {/* Save button per line (RECEIVING or RECONCILING) */}
                        {isReceiving && (
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleSaveLineReceive(line.id)}
                              disabled={isLineSaving || !receivingQty[line.id]}
                              className={`px-2 py-1 text-xs rounded-lg flex items-center gap-1 mx-auto transition-colors disabled:opacity-40 ${
                                lineHasReceived
                                  ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                  : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                              }`}
                              title={lineHasReceived ? "Cập nhật" : "Lưu"}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {isLineSaving ? "progress_activity" : lineHasReceived ? "check" : "save"}
                              </span>
                              {lineHasReceived ? "Đã lưu" : "Lưu"}
                            </button>
                          </td>
                        )}

                        {isReconciling && (
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleSaveLineAccept(line.id)}
                              disabled={isLineSaving || !acceptedQty[line.id]}
                              className={`px-2 py-1 text-xs rounded-lg flex items-center gap-1 mx-auto transition-colors disabled:opacity-40 ${
                                lineHasAccepted
                                  ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                  : "bg-purple-50 text-purple-600 hover:bg-purple-100"
                              }`}
                              title={lineHasAccepted ? "Cập nhật" : "Lưu"}
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {isLineSaving ? "progress_activity" : lineHasAccepted ? "check" : "save"}
                              </span>
                              {lineHasAccepted ? "Đã lưu" : "Lưu"}
                            </button>
                          </td>
                        )}

                        {/* Delete button (DRAFT) */}
                        {isDraft && (
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleRemoveLine(line.id)}
                              className="p-1 rounded-lg hover:bg-rose-50 text-on-surface-variant/70 hover:text-rose-600 transition-colors"
                              title="Xóa dòng"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Summary row for receiving */}
          {(isReceiving || isReconciling || isCompleted) && request.lines.length > 0 && (
            <div className="px-6 py-3 bg-surface-low border-t border-outline-variant flex flex-wrap items-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-on-surface-variant uppercase tracking-wider">Tổng dự kiến:</span>
                <span className="font-mono font-bold text-on-surface">
                  {request.lines.reduce((s, l) => s + Number(l.qty_expected), 0)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-500 uppercase tracking-wider">Tổng thực nhận:</span>
                <span className="font-mono font-bold text-blue-700">
                  {request.lines.reduce((s, l) => s + (l.qty_received !== null ? Number(l.qty_received) : 0), 0)}
                </span>
              </div>
              {(isReconciling || isCompleted) && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-purple-500 uppercase tracking-wider">Tổng chấp nhận:</span>
                  <span className="font-mono font-bold text-purple-700">
                    {request.lines.reduce((s, l) => s + (l.qty_accepted !== null ? Number(l.qty_accepted) : 0), 0)}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="font-bold text-on-surface-variant uppercase tracking-wider">Chênh lệch:</span>
                {(() => {
                  const totalExpected = request.lines.reduce((s, l) => s + Number(l.qty_expected), 0);
                  const totalReceived = request.lines.reduce((s, l) => s + (l.qty_received !== null ? Number(l.qty_received) : 0), 0);
                  const totalDiff = totalReceived - totalExpected;
                  return (
                    <span className={`font-mono font-bold ${totalDiff === 0 ? "text-emerald-600" : totalDiff > 0 ? "text-blue-600" : "text-rose-600"}`}>
                      {totalDiff > 0 ? `+${totalDiff}` : totalDiff}
                    </span>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Discrepancy notes (when receiving or later) */}
        {(isReconciling || isCompleted) && request.lines.some(l => l.discrepancy_note) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              Ghi chú chênh lệch
            </h3>
            <div className="space-y-2">
              {request.lines.filter(l => l.discrepancy_note).map((line) => (
                <div key={line.id} className="flex items-start gap-3 text-sm">
                  <span className="font-mono font-bold text-primary text-xs mt-0.5">{line.item_code?.code}</span>
                  <span className="text-amber-800">{line.discrepancy_note}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Note (shown when not editing for non-DRAFT states) */}
        {!isDraft && request.note && (
          <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-5">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Ghi chú phiếu</h3>
            <p className="text-sm text-on-surface">{request.note}</p>
          </div>
        )}

        {/* UC-INT-02: Ảnh đính kèm chứng từ */}
        <AttachmentPanel
          entityType="INBOUND"
          entityId={request.id}
          readOnly={isCompleted || isCancelled}
        />
      </div>
    </AppLayout>
  );
}
