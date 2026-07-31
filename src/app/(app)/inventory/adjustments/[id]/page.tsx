"use client";
import { useToast } from "@/components/ui";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import { Badge } from "@/components/ui/Badge";
import { auth } from "@/lib/auth";

type AdjustmentLine = {
  id: string;
  item_code_id: string;
  location_id: string | null;
  pallet_id: string | null;
  lot: string | null;
  qty_before: number;
  qty_adjust: number;
  qty_after: number;
  note: string | null;
  item_code: { code: string; short_name: string };
  pallet?: { code: string } | null;
  location_code?: string | null;
};

type AdjustmentVoucher = {
  id: string;
  code: string;
  reason: string;
  type?: string | null;
  reason_code?: string | null; // UC-INV-09 TC04-07: mã lý do
  status: "PENDING" | "APPROVED" | "REJECTED";
  stocktake_session_id: string | null;
  rejected_reason?: string | null;
  created_by: string | null;
  creator_name?: string | null;
  creator_role?: string | null;
  approved_by: string | null;
  approver_name?: string | null;
  approved_at: string | null;
  created_at: string;
  lines: AdjustmentLine[];
};

// UC-INV-09 TC04-07: nhãn mã lý do
const REASON_CODE_LABELS: Record<string, string> = {
  BROKEN: "Hỏng", LOST: "Mất", STOCKTAKE: "Kiểm kê", OTHER: "Khác",
};

const TYPE_LABELS: Record<string, string> = {
  DECREASE: "Giảm tồn (do hỏng/mất)",
  INCREASE: "Tăng tồn (do thừa)",
  STOCKTAKE_RESOLVE: "Điều chỉnh sau kiểm kê",
};

export default function AdjustmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [voucher, setVoucher] = useState<AdjustmentVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  // UC-INV-09-TC12/TC18: modal nhập lý do từ chối
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    fetch("/wms/api/adjustments")
      .then(r => r.json())
      .then(r => {
        if (r.success) {
          const found = (r.data as AdjustmentVoucher[]).find(v => v.id === params.id);
          setVoucher(found || null);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  const doAction = async (action: "approve" | "reject", rejected_reason?: string) => {
    if (!voucher) return;
    const label = action === "approve" ? "phê duyệt" : "từ chối";
    setActing(true);
    try {
      const res = await fetch(`/wms/api/adjustments/${voucher.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reject" ? { rejected_reason } : {}),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Đã ${label} thành công.`);
        router.push("/inventory/adjustments");
      } else {
        toast.error(data.error || "Đã có lỗi xảy ra.");
      }
    } catch {
      toast.error("Lỗi kết nối server.");
    } finally {
      setActing(false);
    }
  };

  const handleApprove = () => {
    if (!voucher) return;
    if (!window.confirm(`Bạn có chắc muốn PHÊ DUYỆT phiếu ${voucher.code}?`)) return;
    doAction("approve");
  };

  const handleRejectConfirm = () => {
    if (!rejectReason.trim()) { toast.error("Vui lòng nhập lý do từ chối."); return; }
    setRejectOpen(false);
    doAction("reject", rejectReason.trim());
  };

  const statusBadge = (status: string) => {
    const map: Record<string, "warning" | "success" | "error"> = {
      PENDING: "warning",
      APPROVED: "success",
      REJECTED: "error",
    };
    const labels: Record<string, string> = {
      PENDING: "Chờ duyệt",
      APPROVED: "Đã duyệt",
      REJECTED: "Từ chối",
    };
    return <Badge variant={map[status] || "neutral"}>{labels[status] || status}</Badge>;
  };

  if (loading) {
    return (
      <AppLayout title="CHI TIẾT PHIẾU ĐIỀU CHỈNH">
        <div className="flex items-center justify-center min-h-[60vh]">
          <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
        </div>
      </AppLayout>
    );
  }

  if (!voucher) {
    return (
      <AppLayout title="CHI TIẾT PHIẾU ĐIỀU CHỈNH">
        <div className="p-6 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-4">search_off</span>
          <p className="text-lg font-semibold text-on-surface-variant">Không tìm thấy phiếu điều chỉnh.</p>
          <Link href="/inventory/adjustments" className="text-primary hover:underline mt-2 inline-block">
            ← Quay lại danh sách
          </Link>
        </div>
      </AppLayout>
    );
  }

  const totalAdjust = voucher.lines.reduce((s, l) => s + Number(l.qty_adjust), 0);
  // UC-INV-09-TC17 + "Phê duyệt bằng Kế toán": chỉ Quản lý (+ super-role) thấy nút duyệt/từ chối
  const currentRole = typeof window !== "undefined" ? (auth.getUser()?.role ?? null) : null;
  const canApprove = !!currentRole && ["QUAN_LY", "ADMIN", "MANAGER", "STAFF"].includes(currentRole);

  return (
    <AppLayout title="CHI TIẾT PHIẾU ĐIỀU CHỈNH">
      <div className="p-6 space-y-5 max-w-[1200px]">
        {/* Back link */}
        <BackButton fallback="/inventory/adjustments" variant="subtle">Danh sách phiếu điều chỉnh</BackButton>

        {/* Header */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold font-mono text-primary">{voucher.code}</h1>
                {statusBadge(voucher.status)}
              </div>
              <p className="text-sm text-on-surface-variant mt-1">
                Ngày tạo: {new Date(voucher.created_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
              {voucher.approved_at && (
                <p className="text-sm text-on-surface-variant">
                  Ngày duyệt: {new Date(voucher.approved_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>

            {/* Action buttons */}
            {voucher.status === "PENDING" && canApprove && (
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={acting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Phê duyệt
                </button>
                <button
                  onClick={() => setRejectOpen(true)}
                  disabled={acting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                  Từ chối
                </button>
              </div>
            )}
            {voucher.status === "PENDING" && !canApprove && (
              <span className="text-xs text-on-surface-variant italic px-3 py-2 bg-surface-low rounded-lg">Chỉ Quản lý mới được duyệt/từ chối phiếu này.</span>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Số phiếu</label>
            <span className="font-mono font-bold text-sm">{voucher.code}</span>
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Ngày lập</label>
            <span className="text-sm">
              {new Date(voucher.created_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Người lập</label>
            <span className="text-sm font-semibold">{voucher.creator_name || "Kế toán kho"}</span>
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Loại điều chỉnh</label>
            <span className="text-sm font-semibold text-primary">{TYPE_LABELS[voucher.type || ""] || voucher.type || "—"}</span>
          </div>
        </div>

        {/* Reason */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-5">
          <h3 className="text-xs font-semibold text-on-surface-variant uppercase mb-2">Lý do điều chỉnh</h3>
          {voucher.reason_code && (
            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-surface-low text-on-surface-variant mb-2">
              Mã lý do: {REASON_CODE_LABELS[voucher.reason_code] || voucher.reason_code}
            </span>
          )}
          <p className="text-sm">{voucher.reason}</p>
          {voucher.status === "REJECTED" && voucher.rejected_reason && (
            <div className="mt-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <span className="font-semibold">Lý do từ chối:</span> {voucher.rejected_reason}
            </div>
          )}
          {voucher.stocktake_session_id && (
            <p className="text-xs text-on-surface-variant mt-2">
              <span className="material-symbols-outlined text-[14px] align-text-bottom mr-1">link</span>
              Liên kết phiên kiểm kê: <span className="font-mono">{voucher.stocktake_session_id}</span>
            </p>
          )}
        </div>

        {/* Lines table */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant">
            <h3 className="text-xs font-semibold text-on-surface-variant uppercase">Chi tiết dòng điều chỉnh ({voucher.lines.length} dòng)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 800 }}>
              <thead>
                <tr className="bg-surface-low/50 border-b border-outline-variant">
                  <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant w-12">#</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Mã hàng</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tên hàng</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Pallet</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Vị trí</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Lô</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">SL trước</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">SL thực tế</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Chênh</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {voucher.lines.map((line, idx) => {
                  const adjust = Number(line.qty_adjust);
                  return (
                    <tr key={line.id} className="border-b border-outline-variant/40 hover:bg-surface-low/50">
                      <td className="px-4 py-2.5 text-center text-on-surface-variant">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-primary">{line.item_code.code}</td>
                      <td className="px-4 py-2.5">{line.item_code.short_name}</td>
                      <td className="px-4 py-2.5 font-mono text-on-surface-variant">{line.pallet?.code || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-on-surface-variant">{line.location_code || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-on-surface-variant">{line.lot || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{Number(line.qty_before)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">{Number(line.qty_after)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-bold ${adjust > 0 ? "text-emerald-600" : adjust < 0 ? "text-rose-600" : ""}`}>
                        {adjust > 0 ? "+" : ""}{adjust}
                      </td>
                      <td className="px-4 py-2.5 text-on-surface-variant">{line.note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-surface-low/50 border-t-2 border-outline-variant">
                  <td colSpan={8} className="px-4 py-2.5 text-right font-semibold text-xs uppercase text-on-surface-variant">Tổng điều chỉnh</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-bold text-base ${totalAdjust > 0 ? "text-emerald-600" : totalAdjust < 0 ? "text-rose-600" : ""}`}>
                    {totalAdjust > 0 ? "+" : ""}{totalAdjust}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* UC-INV-09-TC12/TC18: modal nhập lý do từ chối (bắt buộc) */}
        {rejectOpen && (
          <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setRejectOpen(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-rose-700 mb-1">Từ chối phiếu {voucher.code}</h3>
              <p className="text-sm text-on-surface-variant mb-3">Vui lòng nhập lý do từ chối (bắt buộc).</p>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                autoFocus
                placeholder="VD: Số liệu chưa khớp chứng từ, cần kiểm tra lại..."
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setRejectOpen(false)} className="px-4 py-2 border border-outline-variant rounded-lg text-sm font-semibold hover:bg-surface-low">Hủy</button>
                <button onClick={handleRejectConfirm} disabled={acting || !rejectReason.trim()} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 disabled:opacity-50">Xác nhận từ chối</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
