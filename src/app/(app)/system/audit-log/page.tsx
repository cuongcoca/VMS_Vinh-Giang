"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { ExcelExport } from "@/components/ExcelExport";
import { Pagination } from "@/components/ui/Pagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  AUDIT_ACTION_LABEL,
  AUDIT_ACTION_TONE,
  ENTITY_TYPE_LABEL,
  labelOf,
  toneOf,
  type BadgeTone,
} from "@/lib/status-labels";

type LogEntry = {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_code?: string | null; // API có thể trả mã thân thiện
  action: string;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  performed_at: string;
  performed_by_name?: string | null;
  performed_by_role?: string | null;
  ip_address?: string | null;
};

const TONE_BG: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-700",
  info: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-rose-50 text-rose-700",
  neutral: "bg-surface-low text-on-surface-variant",
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val !== "object") return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return "—";
    return val.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join("\n");
  }
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return "—";

  const isSimple = keys.every((k) => typeof obj[k] !== "object" || obj[k] === null);
  if (isSimple) {
    return keys.map((k) => `${k}: ${obj[k] === null ? "—" : String(obj[k])}`).join("\n");
  }
  return JSON.stringify(val, null, 2);
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false); // WVG-50: 403 tường minh (không chỉ ẩn menu)
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 50;
  const router = useRouter();
  // WVG-50: lọc + phân trang chạy SERVER (đúng khi lịch sử > 200). Text người dùng debounce.
  const debouncedUser = useDebouncedValue(userFilter, 400);

  // UC_SYS_03_TC21: ngày bắt đầu không được lớn hơn ngày kết thúc
  const dateError = from && to && from > to ? "Ngày bắt đầu không được lớn hơn ngày kết thúc." : null;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // Đổi bất kỳ bộ lọc nào → quay về trang 1.
  useEffect(() => { setPage(1); }, [from, to, actionFilter, entityFilter, debouncedUser]);

  const fetchLogs = useCallback(() => {
    if (from && to && from > to) { setLoading(false); return; } // UC_SYS_03_TC21
    setLoading(true);
    setFetchError(null);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (entityFilter) params.set("entity_type", entityFilter);
    if (actionFilter) params.set("action", actionFilter);
    if (debouncedUser) params.set("actor", debouncedUser);
    params.set("page", String(page));
    params.set("limit", String(LIMIT));
    fetch(`/wms/api/audit-logs?${params.toString()}`)
      .then((r) => {
        if (r.status === 401) { router.replace("/wms/auth"); return null; } // UC_SYS_03_TC22
        if (r.status === 403) { setDenied(true); return null; } // WVG-50: 403 → không có quyền
        return r.json();
      })
      .then((r) => {
        if (!r) return;
        if (r.success) { setLogs(r.data); setTotal(r.total ?? r.data.length); setDenied(false); }
        else setFetchError(r.error || "Lỗi tải dữ liệu."); // UC_SYS_03_TC24
      })
      .catch((e) => { console.error(e); setFetchError("Lỗi kết nối. Vui lòng thử lại."); }) // UC_SYS_03_TC24
      .finally(() => setLoading(false));
  }, [from, to, entityFilter, actionFilter, debouncedUser, page, router]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Server đã lọc + phân trang → logs chính là danh sách của trang hiện tại.
  const pagedLogs = logs;

  return (
    <AppLayout title="NHẬT KÝ">
      <div className="p-6 space-y-5">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[28px]">history</span> Nhật ký hoạt động
        </h1>
        <div className="flex gap-3 items-end">
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1">Từ ngày</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 text-sm border border-outline-variant rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1">Đến ngày</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 text-sm border border-outline-variant rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1">Hành động</label>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white">
              <option value="">-- Tất cả --</option>
              {Object.entries(AUDIT_ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{String(v)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1">Đối tượng</label>
            <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white">
              <option value="">-- Tất cả --</option>
              {Object.entries(ENTITY_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{String(v)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1">Người dùng</label>
            <input type="text" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} placeholder="Tên người dùng" className="px-3 py-2 text-sm border border-outline-variant rounded-lg w-40" />
          </div>
          <ExcelExport
            data={logs as unknown as Record<string, unknown>[]}
            columns={[
              { key: "performed_at", header: "Thời gian", transform: (v) => new Date(v as string).toLocaleString("vi-VN") },
              { key: "action", header: "Hành động", transform: (v) => labelOf(AUDIT_ACTION_LABEL, v as string) },
              { key: "entity_type", header: "Đối tượng", transform: (v) => labelOf(ENTITY_TYPE_LABEL, v as string) },
              { key: "entity_code", header: "Mã" },
              { key: "entity_id", header: "ID" },
              { key: "performed_by_name", header: "Người thực hiện" },
              { key: "ip_address", header: "Địa chỉ IP" },
              { key: "reason", header: "Lý do" },
            ]}
            filename="nhat_ky_hoat_dong"
          />
          <span className="text-xs text-on-surface-variant/70 py-2">{total} bản ghi (trang {page}/{totalPages})</span>
        </div>
        {dateError && <p className="text-sm text-rose-600">{dateError}</p>}
        {fetchError && <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-lg">{fetchError}</div>}

        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-low/50 border-b border-outline-variant">
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Thời gian</th>
                <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Hành động</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Đối tượng</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden md:table-cell">
                  Người thực hiện
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden lg:table-cell">IP</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden md:table-cell">Lý do</th>
                <th className="text-right px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span>
                  </td>
                </tr>
              ) : denied ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[40px] text-rose-300 block mb-2">block</span>
                    <p className="font-semibold text-on-surface">Không có quyền xem Nhật ký</p>
                    <p className="text-sm">Chỉ vai <b>Quản lý</b> mới được xem Nhật ký thao tác. Backend đã từ chối yêu cầu (không chỉ ẩn menu).</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-on-surface-variant">
                    Không có nhật ký.
                  </td>
                </tr>
              ) : (
                pagedLogs.map((l) => {
                  const actionLabel = labelOf(AUDIT_ACTION_LABEL, l.action);
                  const actionTone = toneOf(AUDIT_ACTION_TONE, l.action, "neutral");
                  const entityLabel = labelOf(ENTITY_TYPE_LABEL, l.entity_type, l.entity_type);
                  return (
                    <React.Fragment key={l.id}>
                      <tr className="border-b border-outline-variant/40 hover:bg-surface-low/50">
                        <td className="px-4 py-2.5 text-xs text-on-surface-variant whitespace-nowrap">
                          {new Date(l.performed_at).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TONE_BG[actionTone]}`}>
                            {actionLabel}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <span className="font-semibold">{entityLabel}</span>{" "}
                          {l.entity_code ? (
                            <span className="font-mono text-primary">{l.entity_code}</span>
                          ) : (
                            <span className="text-on-surface-variant/70 font-mono">{l.entity_id.slice(0, 8)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs hidden md:table-cell text-on-surface-variant">
                          {l.performed_by_name || "—"}
                          {l.performed_by_role && (
                            <span className="ml-1 text-[10px] uppercase text-on-surface-variant/60">({l.performed_by_role})</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs hidden lg:table-cell text-on-surface-variant font-mono">{l.ip_address || "—"}</td>
                        <td className="px-4 py-2.5 text-xs hidden md:table-cell text-on-surface-variant">{l.reason || "—"}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
                            className="p-1 rounded hover:bg-surface-low"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {expandedId === l.id ? "expand_less" : "expand_more"}
                            </span>
                          </button>
                        </td>
                      </tr>
                      {expandedId === l.id && (
                        <tr>
                          <td colSpan={7} className="px-4 py-3 bg-surface-low">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="font-bold text-on-surface-variant mb-1">Trước</p>
                                <pre className="bg-white p-2 rounded border text-[10px] overflow-auto max-h-32">
                                  {formatValue(l.old_value)}
                                </pre>
                              </div>
                              <div>
                                <p className="font-bold text-on-surface-variant mb-1">Sau</p>
                                <pre className="bg-white p-2 rounded border text-[10px] overflow-auto max-h-32">
                                  {formatValue(l.new_value)}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant">
              <span className="text-xs text-on-surface-variant">
                {total === 0 ? "0" : `${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)}`} / {total} bản ghi
              </span>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
