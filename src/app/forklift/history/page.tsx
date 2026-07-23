"use client";
import { DateField } from "@/components/mobile";
import React, { useState, useEffect, useCallback } from "react";
// Phase 3.2: KHÔNG dùng AppLayout (đây là page mobile, layout đã có sẵn từ forklift/layout.tsx)
import Link from "next/link";
import { mobileHref } from "@/lib/mobile-href";
import { BackButton } from "@/components/BackButton";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type Movement = {
  id: string; movement_type: string; reason: string | null; performed_at: string;
  pallet: { id: string; code: string; status: string } | null;
  from_location: { code: string; zone: string } | null;
  to_location: { code: string; zone: string } | null;
  // Phase 6.3 — fields mới từ /api/forklift/history
  performed_by_name?: string | null;
  performed_by_role?: string | null;
  item_code?: { code: string; short_name: string } | null;
  qty_box?: string | null;
  lot?: string | null;
  expiry_date?: string | null;
  mode?: string | null;
  // UC-FK-06_TC20 — audit hoàn trả (old → new), gắn qua audit_log_id
  audit?: { action: string; old_value: unknown; new_value: unknown } | null;
};

// UC-FK-06_TC20: nhãn + format giá trị thay đổi của dòng hàng khi hoàn trả.
type LineChange = { item_code?: string | null; old?: Record<string, unknown>; new?: Record<string, unknown> };
const FIELD_LABEL: Record<string, string> = { qty_box: "SL", lot: "Lô", expiry_date: "HSD", manufactured_date: "NSX" };
const fmtChangeVal = (key: string, v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (key === "expiry_date" || key === "manufactured_date") {
    const d = new Date(v as string);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("vi-VN");
  }
  if (key === "qty_box") return String(Number(v));
  return String(v);
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "QT", MANAGER: "QL", QUAN_LY: "QL", KE_TOAN: "KT", THU_KHO: "TK", XE_NANG: "XN", KIEM_KE: "KK", STAFF: "NV",
};

const TYPE_MAP: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  PUT_AWAY: { icon: "input", label: "Xếp vị trí", color: "text-blue-600", bg: "bg-blue-50" },
  RELOCATE: { icon: "swap_horiz", label: "Chuyển vị trí", color: "text-indigo-600", bg: "bg-indigo-50" },
  STAGE_OUT: { icon: "output", label: "Xuất FEFO", color: "text-amber-600", bg: "bg-amber-50" },
  RETURN: { icon: "undo", label: "Hoàn trả", color: "text-emerald-600", bg: "bg-emerald-50" },
  SHIP: { icon: "local_shipping", label: "Xuất kho", color: "text-purple-600", bg: "bg-purple-50" },
};

export default function MovementHistoryPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({ PUT_AWAY: 0, RELOCATE: 0, STAGE_OUT: 0, RETURN: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  // UC-FK-06_TC02: ô tìm kiếm hợp nhất (mã pallet / mã hàng / vị trí kho)
  const [filterSearch, setFilterSearch] = useState("");
  // Phase 6.3 — MD06 row 46: hôm nay là default cho dashboard forklift
  const [todayOnly, setTodayOnly] = useState(true);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      if (filterSearch.trim()) params.set("q", filterSearch.trim());
      if (todayOnly) {
        params.set("today", "true");
      } else {
        if (filterFrom) params.set("from", filterFrom);
        if (filterTo) params.set("to", filterTo);
      }
      params.set("limit", "200");
      // Phase 6.3 — endpoint mới /api/forklift/history (gồm user + KPI + qty)
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const res = await fetch(`${basePath}/api/forklift/history?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setMovements(result.data);
        setKpis(result.kpis || { PUT_AWAY: 0, RELOCATE: 0, STAGE_OUT: 0, RETURN: 0, total: 0 });
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [filterType, filterFrom, filterTo, filterSearch, todayOnly]);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  const formatDateTime = (d: string) => new Date(d).toLocaleString("vi-VN");

  // UC-FK-06_TC15: export lịch sử ra CSV (mở được bằng Excel) — đủ cột + từng dòng.
  const exportCSV = () => {
    const header = ["Thời gian", "Loại", "Pallet", "Mã hàng", "Lô", "HSD", "SL (thùng)", "Từ vị trí", "Đến vị trí", "Người thực hiện", "Lý do"];
    const rows = movements.map((m) => {
      const pLines = (m.pallet as any)?.lines || [];
      const itemCodes = m.item_code?.code 
        ? m.item_code.code 
        : (pLines.map((l: any) => l.item_code?.code).filter(Boolean).join("; ") || "");
      const lots = m.lot 
        ? m.lot 
        : (pLines.map((l: any) => l.lot || "—").join("; ") || "");
      const expDates = m.expiry_date 
        ? new Date(m.expiry_date).toLocaleDateString("vi-VN") 
        : (pLines.map((l: any) => l.expiry_date ? new Date(l.expiry_date).toLocaleDateString("vi-VN") : "—").join("; ") || "");
      const qties = m.qty_box != null 
        ? String(Number(m.qty_box)) 
        : (pLines.map((l: any) => String(Number(l.qty_box))).join("; ") || "");

      return [
        formatDateTime(m.performed_at),
        TYPE_MAP[m.movement_type]?.label || m.movement_type,
        m.pallet?.code || "",
        itemCodes,
        lots,
        expDates,
        qties,
        m.from_location?.code || "",
        m.to_location?.code || "",
        m.performed_by_name || "",
        m.reason || "",
      ];
    });

    const csv = "sep=,\r\n" + [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    // ﻿ (BOM) để Excel đọc đúng tiếng Việt UTF-8
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lich-su-luan-chuyen-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Phân trang client-side cho timeline luân chuyển (chỉ ảnh hưởng hiển thị).
  // Hoãn từ khoá tìm kiếm trước khi đưa vào resetKey: nếu dùng giá trị thô thì
  // mỗi ký tự gõ là một lần nhảy về trang 1.
  const debouncedSearch = useDebouncedValue(filterSearch);
  const pg = useClientPagination(movements, {
    resetKey: `${filterType}|${filterFrom}|${filterTo}|${debouncedSearch}|${todayOnly}`,
    initialLimit: 10,
  });
  const { paged: pagedMovements } = pg;

  return (
    <div className="px-margin-mobile py-md space-y-5">
      <BackButton fallback={mobileHref("/forklift")}>Quay lại</BackButton>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-[28px]">history</span> Lịch sử luân chuyển
          </h1>
          <button
            onClick={exportCSV}
            disabled={movements.length === 0}
            className="px-3 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-1.5 font-semibold shadow-sm flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">download</span> Xuất Excel
          </button>
        </div>

        {/* Phase 6.3 — KPI strip 4 loại + tổng */}
        <div className="grid grid-cols-4 gap-2">
          {(["PUT_AWAY", "RELOCATE", "STAGE_OUT", "RETURN"] as const).map((t) => {
            const meta = TYPE_MAP[t];
            const active = filterType === t;
            return (
              <button
                key={t}
                onClick={() => setFilterType(active ? "" : t)}
                className={`p-2 rounded-lg border text-center transition-all ${
                  active ? `ring-2 ring-primary ${meta.bg}` : `${meta.bg} border-outline-variant/40 hover:border-outline-variant`
                }`}
              >
                <span className={`material-symbols-outlined text-[18px] block mx-auto ${meta.color}`}>{meta.icon}</span>
                <span className={`text-lg font-bold font-mono block ${meta.color}`}>{kpis[t] || 0}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider block leading-tight text-on-surface-variant">
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4 flex flex-col gap-3">
          <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer select-none">
            <input
              type="checkbox"
              checked={todayOnly}
              onChange={(e) => setTodayOnly(e.target.checked)}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="font-semibold">Chỉ hôm nay</span>
            <span className="text-on-surface-variant">(MD06 row 46: lịch sử trong ngày)</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Tìm mã pallet, mã hàng, vị trí (A-01-01)..."
              className="flex-1 px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {!todayOnly && (
              <>
                <DateField value={filterFrom} onChange={(val) => setFilterFrom(val)} className="border-outline-variant" />
                <DateField value={filterTo} onChange={(val) => setFilterTo(val)} className="border-outline-variant" />
              </>
            )}
            {(filterType || filterFrom || filterTo || filterSearch || !todayOnly) && (
              <button
                onClick={() => { setFilterType(""); setFilterFrom(""); setFilterTo(""); setFilterSearch(""); setTodayOnly(true); }}
                className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1 font-semibold"
              >
                <span className="material-symbols-outlined text-[14px]">filter_alt_off</span> Reset
              </button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-5">
          {loading ? (
            <div className="flex items-center justify-center py-10"><span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span></div>
          ) : movements.length === 0 ? (
            <div className="text-center py-10 text-on-surface-variant">
              <span className="material-symbols-outlined text-[40px] opacity-30">history</span>
              <p className="mt-2 text-sm">Chưa có lịch sử.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-surface-mid" />
              <div className="space-y-5">
                {pagedMovements.map((m) => {
                  const t = TYPE_MAP[m.movement_type] || { icon: "help", label: m.movement_type, color: "text-on-surface-variant", bg: "bg-surface-low" };
                  return (
                    <div key={m.id} className="flex gap-4 relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${t.bg} ${t.color} border-2 border-white shadow-sm`}>
                        <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-semibold ${t.color}`}>{t.label}</span>
                          {m.pallet ? (
                            <Link href={`/pallets/${m.pallet.id}`} className="font-mono font-bold text-primary text-sm hover:underline">{m.pallet.code}</Link>
                          ) : (
                            <span className="font-mono text-sm text-on-surface-variant italic">(pallet đã xóa)</span>
                          )}
                          {m.mode && (
                            <span className="text-[11px] font-bold uppercase px-1.5 py-0.5 bg-surface-low rounded">
                              {m.mode}
                            </span>
                          )}
                        </div>
                        {m.item_code ? (
                          <>
                            <p className="text-xs text-on-surface-variant mt-0.5">
                              <span className="font-mono">{m.item_code.code}</span>
                              {m.item_code.short_name && <span> · {m.item_code.short_name}</span>}
                              {m.qty_box && <span className="font-semibold ml-1">({Number(m.qty_box)} thùng)</span>}
                            </p>
                            {/* UC-FK-06_TC08: hiển thị Lô + HSD (API đã trả lot/expiry_date) */}
                            {(m.lot || m.expiry_date) && (
                              <p className="text-xs text-on-surface-variant mt-0.5">
                                {m.lot && <span>Lô: <span className="font-mono">{m.lot}</span></span>}
                                {m.lot && m.expiry_date && <span> · </span>}
                                {m.expiry_date && <span>HSD: <span className="font-mono">{new Date(m.expiry_date).toLocaleDateString("vi-VN")}</span></span>}
                              </p>
                            )}
                          </>
                        ) : (m.pallet as any)?.lines && (m.pallet as any).lines.length > 0 ? (
                          <div className="text-xs text-on-surface-variant mt-1 p-2 bg-surface-low/50 rounded-lg space-y-1">
                            {(m.pallet as any).lines.map((line: any, idx: number) => (
                              <div key={idx} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className="font-mono bg-zinc-100 text-zinc-800 px-1 py-0.5 rounded text-[11px]">{line.item_code?.code}</span>
                                <span className="text-[11px]">{line.item_code?.short_name}</span>
                                <span className="font-semibold text-[11px]">({Number(line.qty_box)} thùng)</span>
                                {line.lot && <span className="text-[11px] text-on-surface-variant/70">Lô: {line.lot}</span>}
                                {line.expiry_date && <span className="text-[11px] text-on-surface-variant/70">HSD: {new Date(line.expiry_date).toLocaleDateString("vi-VN")}</span>}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className="text-sm text-on-surface-variant mt-0.5 flex items-center gap-1">
                          {m.from_location && <span className="font-mono text-xs bg-surface-low px-1.5 py-0.5 rounded">{m.from_location.code}</span>}
                          {m.from_location && m.to_location && <span className="material-symbols-outlined text-[14px]">arrow_forward</span>}
                          {m.to_location && <span className="font-mono text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">{m.to_location.code}</span>}
                        </div>
                        {/* UC-FK-06_TC20: hoàn trả có sửa nội dung → hiển thị cũ → mới từng dòng */}
                        {(() => {
                          const nv = m.audit?.new_value as { line_changes?: LineChange[] } | undefined;
                          const changes = Array.isArray(nv?.line_changes) ? nv!.line_changes! : [];
                          if (changes.length === 0) return null;
                          return (
                            <div className="mt-1 space-y-1">
                              {changes.map((lc, i) => {
                                const keys = Array.from(new Set([...Object.keys(lc.old || {}), ...Object.keys(lc.new || {})]));
                                if (keys.length === 0) return null;
                                return (
                                  <div key={i} className="text-[11px] bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
                                    {lc.item_code && <span className="font-mono font-semibold text-amber-800 mr-1">{lc.item_code}</span>}
                                    <span className="inline-flex flex-wrap gap-x-2 gap-y-0.5">
                                      {keys.map((k) => (
                                        <span key={k}>
                                          {FIELD_LABEL[k] || k}:{" "}
                                          <span className="line-through text-on-surface-variant/60">{fmtChangeVal(k, lc.old?.[k])}</span>
                                          {" → "}
                                          <span className="font-semibold text-emerald-700">{fmtChangeVal(k, lc.new?.[k])}</span>
                                        </span>
                                      ))}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                        {m.reason && <p className="text-xs text-on-surface-variant mt-0.5 italic">{m.reason}</p>}
                        {/* Phase 6.3 — TC_FK_06_TC01: hiển thị user + role thực hiện */}
                        <div className="text-[11px] text-on-surface-variant/70 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span>{formatDateTime(m.performed_at)}</span>
                          {m.performed_by_name && (
                            <>
                              <span>·</span>
                              <span className="font-semibold text-on-surface-variant">{m.performed_by_name}</span>
                              {m.performed_by_role && (
                                <span className="text-[11px] font-bold uppercase px-1 py-0.5 rounded bg-surface-low">
                                  {ROLE_LABEL[m.performed_by_role] || m.performed_by_role}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <ListPageFooter {...pg} unit="lượt" />
            </div>
      )}
      </div>
    </div>
  );
}
