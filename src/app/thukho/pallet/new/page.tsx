"use client";
import { DateField } from "@/components/mobile";
import { mobileHref } from "@/lib/mobile-href";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/mobile/BackLink";
import { useToast } from "@/components/ui";

type Supplier = { id: string; code: string; name: string };
type InboundRequest = { id: string; code: string; invoice_no?: string | null; supplier_id?: string | null; supplier?: { id?: string; name: string } | null };

export default function ThukhoNewPalletPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-on-surface-variant">Đang tải...</div>}>
      <NewPalletContent />
    </Suspense>
  );
}
function NewPalletContent() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  // UC-PAL-01: pre-select PHN từ query
  const prefilledPhnId = searchParams.get("inbound_request_id") || "";
  const prefilledTempId = searchParams.get("temp") || "";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inboundRequests, setInboundRequests] = useState<InboundRequest[]>([]);
  const [tempInbound, setTempInbound] = useState<any>(null);
  const [nextCode, setNextCode] = useState<string>("");
  const [supplierId, setSupplierId] = useState("");
  const [inboundRequestId, setInboundRequestId] = useState(prefilledPhnId);
  const [inboundTempId, setInboundTempId] = useState(prefilledTempId);
  const [note, setNote] = useState("");
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Preview mã pallet kế tiếp
    fetch(`${basePath}/api/pallets/next-code`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setNextCode(j.data.code); })
      .catch(console.error);

    // Load NCC
    fetch(`${basePath}/api/suppliers`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setSuppliers(j.data || []); })
      .catch(console.error);

    if (prefilledTempId) {
      // Load phiếu tạm
      fetch(`${basePath}/api/inbound-temp/${prefilledTempId}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.success && j.data) {
            setTempInbound(j.data);
            if (j.data.supplier_id) setSupplierId(j.data.supplier_id);
          }
        })
        .catch(console.error);
    } else {
      // 1 phiếu — nhiều pallet: hiện MỌI phiếu đang mở
      fetch(`${basePath}/api/inbound`)
        .then((r) => r.json())
        .then((j) => {
          if (j.success) {
            const open = (j.data || []).filter(
              (i: { status: string }) =>
                i.status === "PENDING" || i.status === "RECEIVING" || i.status === "RECONCILING"
            );
            if (prefilledPhnId && !open.some((i: InboundRequest) => i.id === prefilledPhnId)) {
              fetch(`${basePath}/api/inbound/${prefilledPhnId}`)
                .then((r2) => r2.json())
                .then((j2) => {
                  if (j2.success && j2.data) {
                    setInboundRequests([j2.data, ...open]);
                    if (j2.data.supplier_id) setSupplierId(j2.data.supplier_id);
                  }
                })
                .catch(console.error);
            } else {
              setInboundRequests(open);
              if (prefilledPhnId) {
                const phn = open.find((i: InboundRequest) => i.id === prefilledPhnId);
                if (phn?.supplier_id) {
                  setSupplierId(phn.supplier_id);
                }
              }
            }
          }
        })
        .catch(console.error);
    }
  }, [basePath, prefilledPhnId, prefilledTempId]);

  const handleSubmit = async () => {
    setError("");
    if (!receiveDate) {
      setError("Vui lòng chọn Ngày nhập.");
      return;
    }
    const d = new Date(receiveDate);
    if (Number.isNaN(d.getTime())) {
      setError("Ngày nhập không hợp lệ.");
      return;
    }
    const year = d.getUTCFullYear();
    if (year < 2020 || year > 2100) {
      setError("Năm phải nằm trong khoảng 2020 – 2100.");
      return;
    }
    const maxFutureDays = 30;
    const maxAllowed = new Date();
    maxAllowed.setDate(maxAllowed.getDate() + maxFutureDays);
    if (d.getTime() > maxAllowed.getTime()) {
      setError(`Không cho phép Ngày nhập quá ${maxFutureDays} ngày trong tương lai.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${basePath}/api/pallets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplierId || undefined,
          inbound_request_id: inboundRequestId || undefined,
          inbound_temp_id: inboundTempId || undefined,
          note,
          receive_date: receiveDate,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        if (json.warnings && json.warnings.length > 0) {
          toast.warning(json.warnings.join(" · "));
        }
        router.push(mobileHref(`/thukho/pallet/${json.data.id}`));
      } else {
        setError(json.error || "Lỗi tạo pallet");
      }
    } catch {
      setError("Lỗi kết nối server");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      <div className="flex flex-col gap-xs">
        <BackLink href={prefilledTempId ? `/thukho/adhoc/${prefilledTempId}` : "/thukho/pallet"}>Quay lại</BackLink>
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[24px]">add_box</span> Tạo pallet mới
        </h1>
      </div>

      {/* Preview mã pallet — UC-PAL-01 */}
      <div className="text-center py-md">
        <div className="text-[48px] leading-none">🆕</div>
        <h3 className="text-base font-bold mt-1">Tạo pallet mới</h3>
        <p className="text-[11px] md:text-xs text-on-surface-variant">Mã pallet sẽ được sinh tự động</p>
      </div>

      <div className="industrial-card p-lg rounded-xl bg-surface flex flex-col gap-md">
        <div className="flex flex-col gap-xs">
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">Mã pallet (auto)</label>
          <input
            type="text"
            value={nextCode || "PL……"}
            disabled
            className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm font-bold font-mono bg-surface-low text-on-surface"
          />
          <p className="text-[11px] md:text-xs text-on-surface-variant">Định dạng PLYYMMDD.STT — STT tăng dần theo ngày.</p>
        </div>

        {/* Inbound Request Link — UC-PAL-01 */}
        {tempInbound ? (
          <div className="flex flex-col gap-xs bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-900">
            <div className="flex items-center gap-1 font-bold">
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              Liên kết với phiếu nhập tạm đột xuất:
            </div>
            <div className="font-mono font-bold mt-1 text-sm">{tempInbound.code}</div>
            <div className="mt-1">{tempInbound.supplier?.name || "Chưa có NCC"}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-xs">
            <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Liên kết với phiếu nhập (tùy chọn)
            </label>
            <select
              value={inboundRequestId}
              onChange={(e) => setInboundRequestId(e.target.value)}
              className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:border-primary"
            >
              <option value="">— Chưa liên kết —</option>
              {inboundRequests.map((ir) => (
                <option key={ir.id} value={ir.id}>
                  {ir.code} · {ir.invoice_no?.trim() ? `HĐ ${ir.invoice_no.trim()}` : "(chưa có HĐ)"}{ir.supplier?.name ? ` · ${ir.supplier.name}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Supplier (chỉ hiển thị khi không link phiếu nhập và không có phiếu tạm) */}
        {!inboundRequestId && !tempInbound && (
          <div className="flex flex-col gap-xs">
            <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">Nhà cung cấp</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:border-primary"
            >
              <option value="">— Chưa chọn —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date — Phase 3.1 TC_CREATE_PAL_008: ràng buộc năm 4 chữ số 2020–2100 */}
        <div className="flex flex-col gap-xs">
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">Ngày nhập</label>
          <DateField
            value={receiveDate}
            onChange={(val) => setReceiveDate(val)}
            className="border-outline-variant"
          />
        </div>

        {/* Note */}
        <div className="flex flex-col gap-xs">
          <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">Ghi chú</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="VD: Khu chờ nhập 1..."
            className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:border-primary resize-none"
          />
        </div>

        {error && (
          <div className="p-sm bg-error-container/20 border border-error/30 rounded-lg text-xs text-error font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">error</span> {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-primary text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">{submitting ? "progress_activity" : "inventory_2"}</span>
          {submitting ? "Đang tạo..." : "📦 Tạo pallet"}
        </button>

        <p className="text-[11px] md:text-xs text-on-surface-variant text-center">
          Pallet mới ở trạng thái <strong>&ldquo;Đang thêm hàng&rdquo;</strong> và bắt đầu <strong>trống</strong>.
          Thêm đúng phần hàng thực xếp lên pallet này — khi liên kết phiếu nhập, màn thêm hàng
          hiển thị <strong>số còn lại theo phiếu</strong> (dự kiến − đã lên pallet).
        </p>
      </div>
    </div>
  );
}
