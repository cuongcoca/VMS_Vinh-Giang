"use client";
import React, { useState, useEffect, use, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";

type ItemCodeOption = { id: string; code: string; short_name: string; full_name: string | null };
type ProductLite = { id: string; sku: string; name: string };
type Attachment = { id: string; file_url: string; file_name: string };
type TempLine = {
  id: string;
  qty_box: string;
  lot: string | null;
  expiry_date: string | null;
  note: string | null;
  item_code: ItemCodeOption & {
    product_id?: string | null;
    product?: ProductLite | null;
  };
};
type PalletLite = {
  id: string;
  code: string;
  status: string;
  total_lines: number;
  total_weight_kg: number;
  created_at: string;
};
type TempDetail = {
  id: string; code: string; status: string; note: string | null;
  supplier: { id: string; code: string; name: string } | null;
  source_type: string | null;
  delivered_by: string | null;
  received_at: string | null;
  reason: string | null;
  reason_detail: string | null;
  photo_urls?: string[];
  inbound_request_id: string | null;
  // Phase 4.2 — TC_STD_TMP_023 + _029 (mở lại sau phê duyệt)
  reject_reason?: string | null;
  rejected_at?: string | null;
  standardized_at?: string | null;
  standardizedTo?: { id: string; code: string; status: string } | null;
  lines: TempLine[]; created_at: string;
  pallets?: PalletLite[];
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  SUPPLIER: "🚚 Nhà cung cấp", RETURN: "↩️ Hàng trả lại", OTHER: "📦 Khác",
};

const REASON_LABELS: Record<string, string> = {
  EARLY: "Hàng về sớm hơn dự kiến",
  NOT_READY: "Phiếu nhập chưa chuẩn bị xong",
  UNNOTIFIED_RETURN: "Hàng trả lại — chưa thông báo trước",
  NEW_SUPPLIER: "NCC mới — chưa có trong hệ thống",
  OTHER: "Khác",
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Chờ chuẩn hóa", color: "bg-amber-50 text-amber-700" },
  STANDARDIZED: { label: "Đã chuẩn hóa", color: "bg-emerald-50 text-emerald-700" },
  REJECTED: { label: "Từ chối", color: "bg-rose-50 text-rose-600" },
};

export default function InboundAdhocDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [temp, setTemp] = useState<TempDetail | null>(null);
  // TC_TMP_IN_010: ảnh upload từ mobile lưu ở bảng Attachment (không phải photo_urls)
  // → kế toán phải fetch riêng mới thấy ảnh thủ kho đính kèm.
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Add line form
  const [itemSearch, setItemSearch] = useState("");
  const [itemOptions, setItemOptions] = useState<ItemCodeOption[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemCodeOption | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [qtyBox, setQtyBox] = useState("");
  const [lot, setLot] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [lineNote, setLineNote] = useState("");

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Phase 4.2 — TC_STD_TMP_001/_006: Tạo NCC mới từ phiếu này
  const [showCreateSupplierModal, setShowCreateSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    code: "", name: "", tax_code: "", contact_person: "", phone: "", email: "", address: "",
  });
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  // Phase 4.2 — TC_STD_TMP_003: chọn link với phiếu YC nhập đang mở
  const [showLinkInboundModal, setShowLinkInboundModal] = useState(false);
  const [openInbounds, setOpenInbounds] = useState<Array<{ id: string; code: string; status: string; supplier: { name: string } | null }>>([]);
  const [linkTargetId, setLinkTargetId] = useState("");

  // Standardize result
  const [newInboundId, setNewInboundId] = useState<string | null>(null);
  const [newInboundCode, setNewInboundCode] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const showToastMsg = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const [res, attRes] = await Promise.all([
        fetch(`/wms/api/inbound-temp/${id}`).then((r) => r.json()),
        fetch(`/wms/api/attachments?entity_type=inbound_temp&entity_id=${id}`).then((r) => r.json()),
      ]);
      if (res.success) setTemp(res.data);
      if (attRes.success) setAttachments(attRes.data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchDetail(); }, [id]);

  const searchItems = async (q: string) => {
    if (q.length < 1) { setItemOptions([]); return; }
    try {
      const res = await fetch(`/wms/api/item-codes?q=${encodeURIComponent(q)}`);
      const result = await res.json();
      if (result.success) setItemOptions(result.data);
    } catch (err) { console.error(err); }
  };

  const handleItemSearch = (value: string) => {
    setItemSearch(value);
    setShowSearch(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchItems(value), 300);
  };

  const handleSelectItem = (item: ItemCodeOption) => {
    setSelectedItem(item);
    setItemSearch("");
    setShowSearch(false);
    setItemOptions([]);
  };

  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) { alert("Vui lòng chọn mã hàng."); return; }
    if (!qtyBox || Number(qtyBox) <= 0) { alert("SL thùng phải > 0."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/wms/api/inbound-temp/${id}/lines`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_code_id: selectedItem.id, qty_box: Number(qtyBox), lot: lot || null, expiry_date: expiryDate || null, note: lineNote || null }),
      });
      const result = await res.json();
      if (result.success) {
        setSelectedItem(null); setQtyBox(""); setLot(""); setExpiryDate(""); setLineNote("");
        showToastMsg("Đã thêm dòng hàng!");
        fetchDetail();
      } else alert(result.error);
    } catch (err) { console.error(err); alert("Lỗi kết nối."); } finally { setSaving(false); }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!confirm("Xóa dòng hàng này?")) return;
    try {
      const res = await fetch(`/wms/api/inbound-temp/${id}/lines`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_id: lineId }),
      });
      const result = await res.json();
      if (result.success) fetchDetail(); else alert(result.error);
    } catch (err) { console.error(err); }
  };

  const handleStandardize = async () => {
    if (!temp) return;
    if (!confirm(`Chuẩn hóa "${temp.code}" thành phiếu nhập chính thức?\n\nPhiếu tạm sẽ chuyển trạng thái "Đã chuẩn hóa".`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/wms/api/inbound-temp/${id}/standardize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "create" }),
      });
      const result = await res.json();
      if (result.success) {
        setNewInboundId(result.data.id);
        setNewInboundCode(result.data.code);
        showToastMsg(`🎉 Đã tạo phiếu nhập ${result.data.code}!`);
        fetchDetail();
      } else alert(result.error);
    } catch (err) { console.error(err); alert("Lỗi kết nối."); } finally { setSaving(false); }
  };

  // Phase 4.2 — TC_STD_TMP_003: chuẩn hóa bằng cách LINK với phiếu YC nhập sẵn có
  const handleStandardizeLink = async () => {
    if (!linkTargetId) { alert("Vui lòng chọn phiếu YC nhập để liên kết."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/wms/api/inbound-temp/${id}/standardize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "link", inbound_request_id: linkTargetId }),
      });
      const result = await res.json();
      if (result.success) {
        setNewInboundId(result.data.id);
        setNewInboundCode(result.data.code);
        showToastMsg(`🔗 Đã liên kết phiếu tạm với ${result.data.code}!`);
        setShowLinkInboundModal(false);
        setLinkTargetId("");
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

  const openLinkInboundModal = async () => {
    setShowLinkInboundModal(true);
    setLinkTargetId("");
    try {
      const res = await fetch(`/wms/api/inbound?has_pallet=false`);
      const result = await res.json();
      if (result.success) {
        const open = (result.data as Array<{ id: string; code: string; status: string; supplier: { name: string } | null }>).filter(
          (i) => ["DRAFT", "PENDING", "RECEIVING", "RECONCILING"].includes(i.status)
        );
        setOpenInbounds(open);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Phase 4.2 — TC_STD_TMP_001/_006: tạo NCC mới từ phiếu này + auto link
  const handleCreateSupplier = async () => {
    if (creatingSupplier) return;
    const code = newSupplier.code.trim();
    const name = newSupplier.name.trim();
    if (!code || code.length < 2) { alert("Mã NCC phải từ 2 ký tự."); return; }
    if (!name) { alert("Tên NCC là bắt buộc."); return; }
    setCreatingSupplier(true);
    try {
      const res = await fetch(`/wms/api/inbound-temp/${id}/create-supplier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSupplier),
      });
      const result = await res.json();
      if (result.success) {
        showToastMsg(result.message || "Đã tạo NCC.");
        setShowCreateSupplierModal(false);
        setNewSupplier({ code: "", name: "", tax_code: "", contact_person: "", phone: "", email: "", address: "" });
        fetchDetail();
      } else {
        alert(result.error || "Lỗi tạo NCC.");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối khi tạo NCC.");
    } finally {
      setCreatingSupplier(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      const res = await fetch(`/wms/api/inbound-temp/${id}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const result = await res.json();
      if (result.success) { setShowRejectModal(false); setRejectReason(""); showToastMsg("Đã từ chối phiếu."); fetchDetail(); }
      else alert(result.error);
    } catch (err) { console.error(err); } finally { setRejecting(false); }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("vi-VN") : "—";

  if (loading) return <AppLayout title="TỒN TẠM"><div className="flex items-center justify-center h-[60vh]"><span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span></div></AppLayout>;
  if (!temp) return <AppLayout title="TỒN TẠM"><div className="flex flex-col items-center justify-center h-[60vh] gap-3"><span className="material-symbols-outlined text-[48px] text-rose-300">error</span><p>Không tìm thấy phiếu.</p><Link href="/inbound-adhoc" className="text-primary hover:underline text-sm">← Quay lại</Link></div></AppLayout>;

  const st = STATUS_MAP[temp.status] || { label: temp.status, color: "bg-surface-low text-on-surface-variant" };
  const isPending = temp.status === "PENDING";
  const isStandardized = temp.status === "STANDARDIZED";
  const isRejected = temp.status === "REJECTED";

  return (
    <AppLayout title={`Phiếu tạm ${temp.code}`}>
      <div className="p-6 space-y-5 min-w-0 overflow-hidden">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 animate-slide-in ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
            <span className="material-symbols-outlined text-[18px]">{toast.type === "success" ? "check_circle" : "error"}</span>
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div>
          <div className="mb-2"><BackButton fallback="/inbound-adhoc">Quay lại danh sách</BackButton></div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold font-mono text-primary">{temp.code}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${st.color}`}>{st.label}</span>
                {temp.supplier && <span className="text-sm text-on-surface-variant">NCC: <strong>{temp.supplier.name}</strong></span>}
                <span className="text-sm text-on-surface-variant">Tạo: {formatDate(temp.created_at)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Phase 4.2 — TC_STD_TMP_003: 2 lựa chọn — tạo mới (hồi tố)
                  hoặc liên kết với phiếu YC nhập đang mở. */}
              {isPending && temp.lines.length > 0 && (
                <>
                  <button onClick={handleStandardize} disabled={saving}
                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 shadow-sm transition-colors"
                    title="Tạo phiếu nhập chính thức mới từ phiếu tạm này (hồi tố)">
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    Tạo phiếu nhập mới
                  </button>
                  <button onClick={openLinkInboundModal} disabled={saving}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 shadow-sm transition-colors"
                    title="Liên kết phiếu tạm với phiếu YC nhập đã có sẵn (append dòng hàng)">
                    <span className="material-symbols-outlined text-[18px]">link</span>
                    Liên kết phiếu có sẵn
                  </button>
                  <button onClick={() => setShowRejectModal(true)}
                    className="px-4 py-2.5 border border-rose-300 text-rose-600 rounded-lg text-sm font-semibold hover:bg-rose-50 flex items-center gap-2 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">cancel</span> Từ chối
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Phase 4.2 — TC_STD_TMP_023: hiển thị lý do từ chối khi REJECTED */}
        {isRejected && temp.reject_reason && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              Lý do từ chối phiếu
            </h3>
            <p className="text-sm text-rose-800">{temp.reject_reason}</p>
            {temp.rejected_at && (
              <p className="text-xs text-rose-600 mt-1">
                Từ chối lúc: {new Date(temp.rejected_at).toLocaleString("vi-VN")}
              </p>
            )}
          </div>
        )}

        {/* Phase 4.2 — TC_STD_TMP_001/_006/_007: chưa có NCC → cho tạo nhanh */}
        {isPending && !temp.supplier && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-600">warning</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Phiếu chưa có Nhà cung cấp</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Bạn cần liên kết NCC trước khi chuẩn hóa thành phiếu nhập chính thức.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateSupplierModal(true)}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 flex items-center gap-1.5 shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">add_business</span>
              Tạo NCC mới từ phiếu này
            </button>
          </div>
        )}

        {/* UC-INTMP-02: 3-step wizard stepper + counter tiến độ chuẩn hóa */}
        {!isRejected && (() => {
          const step1Done = !!(temp.supplier || temp.source_type || temp.delivered_by);
          const totalLines = temp.lines.length;
          const standardizedLines = temp.lines.filter((l) => !!l.item_code.product_id).length;
          const step2Done = totalLines > 0 && standardizedLines === totalLines;
          const step3Done = isStandardized;
          const currentStep = step3Done ? 3 : step2Done ? 3 : step1Done ? 2 : 1;
          const steps = [
            { n: 1, label: "Kiểm nguồn", icon: "verified_user", done: step1Done, sub: "" },
            {
              n: 2,
              label: "Chuẩn hóa mã",
              icon: "tune",
              done: step2Done,
              sub: totalLines > 0 ? ` (${standardizedLines}/${totalLines})` : "",
            },
            { n: 3, label: "Tạo phiếu chính", icon: "task_alt", done: step3Done, sub: "" },
          ];
          return (
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
              <div className="flex items-center gap-2 flex-wrap">
                {steps.map((s, i) => (
                  <React.Fragment key={s.n}>
                    {i > 0 && <div className={`flex-1 h-0.5 min-w-[20px] ${currentStep > i ? "bg-primary" : "bg-surface-mid"}`} />}
                    <div className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold ${
                      s.done ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : currentStep === s.n ? "bg-primary text-white shadow-sm"
                      : "bg-surface-low text-on-surface-variant"}`}>
                      <span className="material-symbols-outlined text-[16px]">{s.done ? "check_circle" : s.icon}</span>
                      Bước {s.n} · {s.label}{s.sub}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Step 1: Kiểm nguồn (Source info read-only) */}
        {!isRejected && (temp.source_type || temp.delivered_by || temp.received_at || temp.reason) && (
          <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-5">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
              Bước 1 — Kiểm nguồn hàng
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {temp.source_type && <div><span className="text-xs font-semibold text-on-surface-variant block mb-0.5">Nguồn hàng</span><span className="font-medium">{SOURCE_TYPE_LABELS[temp.source_type] || temp.source_type}</span></div>}
              {temp.delivered_by && <div><span className="text-xs font-semibold text-on-surface-variant block mb-0.5">Người giao</span><span className="font-medium">{temp.delivered_by}</span></div>}
              {temp.received_at && <div><span className="text-xs font-semibold text-on-surface-variant block mb-0.5">Ngày giờ nhận</span><span className="font-medium">{new Date(temp.received_at).toLocaleString("vi-VN")}</span></div>}
              {temp.reason && <div className="md:col-span-2"><span className="text-xs font-semibold text-on-surface-variant block mb-0.5">Lý do nhập tạm</span><span className="font-medium">{REASON_LABELS[temp.reason] || temp.reason}</span>{temp.reason_detail && <span className="text-xs text-on-surface-variant italic ml-2">— {temp.reason_detail}</span>}</div>}
              {(() => {
                // Gộp ảnh từ Attachment (upload mobile) + photo_urls (legacy).
                // file_url dạng "/api/uploads/..." cần prefix base path "/wms" để serve đúng.
                const attUrls = attachments.map((a) =>
                  a.file_url.startsWith("http") || a.file_url.startsWith("/wms") ? a.file_url : `/wms${a.file_url}`
                );
                const photos = [...attUrls, ...(temp.photo_urls ?? [])];
                if (photos.length === 0) return null;
                return (
                  <div className="md:col-span-3">
                    <span className="text-xs font-semibold text-on-surface-variant block mb-1">Ảnh chứng từ ({photos.length})</span>
                    <div className="flex flex-wrap gap-2">
                      {photos.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener" className="block w-16 h-16 rounded-lg overflow-hidden border border-outline-variant hover:ring-2 hover:ring-primary/30 bg-surface-low">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Ảnh ${i + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Section Pallet thực tế của phiếu tạm */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-5">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            Danh sách Pallet thực tế ({temp.pallets?.length || 0})
          </h3>
          {temp.pallets && temp.pallets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {temp.pallets.map((p) => (
                <Link
                  key={p.id}
                  href={`/pallets/${p.id}`}
                  className="p-4 rounded-xl border border-outline-variant hover:border-primary hover:bg-surface-low transition-all flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="font-mono font-bold text-primary text-sm flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-amber-500">inventory_2</span>
                      {p.code}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      p.status === "DRAFT" ? "bg-surface-mid text-on-surface-variant"
                      : p.status === "RECEIVING" ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}>
                      {p.status === "DRAFT" ? "Nháp" :
                       p.status === "RECEIVING" ? "Đang thêm hàng" :
                       p.status === "COMPLETED" ? "Đã xong" : p.status}
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-on-surface-variant space-y-1">
                    <p>Số dòng hàng: <strong>{p.total_lines}</strong></p>
                    <p>Tổng trọng lượng: <strong>{p.total_weight_kg || 0} kg</strong></p>
                    <p className="text-[10px] text-on-surface-variant/80">
                      Tạo lúc: {new Date(p.created_at).toLocaleString("vi-VN")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-on-surface-variant text-sm bg-surface-low/50 rounded-xl border border-dashed border-outline-variant">
              <span className="material-symbols-outlined text-[36px] opacity-30 block">inventory_2</span>
              Không có pallet thực tế nào được liên kết với phiếu tạm này.
            </div>
          )}
        </div>

        {/* Banners — Phase 4.2 TC_STD_TMP_029: hiển thị code phiếu PHN từ
            relation standardizedTo khi reload (newInboundCode chỉ có lúc
            mới chuẩn hóa trong session). */}
        {isStandardized && (() => {
          const inboundCode = newInboundCode || temp.standardizedTo?.code || "";
          const inboundId = newInboundId || temp.standardizedTo?.id || temp.inbound_request_id;
          return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-[28px] text-emerald-600">verified</span>
              <div>
                <p className="text-sm font-semibold text-emerald-700">
                  Bước 3 hoàn tất — Đã tạo phiếu nhập chính thức
                </p>
                {inboundId && (
                  <Link
                    href={`/inbound/${inboundId}`}
                    className="text-xs text-emerald-600 hover:underline mt-0.5 inline-flex items-center gap-1 font-mono"
                  >
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    Xem phiếu nhập {inboundCode || "(chưa có mã)"}
                  </Link>
                )}
              </div>
            </div>
          );
        })()}
        {isRejected && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-[28px] text-rose-400">block</span>
            <p className="text-sm font-semibold text-rose-700">Phiếu tạm đã bị từ chối</p>
          </div>
        )}

        {/* Note */}
        {temp.note && (
          <div className="bg-surface-low border border-outline-variant rounded-xl p-4 text-sm text-on-surface">
            <span className="font-bold text-on-surface-variant">Ghi chú:</span> {temp.note}
          </div>
        )}

        {/* Add line form (Bước 2 — Chuẩn hóa mã) */}
        {isPending && (
          <div className="bg-white rounded-xl border border-outline-variant p-5 shadow-sm">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">tune</span> Bước 2 — Chuẩn hóa mã hàng <span className="text-on-surface-variant/70 normal-case font-normal text-xs">(thêm/sửa dòng hàng)</span>
            </h2>
            <form onSubmit={handleAddLine} className="space-y-4">
              <div className="relative">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Mã hàng <span className="text-rose-500">*</span></label>
                {selectedItem ? (
                  <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div><span className="font-mono font-bold text-primary">{selectedItem.code}</span><span className="text-sm text-on-surface-variant ml-2">{selectedItem.short_name}</span></div>
                    <button type="button" onClick={() => setSelectedItem(null)} className="p-1 hover:bg-primary/10 rounded"><span className="material-symbols-outlined text-[18px] text-on-surface-variant/70">close</span></button>
                  </div>
                ) : (
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
                    <input type="text" placeholder="Tìm mã hàng..." value={itemSearch} onChange={e => handleItemSearch(e.target.value)} onFocus={() => setShowSearch(true)}
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
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">SL thùng <span className="text-rose-500">*</span></label>
                  <input type="number" step="0.01" min="0.01" value={qtyBox} onChange={e => setQtyBox(e.target.value)} placeholder="VD: 10" required
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Lô</label>
                  <input type="text" value={lot} onChange={e => setLot(e.target.value)} placeholder="VD: LOT2026A"
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">HSD</label>
                  <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Ghi chú</label>
                  <input type="text" value={lineNote} onChange={e => setLineNote(e.target.value)} placeholder="..."
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
              <button type="submit" disabled={saving || !selectedItem}
                className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover flex items-center gap-2 disabled:opacity-50 transition-colors">
                <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "add"}</span> Thêm vào phiếu
              </button>
            </form>
          </div>
        )}

        {/* Lines table */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">inventory_2</span> Dòng hàng ({temp.lines.length})
            </h3>
            {isPending && temp.lines.length > 0 && (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                Bước 3: &quot;Tạo phiếu nhập mới&quot; hoặc &quot;Liên kết phiếu có sẵn&quot;
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 600 }}>
              <thead>
                <tr className="bg-surface-low/50 border-b border-outline-variant">
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">#</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Mã hàng (chứng từ)</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tên</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">SL Thùng</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Lô</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">HSD</th>
                  {/* UC-INTMP-02: cột Mã chuẩn */}
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Mã chuẩn (SKU)</th>
                  {/* Phase 4.2 — TC_STD_TMP_002: cột Hành động (chỉ khi PENDING) */}
                  {isPending && <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Hành động</th>}
                </tr>
              </thead>
              <tbody>
                {temp.lines.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[36px] opacity-30">inventory_2</span>
                    <p className="mt-2 text-sm">Chưa có dòng hàng nào.</p>
                  </td></tr>
                ) : temp.lines.map((line, idx) => {
                  const product = line.item_code.product;
                  return (
                    <tr key={line.id} className="border-b border-outline-variant/40 hover:bg-surface-low/50 transition-colors">
                      <td className="px-4 py-2.5 text-on-surface-variant/70 text-xs">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-primary text-xs">{line.item_code.code}</td>
                      <td className="px-4 py-2.5 text-sm">
                        {line.item_code.short_name}
                        {/* TC_STD_TMP_002 / TC_TMP_IN_012 / _022: hiển thị ghi chú dòng hàng (trước đây bị ẩn). */}
                        {line.note && (
                          <span className="block text-[11px] text-on-surface-variant italic mt-0.5">
                            Ghi chú: {line.note}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">{Number(line.qty_box)}</td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-on-surface-variant text-xs">{line.lot || "—"}</td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-on-surface-variant text-xs">{formatDate(line.expiry_date)}</td>
                      {/* UC-INTMP-02 — Phase 4.2 row 55: khi đã chuẩn hóa, badge
                          KHÔNG còn là link (giữ nguyên màn hình). Chỉ link đến
                          item-codes khi cần đi chuẩn hóa.  */}
                      <td className="px-4 py-2.5">
                        {product ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"
                            title={product.name}
                          >
                            <span className="material-symbols-outlined text-[12px]">verified</span>
                            {product.sku}
                          </span>
                        ) : isPending ? (
                          <Link
                            href={`/item-codes?q=${encodeURIComponent(line.item_code.code)}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full hover:bg-amber-100"
                          >
                            ⚠ Chuẩn hóa →
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant bg-surface-low border border-outline-variant px-2 py-0.5 rounded-full">
                            ⚠ Chưa chuẩn hóa
                          </span>
                        )}
                      </td>
                      {/* Phase 4.2 — TC_STD_TMP_002: cột Hành động với 3 lựa chọn */}
                      {isPending && (
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            {!product && (
                              <Link
                                href={`/item-codes?q=${encodeURIComponent(line.item_code.code)}`}
                                className="p-1 rounded-lg hover:bg-amber-50 text-on-surface-variant hover:text-amber-700 transition-colors"
                                title="Đi chuẩn hóa mã hàng này (sang trang Mã hàng)"
                              >
                                <span className="material-symbols-outlined text-[16px]">tune</span>
                              </Link>
                            )}
                            {product && (
                              <Link
                                href={`/master-data?sku=${encodeURIComponent(product.sku)}`}
                                className="p-1 rounded-lg hover:bg-emerald-50 text-on-surface-variant hover:text-emerald-700 transition-colors"
                                title={`Xem sản phẩm ${product.sku}`}
                              >
                                <span className="material-symbols-outlined text-[16px]">visibility</span>
                              </Link>
                            )}
                            <button
                              onClick={() => handleDeleteLine(line.id)}
                              className="p-1 rounded-lg hover:bg-rose-50 text-on-surface-variant hover:text-rose-600 transition-colors"
                              title="Xóa dòng hàng khỏi phiếu tạm"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-outline-variant">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-500">cancel</span> Từ chối phiếu tạm
              </h3>
            </div>
            <div className="p-6">
              {/* Phase 4.2 — TC_STD_TMP_023: lý do từ chối ≥ 5 ký tự, hiển thị counter */}
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">
                Lý do <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do từ chối (tối thiểu 5 ký tự)..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                autoFocus
              />
              <p className={`text-[11px] mt-1 ${rejectReason.trim().length >= 5 ? "text-emerald-700" : "text-amber-700"}`}>
                {rejectReason.trim().length}/5 ký tự tối thiểu
              </p>
            </div>
            <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-low rounded-lg">Hủy</button>
              <button
                onClick={handleReject}
                disabled={rejecting || rejectReason.trim().length < 5}
                className="px-5 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">{rejecting ? "progress_activity" : "cancel"}</span> Từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 4.2 — TC_STD_TMP_003: Modal chọn phiếu YC nhập để liên kết */}
      {showLinkInboundModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowLinkInboundModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-outline-variant">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600">link</span>
                Liên kết với phiếu YC nhập sẵn có
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Chọn phiếu YC nhập đang mở (DRAFT / PENDING / RECEIVING / RECONCILING).
                Dòng hàng từ phiếu tạm {temp.code} sẽ được append vào phiếu được chọn.
              </p>
            </div>
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {openInbounds.length === 0 ? (
                <div className="text-center py-6 text-on-surface-variant text-sm">
                  <span className="material-symbols-outlined text-[36px] opacity-30 block">inbox</span>
                  Không có phiếu YC nhập đang mở nào. Hãy dùng &quot;Tạo phiếu nhập mới&quot;.
                </div>
              ) : (
                <div className="space-y-2">
                  {openInbounds.map((ir) => (
                    <label
                      key={ir.id}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        linkTargetId === ir.id
                          ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                          : "border-outline-variant hover:bg-surface-low"
                      }`}
                    >
                      <input
                        type="radio"
                        name="link-target"
                        value={ir.id}
                        checked={linkTargetId === ir.id}
                        onChange={(e) => setLinkTargetId(e.target.value)}
                        className="mt-1 w-4 h-4 accent-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm">{ir.code}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-low">
                            {ir.status}
                          </span>
                        </div>
                        {ir.supplier?.name && (
                          <p className="text-xs text-on-surface-variant mt-0.5">NCC: {ir.supplier.name}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3">
              <button
                onClick={() => setShowLinkInboundModal(false)}
                className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-low rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleStandardizeLink}
                disabled={saving || !linkTargetId}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {saving ? "progress_activity" : "link"}
                </span>
                Liên kết & Append {temp.lines.length} dòng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 4.2 — TC_STD_TMP_001/_006: Modal tạo NCC mới từ phiếu này */}
      {showCreateSupplierModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateSupplierModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-outline-variant">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">add_business</span>
                Tạo NCC mới từ phiếu {temp.code}
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                NCC sẽ tự động được liên kết vào phiếu sau khi tạo.
              </p>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  Mã NCC <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSupplier.code}
                  onChange={(e) => setNewSupplier({ ...newSupplier, code: e.target.value })}
                  placeholder="VD: NCC-VG-001"
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  Tên NCC <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  placeholder="VD: Công ty TNHH ABC"
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">MST</label>
                <input
                  type="text"
                  value={newSupplier.tax_code}
                  onChange={(e) => setNewSupplier({ ...newSupplier, tax_code: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Người liên hệ</label>
                <input
                  type="text"
                  value={newSupplier.contact_person}
                  onChange={(e) => setNewSupplier({ ...newSupplier, contact_person: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">SĐT</label>
                <input
                  type="tel"
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  placeholder="VD: 0901234567"
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Email</label>
                <input
                  type="email"
                  value={newSupplier.email}
                  onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Địa chỉ</label>
                <textarea
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-3">
              <button
                onClick={() => setShowCreateSupplierModal(false)}
                className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-low rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateSupplier}
                disabled={creatingSupplier}
                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {creatingSupplier ? "progress_activity" : "save"}
                </span>
                Tạo & Liên kết NCC
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
