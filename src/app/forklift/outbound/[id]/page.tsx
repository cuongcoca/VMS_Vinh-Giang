"use client";
import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { useConfirm } from "@/components/ui";

type SuggestedPallet = {
  pallet_id: string;
  pallet_code: string;
  location_code: string;
  qty_to_pick: number;
  qty_available: number;
  lot: string | null;
  expiry_date: string | null;
  item_code_id: string;
  item_code: string;
  item_name: string;
  mode: "FULL" | "PARTIAL";
  status: "PENDING" | "COMPLETED";
  pallet_line_id: string;
};

type OutboundRequestDetail = {
  id: string;
  code: string;
  status: string;
  customer: string | null;
  ship_date: string | null;
  note: string | null;
  suggested_pallets: SuggestedPallet[];
};

export default function ForkliftOutboundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { confirm } = useConfirm();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [data, setData] = useState<OutboundRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Partial extract modal state
  const [partialModal, setPartialModal] = useState<{
    pallet: SuggestedPallet;
    qty: number;
  } | null>(null);

  // RC7: vị trí khu chờ xuất (OUTBOUND_STAGING) — BẮT BUỘC khi chuyển pallet ra staging
  const [stagingLocations, setStagingLocations] = useState<{ id: string; code: string }[]>([]);
  const [stagingLocationId, setStagingLocationId] = useState<string>("");

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${basePath}/api/outbound/requests/${id}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (err) {
      console.error("Lỗi khi tải chi tiết phiếu xuất:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStagingLocations = async () => {
    try {
      const res = await fetch(`${basePath}/api/locations?type=OUTBOUND_STAGING&active=true`);
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        const locs = result.data.map((l: { id: string; code: string }) => ({ id: l.id, code: l.code }));
        setStagingLocations(locs);
        if (locs.length > 0) setStagingLocationId((prev) => prev || locs[0].id);
      }
    } catch (err) {
      console.error("Lỗi khi tải vị trí khu chờ xuất:", err);
    }
  };

  useEffect(() => {
    fetchDetail();
    fetchStagingLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleStageOut = async (pallet: SuggestedPallet, qty?: number) => {
    if (!stagingLocationId) {
      showToast("Chưa chọn vị trí khu chờ xuất. Vui lòng chọn vị trí trước khi chuyển pallet.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        pallet_id: pallet.pallet_id,
        pallet_line_id: pallet.pallet_line_id,
        mode: pallet.mode,
        partial_qty: qty || pallet.qty_to_pick,
        staging_location_id: stagingLocationId,
      };

      const res = await fetch(`${basePath}/api/forklift/stage-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success) {
        showToast(
          result.message || `Đã chuyển pallet ${pallet.pallet_code} ra khu chờ xuất.`,
          "success"
        );
        setPartialModal(null);
        fetchDetail();
      } else {
        showToast(result.error || "Gặp lỗi khi di chuyển pallet.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Lỗi kết nối máy chủ.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-margin-mobile py-md text-center">
        <BackButton fallback="/forklift">Quay lại</BackButton>
        <p className="text-on-surface-variant mt-10">Không tìm thấy phiếu yêu cầu xuất.</p>
      </div>
    );
  }

  const pendingPallets = data.suggested_pallets.filter((p) => p.status === "PENDING");
  const completedPallets = data.suggested_pallets.filter((p) => p.status === "COMPLETED");

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("vi-VN");
  };

  return (
    <div className="px-margin-mobile py-md space-y-4">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 animate-fade-in ${
            toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.message}
        </div>
      )}

      <BackButton fallback="/forklift">Quay lại hàng đợi</BackButton>

      {/* Header Info */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 text-white p-5 rounded-2xl shadow-md space-y-2">
        <div className="flex justify-between items-start">
          <span className="font-mono text-lg font-bold">{data.code}</span>
          <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-bold">
            {data.status === "SHIPPED" ? "Đã xuất kho" : data.status === "PENDING" ? "Chờ lấy hàng" : data.status === "CANCELLED" ? "Đã hủy" : "Đang lấy hàng"}
          </span>
        </div>
        <div className="text-sm">
          <p>Khách hàng: <b>{data.customer || "Vãng lai"}</b></p>
          {data.ship_date && <p>Hạn giao: <b>{formatDate(data.ship_date)}</b></p>}
        </div>
        {data.note && (
          <p className="text-xs bg-black/10 p-2 rounded-lg italic">
            Ghi chú: {data.note}
          </p>
        )}
      </div>

      {/* Task Summary Banner */}
      <div className="bg-white rounded-xl border border-outline-variant p-4 flex justify-between items-center text-xs text-on-surface-variant">
        <span>Tiến độ di chuyển:</span>
        <strong className="text-primary font-mono text-sm">
          {completedPallets.length} / {data.suggested_pallets.length} pallet
        </strong>
      </div>

      {/* RC7: Vị trí khu chờ xuất — BẮT BUỘC để chuyển pallet ra staging */}
      <div className="bg-white rounded-xl border border-outline-variant p-4">
        <label className="block text-xs font-bold uppercase text-on-surface-variant tracking-wider mb-2">
          Vị trí khu chờ xuất
        </label>
        {stagingLocations.length === 0 ? (
          <p className="text-sm text-rose-600 font-semibold">
            ⚠️ Chưa có vị trí khu chờ xuất (OUTBOUND_STAGING). Liên hệ quản lý để tạo vị trí trước khi chuyển hàng.
          </p>
        ) : stagingLocations.length === 1 ? (
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
            <span className="material-symbols-outlined text-[18px] text-blue-700">place</span>
            <span className="text-sm font-bold text-blue-800 font-mono">{stagingLocations[0].code}</span>
          </div>
        ) : (
          <select
            value={stagingLocationId}
            onChange={(e) => setStagingLocationId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-outline-variant text-sm font-mono bg-white"
          >
            {stagingLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.code}</option>
            ))}
          </select>
        )}
      </div>

      {/* PENDING TASKS CHECKLIST */}
      <div className="space-y-3">
        <h3 className="font-bold text-xs uppercase text-on-surface-variant tracking-wider flex items-center gap-1.5 pl-1">
          <span className="material-symbols-outlined text-amber-500 text-[18px]">
            pending_actions
          </span>
          Pallet cần di chuyển ({pendingPallets.length})
        </h3>

        {pendingPallets.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-5 rounded-2xl text-center space-y-2">
            <span className="material-symbols-outlined text-[40px] text-emerald-600">
              check_circle
            </span>
            <p className="text-sm font-semibold">Tất cả hàng đã được chuyển ra khu Staging!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingPallets.map((p, idx) => {
              const isPartial = p.mode === "PARTIAL";
              return (
                <div
                  key={`${p.pallet_id}-${idx}`}
                  className="industrial-card p-4 rounded-xl bg-white border border-outline-variant flex flex-col gap-2 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>

                  <div className="flex justify-between items-start pl-1.5">
                    <div>
                      <span className="font-mono font-bold text-sm text-primary">
                        {p.pallet_code}
                      </span>
                      <span className="ml-2 bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[11px] font-bold">
                        Vị trí: {p.location_code}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isPartial ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {isPartial ? "Rút một phần" : "Rút nguyên"}
                    </span>
                  </div>

                  <div className="pl-1.5 space-y-1 text-xs">
                    <p className="font-bold text-on-surface">
                      SKU: <span className="font-mono">{p.item_code}</span> - {p.item_name}
                    </p>
                    <div className="grid grid-cols-2 text-on-surface-variant">
                      <p>
                        Lượng lấy: <b>{p.qty_to_pick}</b> thùng
                      </p>
                      <p>
                        Tồn pallet: <b>{p.qty_available}</b> thùng
                      </p>
                      {p.lot && <p>Số lô: <b>{p.lot}</b></p>}
                      {p.expiry_date && <p>HSD: <b>{formatDate(p.expiry_date)}</b></p>}
                    </div>
                  </div>

                  <div className="pl-1.5 pt-1.5 border-t border-outline-variant/30 flex justify-end">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={async () => {
                        if (isPartial) {
                          setPartialModal({ pallet: p, qty: p.qty_to_pick });
                        } else {
                          const ok = await confirm({
                            title: "Chuyển ra khu chờ xuất?",
                            description: `Xác nhận di chuyển pallet ${p.pallet_code} từ vị trí ${p.location_code} ra khu chờ xuất?`,
                            confirmText: "Di chuyển",
                          });
                          if (ok) handleStageOut(p);
                        }
                      }}
                      className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">forklift</span>
                      Đã di chuyển ra Staging
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* COMPLETED TASKS */}
      {completedPallets.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="font-bold text-xs uppercase text-on-surface-variant tracking-wider flex items-center gap-1.5 pl-1">
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">
              task_alt
            </span>
            Pallet đã ở khu chờ xuất ({completedPallets.length})
          </h3>

          <div className="space-y-2">
            {completedPallets.map((p, idx) => (
              <div
                key={`${p.pallet_id}-${idx}`}
                className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[16px]">
                    check
                  </span>
                  <div>
                    <strong className="font-mono text-emerald-950">{p.pallet_code}</strong>
                    <span className="text-[11px] text-on-surface-variant block">
                      Mã: {p.item_code} · SL: {p.qty_to_pick} thùng
                    </span>
                  </div>
                </div>
                <span className="font-semibold text-emerald-700 bg-emerald-100/50 px-2 py-0.5 rounded text-[11px]">
                  Đã ở khu chờ
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PARTIAL QUANTITY PICK MODAL OVERLAY */}
      {partialModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPartialModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform scale-100 transition-all p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h4 className="font-bold text-on-surface text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-500">call_split</span>
                Xác nhận rút một phần
              </h4>
              <p className="text-xs text-on-surface-variant mt-1">
                Lấy từ pallet <strong className="font-mono">{partialModal.pallet.pallet_code}</strong> tại <strong className="font-mono">{partialModal.pallet.location_code}</strong>.
              </p>
            </div>

            <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-3.5 space-y-3">
              <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
                Số lượng thùng cần rút (Tối đa {partialModal.pallet.qty_available})
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPartialModal({ ...partialModal, qty: Math.max(1, partialModal.qty - 1) })}
                  className="w-10 h-10 rounded-lg bg-white border border-amber-300 text-amber-700 font-bold hover:bg-amber-100 active:scale-95 transition-all"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={partialModal.pallet.qty_available}
                  value={partialModal.qty}
                  onChange={(e) =>
                    setPartialModal({
                      ...partialModal,
                      qty: Math.max(
                        1,
                        Math.min(partialModal.pallet.qty_available, Number(e.target.value) || 1)
                      ),
                    })
                  }
                  className="flex-1 px-3 py-2 text-center text-lg font-bold font-mono border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPartialModal({
                      ...partialModal,
                      qty: Math.min(partialModal.pallet.qty_available, partialModal.qty + 1),
                    })
                  }
                  className="w-10 h-10 rounded-lg bg-white border border-amber-300 text-amber-700 font-bold hover:bg-amber-100 active:scale-95 transition-all"
                >
                  +
                </button>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Sau khi rút, hệ thống tự động tạo pallet con ở khu chờ xuất với {partialModal.qty} thùng. Phần còn lại vẫn giữ ở vị trí hiện tại.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/30">
              <button
                type="button"
                onClick={() => setPartialModal(null)}
                className="px-4 py-2 hover:bg-surface-low rounded-lg text-xs font-semibold text-on-surface-variant transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleStageOut(partialModal.pallet, partialModal.qty)}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1 disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Xác nhận di chuyển"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
