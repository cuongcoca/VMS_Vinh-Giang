"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { mobileHref } from "@/lib/mobile-href";
import { BackLink } from "@/components/mobile/BackLink";
import { useToast } from "@/components/ui";

type ItemCodeRef = {
  id: string;
  code: string;
  short_name: string;
  full_name?: string | null;
  unit?: { id: string; name: string; symbol?: string | null } | null;
};

type InboundLine = {
  id: string;
  item_code_id: string;
  item_code: ItemCodeRef | null;
  qty_expected: string | number;
  qty_received: string | number | null;
  qty_accepted: string | number | null;
  lot: string | null;
  expiry_date: string | null;
  note: string | null;
  discrepancy_note: string | null;
};

type InboundDetail = {
  id: string;
  code: string;
  status: string;
  expected_date: string | null;
  received_at: string | null;
  invoice_no: string | null;
  supplier: { id: string; code: string; name: string } | null;
  note: string | null;
  lines: InboundLine[];
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ nhận",
  RECEIVING: "Đang nhập",
  RECONCILING: "Đã đối chiếu",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING: "bg-amber-100 text-amber-700",
  RECEIVING: "bg-blue-100 text-blue-700",
  RECONCILING: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

function toNumber(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export default function ThukhoInboundDetailPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const params = useParams();
  const { toast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<InboundDetail | null>(null);
  const [onPallet, setOnPallet] = useState(0); // tổng thùng đã quét lên pallet (từ stats API)
  // fix 1 phiếu — nhiều pallet: đối chiếu đã-lên-pallet vs thực-nhận theo từng mã
  type ReconcileItem = { item_code_id: string; code: string; short_name: string; qty_expected: number; qty_received: number | null; qty_on_pallet: number; diff: number | null };
  const [reconcile, setReconcile] = useState<ReconcileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // Per-line saving indicator (key = line.id) — hiện tick xanh khi lưu xong
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [savedLineId, setSavedLineId] = useState<string | null>(null);

  // UC-IN-02: 5-item checklist chuẩn bị
  const [prepChecklist, setPrepChecklist] = useState({
    zone_ready: false,
    pallet_ready: false,
    staff_ready: false,
    forklift_ready: false,
    scanner_ready: false,
  });

  // silent=true → refetch nền, không bật loading spinner toàn trang → tránh input mất focus
  const fetchData = useCallback(async (silent = false) => {
    if (!id) {
      setFetchError("Thiếu mã phiếu (id).");
      setLoading(false);
      return;
    }
    if (silent) setRefreshing(true);
    else setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${basePath}/api/inbound/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        setOnPallet(json.stats?.total_on_pallets ?? 0);
        setReconcile(json.reconcile_by_item ?? []);
      } else if (!silent) {
        setFetchError(json.error || `Không tải được phiếu (HTTP ${res.status}).`);
      }
    } catch (e) {
      console.error(e);
      if (!silent) setFetchError("Lỗi kết nối — vui lòng kiểm tra mạng và thử lại.");
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [basePath, id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReceive = async () => {
    setActionLoading(true);
    try {
      await fetch(`${basePath}/api/inbound/${id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prep_checklist: prepChecklist }),
      });
      fetchData(); // initial-like transition: status PENDING → RECEIVING, OK reload full
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  // Optimistic update + silent refetch → KHÔNG bật full spinner → input giữ focus
  const handleUpdateQty = async (lineId: string, qty: number, note?: string) => {
    setSavingLineId(lineId);
    // Optimistic update local state.
    // TC_RECEIVE_IN_008/_009/_014/_028: ghi chú thủ kho lưu ở cột `note` (tách khỏi
    // discrepancy_note hệ thống tự sinh) → nhập tự do, không bị auto-string ghi đè.
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lines: prev.lines.map((l) =>
          l.id === lineId
            ? { ...l, qty_received: qty, ...(note !== undefined ? { note } : {}) }
            : l
        ),
      };
    });
    try {
      const res = await fetch(`${basePath}/api/inbound/${id}/lines/${lineId}/receive`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty_received: qty, ...(note !== undefined ? { note } : {}) }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchData(true); // silent refresh — không spinner toàn trang
        setSavedLineId(lineId);
        setTimeout(() => setSavedLineId((c) => (c === lineId ? null : c)), 1500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingLineId((c) => (c === lineId ? null : c));
    }
  };

  // Phase 1.3 — TC_RECEIVE_IN_008/_009/_014/_028: cập nhật ghi chú chênh lệch riêng
  const handleUpdateDiscrepancyNote = async (lineId: string, qty: number, note: string) => {
    await handleUpdateQty(lineId, qty, note);
  };

  // UC-IN-02: Hoàn tất nhập (RECEIVING → RECONCILING)
  const handleFinishReceiving = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${basePath}/api/inbound/${id}/finish-receiving`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.success) {
        await fetchData(true); // silent: tránh blink toàn trang
      } else {
        toast.error(json.error || "Không hoàn tất được. Kiểm tra lại các dòng chưa điền SL thực nhận.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
      </div>
    );
  }

  // Phase 1.3 — TC_RECEIVE_IN_002: thay vì stuck loading, hiển thị lỗi rõ ràng + nút back
  if (fetchError || !data) {
    return (
      <div className="px-margin-mobile py-md flex flex-col items-center gap-4 h-[60vh] justify-center text-center">
        <span className="material-symbols-outlined text-[48px] text-rose-500">error_outline</span>
        <div className="text-sm font-semibold text-on-surface">Không mở được phiếu</div>
        <div className="text-xs text-on-surface-variant max-w-xs">
          {fetchError || "Phiếu không tồn tại hoặc bạn không có quyền xem."}
        </div>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white"
          >
            Thử lại
          </button>
          <Link
            href={mobileHref("/thukho/inbound")}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-outline-variant text-on-surface"
          >
            ← Danh sách phiếu
          </Link>
        </div>
      </div>
    );
  }

  const totalExpected = data.lines?.reduce((s, l) => s + toNumber(l.qty_expected), 0) || 0;
  const totalActual = data.lines?.reduce((s, l) => s + toNumber(l.qty_received), 0) || 0;
  const totalDiff = totalActual - totalExpected;

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      <BackLink href="/thukho/inbound">Danh sách phiếu</BackLink>

      {/* Header card */}
      <div className="bg-gradient-to-br from-primary to-primary-hover text-white rounded-2xl p-lg shadow-lg">
        <div className="flex justify-between items-start gap-md">
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <span className="font-mono text-xl font-bold truncate">{data.code}</span>
            <p className="text-sm text-white/80 truncate">{data.supplier?.name || "—"}</p>
            {data.invoice_no && (
              <p className="text-[11px] md:text-xs text-white/70 mt-0.5">
                Số hoá đơn: <span className="font-mono font-bold">{data.invoice_no}</span>
              </p>
            )}
            {data.expected_date && (
              <p className="text-[11px] md:text-xs text-white/70 mt-0.5">
                Ngày dự kiến: {new Date(data.expected_date).toLocaleDateString("vi-VN")}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`px-2.5 py-1 rounded-full text-[11px] md:text-xs font-bold whitespace-nowrap ${STATUS_COLOR[data.status] || "bg-white/20"}`}>
              {STATUS_LABEL[data.status] || data.status}
            </span>
            {refreshing && (
              <span className="text-[11px] text-white/70 flex items-center gap-1">
                <span className="material-symbols-outlined animate-spin text-[12px]">progress_activity</span>
                Đang đồng bộ…
              </span>
            )}
          </div>
        </div>
      </div>

      {/* UC-IN-02: Action PENDING → 5-item checklist + Tiếp nhận */}
      {data.status === "PENDING" && (() => {
        const checklistItems = [
          { key: "zone_ready" as const, label: "Khu vực dỡ hàng đã chuẩn bị" },
          { key: "pallet_ready" as const, label: "Pallet trống đủ số lượng" },
          { key: "staff_ready" as const, label: "Nhân sự đã có mặt" },
          { key: "forklift_ready" as const, label: "Xe nâng sẵn sàng" },
          { key: "scanner_ready" as const, label: "Thiết bị quét đã chuẩn bị" },
        ];
        const checkedCount = checklistItems.filter((it) => prepChecklist[it.key]).length;
        const totalCount = checklistItems.length;
        const isComplete = checkedCount === totalCount;

        return (
          <div className="flex flex-col gap-3">
            {/* CHUẨN BỊ box */}
            <div className="bg-surface rounded-xl border border-outline-variant/40 p-3">
              <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                Chuẩn bị <span className="text-on-surface-variant/60 normal-case font-normal">(tham khảo · không bắt buộc)</span>
              </div>
              <div className="flex flex-col gap-2">
                {checklistItems.map((it) => (
                  <label
                    key={it.key}
                    className="flex items-center gap-2 text-sm text-on-surface cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={prepChecklist[it.key]}
                      onChange={(e) =>
                        setPrepChecklist((p) => ({ ...p, [it.key]: e.target.checked }))
                      }
                      className="w-4 h-4 rounded border-outline-variant accent-primary"
                    />
                    {it.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Warning dynamic */}
            <div
              className={`rounded-xl p-3 flex items-start gap-2 text-xs ${
                isComplete
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                  : "bg-amber-50 border border-amber-200 text-amber-800"
              }`}
            >
              <span className="material-symbols-outlined text-[16px] mt-0.5">
                {isComplete ? "check_circle" : "warning"}
              </span>
              <div className="flex-1">
                {isComplete ? (
                  <span>
                    <b>Chuẩn bị đầy đủ ({checkedCount}/{totalCount})</b> — sẵn sàng nhập hàng.
                  </span>
                ) : (
                  <span>
                    <b>Chuẩn bị chưa đủ ({checkedCount}/{totalCount})</b> — vẫn có thể nhập hàng.
                    Hệ thống ghi nhận tình trạng chuẩn bị để báo cáo.
                  </span>
                )}
              </div>
            </div>

            {/* Tiếp nhận button */}
            <button
              onClick={handleReceive}
              disabled={actionLoading}
              className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-50 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">
                {actionLoading ? "progress_activity" : "check"}
              </span>
              {actionLoading ? "Đang xử lý..." : "Tiếp nhận & Bắt đầu nhập"}
            </button>
          </div>
        );
      })()}

      {/* Lines */}
      <div className="flex flex-col gap-sm">
        <span className="font-mono text-[11px] md:text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Chi tiết hàng hóa ({data.lines?.length || 0})
        </span>

        {(!data.lines || data.lines.length === 0) ? (
          <div className="industrial-card p-6 rounded-xl text-center bg-surface">
            <span className="material-symbols-outlined text-[40px] opacity-30 text-on-surface-variant mb-2">inventory_2</span>
            <p className="text-sm text-on-surface-variant">Phiếu chưa có dòng hàng nào.</p>
          </div>
        ) : (
          data.lines.map((line) => {
            const expected = toNumber(line.qty_expected);
            const actual = toNumber(line.qty_received);
            const diff = actual - expected;
            const diffColor = diff === 0 ? "text-success" : diff < 0 ? "text-error" : "text-amber-600";
            const code = line.item_code?.code ?? "—";
            const name = line.item_code?.short_name || line.item_code?.full_name || "";
            const unitLabel = line.item_code?.unit?.symbol || line.item_code?.unit?.name || "";
            // VĐ1/VĐ2: số thùng đã xếp lên pallet của mã này (từ reconcile_by_item)
            const onPalletLine = (() => {
              const r = reconcile.find((x) => x.item_code_id === line.item_code_id);
              return r ? Number(r.qty_on_pallet) : 0;
            })();

            return (
              <div key={line.id} className="industrial-card p-sm rounded-xl bg-surface shadow-sm">
                <div className="flex justify-between items-start gap-sm">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-mono font-bold text-primary">{code}</span>
                    <p className="text-[11px] md:text-xs text-on-surface-variant truncate">{name}</p>
                    {line.lot && (
                      <p className="text-[11px] md:text-xs text-on-surface-variant/70 mt-0.5">
                        Lô: <span className="font-mono">{line.lot}</span>
                        {line.expiry_date && <span> · HSD {new Date(line.expiry_date).toLocaleDateString("vi-VN")}</span>}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-sm mt-2 text-center">
                  <div>
                    <span className="text-[11px] md:text-xs text-on-surface-variant block">Dự kiến</span>
                    <span className="text-sm font-bold">
                      {expected}{unitLabel && <span className="text-[11px] md:text-xs text-on-surface-variant ml-0.5">{unitLabel}</span>}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] md:text-xs text-on-surface-variant block flex items-center justify-center gap-1">
                      Thực nhận
                      {savingLineId === line.id && (
                        <span className="material-symbols-outlined animate-spin text-[12px] text-primary">progress_activity</span>
                      )}
                      {savedLineId === line.id && (
                        <span className="material-symbols-outlined text-[12px] text-emerald-600">check_circle</span>
                      )}
                    </span>
                    {data.status === "RECEIVING" ? (
                      <div className="flex flex-col items-stretch gap-1">
                        <input
                          type="number"
                          key={`qty-${line.id}-${line.qty_received ?? ""}`}
                          defaultValue={line.qty_received != null ? String(line.qty_received) : ""}
                          onBlur={(e) => {
                            const newVal = parseFloat(e.target.value) || 0;
                            if (newVal !== toNumber(line.qty_received)) {
                              handleUpdateQty(line.id, newVal);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          disabled={savingLineId === line.id}
                          className="w-full text-center text-sm font-bold border border-outline-variant rounded px-2 py-2 min-h-[44px] focus:border-primary focus:outline-none disabled:bg-surface-low"
                        />
                        {onPalletLine > 0 && onPalletLine !== actual ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(line.id, onPalletLine)}
                            disabled={savingLineId === line.id}
                            className="text-[11px] text-primary flex items-center justify-center gap-0.5 min-h-[32px] disabled:opacity-40"
                            title={`Điền ${onPalletLine} từ số đã lên pallet`}
                          >
                            <span className="material-symbols-outlined text-[13px]">move_down</span>
                            Lấy {onPalletLine} từ pallet
                          </button>
                        ) : onPalletLine > 0 ? (
                          <span className="text-[10px] text-emerald-600 text-center">✓ khớp pallet ({onPalletLine})</span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-sm font-bold">{line.qty_received != null ? String(line.qty_received) : "—"}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] md:text-xs text-on-surface-variant block">Chênh lệch</span>
                    <span className={`text-sm font-bold ${diffColor}`}>
                      {diff > 0 ? "+" : ""}{diff}
                    </span>
                  </div>
                </div>

                {/* Phase 1.3 — TC_RECEIVE_IN_008/_009/_014/_028: ghi chú khi có chênh lệch.
                    Bind vào line.note (ghi chú thủ kho) — KHÔNG dùng discrepancy_note (auto hệ thống)
                    → tránh hiển thị mặc định "Chênh lệch: ..." không cho nhập. */}
                {data.status === "RECEIVING" && line.qty_received != null && diff !== 0 && (
                  <div className="mt-2">
                    <label className="text-[11px] md:text-xs text-amber-700 block font-semibold mb-0.5">
                      Ghi chú {diff < 0 ? "hàng thiếu" : "hàng thừa"} (tuỳ chọn)
                    </label>
                    <textarea
                      key={`note-${line.id}`}
                      defaultValue={line.note ?? ""}
                      onBlur={(e) => {
                        const newNote = e.target.value.trim();
                        if (newNote !== (line.note ?? "")) {
                          handleUpdateDiscrepancyNote(
                            line.id,
                            toNumber(line.qty_received),
                            newNote
                          );
                        }
                      }}
                      placeholder={
                        diff < 0
                          ? "Lý do thiếu (vd: NCC giao thiếu, hàng vỡ, ...)"
                          : "Lý do thừa (vd: NCC bù sau, đếm lại, ...)"
                      }
                      rows={2}
                      className="w-full text-xs border border-amber-300 rounded px-2 py-1 focus:border-amber-500 focus:outline-none bg-amber-50/40"
                    />
                  </div>
                )}
                {data.status !== "RECEIVING" && (line.note || line.discrepancy_note) && (
                  <div className="mt-2 text-[11px] md:text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 space-y-0.5">
                    {line.note && (
                      <div><span className="font-bold">Ghi chú:</span> {line.note}</div>
                    )}
                    {line.discrepancy_note && (
                      <div><span className="font-bold">Chênh lệch:</span> {line.discrepancy_note.replace(/^\s*Chênh lệch:\s*/i, "")}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary */}
      <div className="industrial-card p-md rounded-xl bg-surface-low flex justify-around">
        <div className="text-center">
          <span className="text-[11px] md:text-xs text-on-surface-variant block">Tổng DK</span>
          <span className="text-lg font-bold text-primary">{totalExpected}</span>
        </div>
        <div className="text-center">
          <span className="text-[11px] md:text-xs text-on-surface-variant block">Tổng TN</span>
          <span className="text-lg font-bold text-secondary">{totalActual}</span>
        </div>
        <div className="text-center">
          <span className="text-[11px] md:text-xs text-on-surface-variant block">CL</span>
          <span className={`text-lg font-bold ${totalDiff === 0 ? "text-success" : totalDiff < 0 ? "text-error" : "text-amber-600"}`}>
            {totalDiff > 0 ? "+" : ""}{totalDiff}
          </span>
        </div>
      </div>

      {/* RECEIVING: Action Hoàn tất nhập (chuyển sang RECONCILING cho kế toán đối chiếu) */}
      {data.status === "RECEIVING" && (() => {
        const allReceived = data.lines.every((l) => l.qty_received !== null && l.qty_received !== undefined);
        const linesNotReceived = data.lines.filter((l) => l.qty_received === null || l.qty_received === undefined);
        // fix 1 phiếu — nhiều pallet: mã lệch giữa đã-lên-pallet và thực-nhận (chỉ xét mã đã có thực nhận)
        const recMismatches = reconcile.filter((r) => r.qty_received !== null && r.diff !== 0);

        return (
          <div className="flex flex-col gap-3">
            {/* Cảnh báo chênh lệch nếu có */}
            {totalDiff !== 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-800">
                <span className="material-symbols-outlined text-[16px] mt-0.5">warning</span>
                <div>
                  <b>Có chênh lệch SL ({totalDiff > 0 ? "+" : ""}{totalDiff})</b>
                  <div className="text-[11px] mt-0.5">Hệ thống vẫn cho gửi đối chiếu. Kế toán sẽ xác nhận từng dòng trên PC.</div>
                </div>
              </div>
            )}

            {/* Cảnh báo còn dòng chưa nhập */}
            {!allReceived && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2 text-xs text-rose-700">
                <span className="material-symbols-outlined text-[16px] mt-0.5">error</span>
                <div>
                  <b>Còn {linesNotReceived.length} dòng chưa điền SL thực nhận</b>
                  <div className="text-[11px] mt-0.5">Điền hết các ô &quot;Thực nhận&quot; trước khi hoàn tất.</div>
                </div>
              </div>
            )}

            {/* fix 1 phiếu — nhiều pallet: đối chiếu ĐÃ LÊN PALLET vs THỰC NHẬN.
                Trong khi chưa điền thực nhận thì tạm so với dự kiến. */}
            {totalExpected > 0 && (() => {
              const hasReceived = totalActual > 0;
              const target = hasReceived ? totalActual : totalExpected;
              const targetLabel = hasReceived ? "thực nhận" : "dự kiến";
              const enough = onPallet >= target;
              return (
                <div className="rounded-xl border border-outline-variant bg-white p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-on-surface">Đã lên pallet</span>
                    <span className="text-xs font-mono font-bold text-on-surface">
                      {onPallet}/{target} thùng <span className="text-on-surface-variant font-normal">({targetLabel})</span>
                      {enough ? (
                        <span className="text-emerald-600"> · đủ ✓</span>
                      ) : (
                        <span className="text-amber-600"> · còn {target - onPallet}</span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 bg-surface-low rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${enough ? "bg-emerald-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, Math.round((onPallet / target) * 100))}%` }}
                    />
                  </div>
                  {hasReceived && recMismatches.length > 0 && (
                    <div className="mt-2 rounded-lg bg-rose-50 border border-rose-200 p-2 text-[11px] text-rose-700">
                      <div className="font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">error</span>
                        {recMismatches.length} mã lệch giữa đã-lên-pallet và thực-nhận:
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {recMismatches.slice(0, 5).map((r) => (
                          <li key={r.item_code_id} className="font-mono">
                            {r.code}: pallet {r.qty_on_pallet} / thực nhận {r.qty_received} ({(r.diff ?? 0) > 0 ? "+" : ""}{r.diff})
                          </li>
                        ))}
                        {recMismatches.length > 5 && <li>…và {recMismatches.length - 5} mã khác</li>}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* UC-PAL-01: Tạo pallet cho phiếu này — pre-link PHN */}
            <Link
              href={mobileHref(`/thukho/pallet/new?inbound_request_id=${id}`)}
              className="w-full py-3 border-2 border-secondary text-secondary rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-secondary/5 active:scale-[0.99] transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
              Tạo pallet cho phiếu này
            </Link>

            {/* Cảnh báo (không chặn) khi tổng trên pallet lệch thực nhận */}
            {allReceived && recMismatches.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2 text-xs text-rose-700">
                <span className="material-symbols-outlined text-[16px] mt-0.5">warning</span>
                <div>
                  <b>{recMismatches.length} mã có SL trên pallet lệch với thực nhận.</b>
                  <div className="text-[11px] mt-0.5">Nên xếp/kiểm lại hàng lên pallet cho khớp thực nhận trước khi gửi đối chiếu. Vẫn cho gửi nếu bạn xác nhận.</div>
                </div>
              </div>
            )}

            {/* Nút Hoàn tất */}
            <button
              onClick={handleFinishReceiving}
              disabled={actionLoading || !allReceived}
              className="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">
                {actionLoading ? "progress_activity" : "send"}
              </span>
              {actionLoading ? "Đang gửi..." : "Hoàn tất nhập · Gửi đối chiếu"}
            </button>

            <p className="text-[11px] text-on-surface-variant/70 text-center">
              Sau khi gửi, kế toán sẽ mở phiếu trên PC để đối chiếu + chốt.
            </p>
          </div>
        );
      })()}

      {/* RECONCILING: Đã gửi, chờ kế toán */}
      {data.status === "RECONCILING" && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col items-center gap-2 text-center">
          <span className="material-symbols-outlined text-[40px] text-purple-600">hourglass_top</span>
          <div className="text-sm font-bold text-purple-800">Đã gửi đối chiếu</div>
          <div className="text-[11px] text-purple-700">
            Kế toán đang xác nhận từng dòng + chốt phiếu trên PC.
            <br />Bạn đã hoàn tất phần việc.
          </div>
          <Link
            href={mobileHref("/thukho/inbound")}
            className="mt-3 px-5 py-2 border border-purple-300 rounded-lg text-xs font-semibold text-purple-700 hover:bg-purple-100"
          >
            ← Về danh sách phiếu
          </Link>
        </div>
      )}

      {/* COMPLETED: Đã hoàn tất */}
      {data.status === "COMPLETED" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col items-center gap-2 text-center">
          <span className="material-symbols-outlined text-[40px] text-emerald-600">check_circle</span>
          <div className="text-sm font-bold text-emerald-800">Phiếu đã hoàn tất</div>
          <div className="text-[11px] text-emerald-700">
            Phiếu đã được chốt. Tồn kho đã cập nhật.
          </div>
          <Link
            href={mobileHref("/thukho/inbound")}
            className="mt-3 px-5 py-2 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            ← Về danh sách phiếu
          </Link>
        </div>
      )}

      {data.note && (
        <div className="bg-surface-low p-3 rounded-md text-xs text-on-surface-variant">
          <span className="font-bold uppercase text-[11px] md:text-xs block mb-1">Ghi chú</span>
          {data.note}
        </div>
      )}
    </div>
  );
}
