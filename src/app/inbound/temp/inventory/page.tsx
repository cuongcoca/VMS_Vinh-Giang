"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { useClientPagination, ListPageFooter } from "@/components/ui";

type Severity = "overdue" | "warning" | "new";

type TempItem = {
  line_id: string;
  temp_id: string;
  pnt_code: string;
  item_code: string;
  item_name: string;
  qty: number;
  lot: string | null;
  expiry_date: string | null;
  days_on_hand: number;
  severity: Severity;
  received_at: string;
};

type Kpis = {
  total_pending: number;       // Phếu có hàng
  total_pending_all: number;   // Tất cả phếu PENDING
  empty_temps: number;         // Phếu rỗng chưa nhập dòng
  distinct_item_codes: number;
  total_qty: number;
  overdue_count: number;
};

const SEVERITY_MAP: Record<
  Severity,
  { label: string; chip: string; text: string }
> = {
  overdue: {
    label: "Quá hạn",
    chip: "bg-rose-100 text-rose-700 border border-rose-200",
    text: "text-rose-600 font-bold",
  },
  warning: {
    label: "Sắp quá",
    chip: "bg-amber-100 text-amber-700 border border-amber-200",
    text: "text-amber-700 font-semibold",
  },
  new: {
    label: "Mới",
    chip: "bg-sky-100 text-sky-700 border border-sky-200",
    text: "text-on-surface-variant",
  },
};

const FILTER_LABELS: Record<"all" | Severity, string> = {
  all: "Tất cả",
  overdue: "Quá hạn",
  warning: "Sắp quá",
  new: "Mới",
};

export default function InboundTempInventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<TempItem[]>([]);
  const [kpis, setKpis] = useState<Kpis>({
    total_pending: 0,
    total_pending_all: 0,
    empty_temps: 0,
    distinct_item_codes: 0,
    total_qty: 0,
    overdue_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Severity>("all");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/wms/api/inbound-temp/inventory");
      const result = await res.json();
      if (result.success) {
        setItems(result.data.items);
        setKpis(result.data.kpis);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered =
    filter === "all" ? items : items.filter((it) => it.severity === filter);

  // Phân trang client-side cho danh sách tồn tạm
  const pg = useClientPagination(filtered, { resetKey: filter });
  const { paged: pagedItems } = pg;

  return (
    <AppLayout title="TỒN TẠM — THEO DÕI">
      <div className="p-6 space-y-5 min-w-0 overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-mono font-bold tracking-wider">
                UC-INTMP-03
              </span>
              Tồn tạm — Chờ chuẩn hóa
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Báo cáo riêng cho hàng đang ở trạng thái{" "}
              <b>&quot;Tồn tạm — Chờ kế toán xử lý&quot;</b>. Cảnh báo nếu quá 3
              ngày.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) router.back();
              else router.push("/inbound-adhoc");
            }}
            className="px-4 py-2 text-sm border border-outline-variant hover:bg-surface-low rounded-lg flex items-center gap-2 font-medium transition-colors text-on-surface shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">
              arrow_back
            </span>
            Danh sách phiếu tạm
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Tổng phiếu tạm"
            value={kpis.total_pending}
            color="text-on-surface"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <KpiCard
            label="Mã tạm chờ XL"
            value={kpis.distinct_item_codes}
            color="text-primary"
            active={false}
            onClick={() => setFilter("all")}
          />
          <KpiCard
            label="Tổng SL tồn tạm"
            value={kpis.total_qty}
            color="text-on-surface"
            suffix="đv"
            active={false}
            onClick={() => setFilter("all")}
          />
          <KpiCard
            label="⚠ Quá hạn (>3 ngày)"
            value={kpis.overdue_count}
            color="text-rose-600"
            active={filter === "overdue"}
            onClick={() =>
              setFilter(filter === "overdue" ? "all" : "overdue")
            }
            danger={kpis.overdue_count > 0}
          />
        </div>

        {/* Cảnh báo phiếu rỗng */}
        {kpis.empty_temps > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <span className="material-symbols-outlined text-[18px] text-amber-600">warning</span>
            <span>
              Có <b>{kpis.empty_temps}</b> phiếu tạm chưa nhập dòng hàng (phiếu rỗng) — không hiển thị trong bảng.
              <Link href="/inbound-adhoc" className="ml-2 underline font-semibold hover:text-amber-900">Xem danh sách phiếu tạm →</Link>
            </span>
          </div>
        )}

        {/* Filter chips + refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">
            Lọc:
          </span>
          {(["all", "overdue", "warning", "new"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filter === key
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-on-surface-variant border-outline-variant hover:border-primary/30"
              }`}
            >
              {FILTER_LABELS[key]}
            </button>
          ))}
          <button
            onClick={fetchData}
            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant border border-outline-variant hover:bg-surface-low flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">
              refresh
            </span>{" "}
            Làm mới
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-low/60 border-b border-outline-variant">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Mã phiếu tạm
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Mã tạm
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Tên rút gọn
                </th>
                <th className="text-right px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  SL
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Số ngày tồn
                </th>
                <th className="text-center px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-2 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-10 text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined animate-spin text-2xl text-primary">
                      progress_activity
                    </span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-[40px] opacity-30 block">
                      inbox
                    </span>
                    <span className="text-sm mt-2 block">
                      {filter === "all"
                        ? "Không có phiếu tạm nào đang chờ xử lý."
                        : `Không có dòng nào ở trạng thái "${FILTER_LABELS[filter]}".`}
                    </span>
                  </td>
                </tr>
              ) : (
                pagedItems.map((it) => {
                  const sev = SEVERITY_MAP[it.severity];
                  return (
                    <tr
                      key={it.line_id}
                      className="border-b border-outline-variant/40 hover:bg-surface-low/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-primary">
                        {it.pnt_code}
                      </td>
                      <td className="px-4 py-3 font-mono text-on-surface-variant">
                        {it.item_code}
                      </td>
                      <td className="px-4 py-3 text-on-surface">
                        {it.item_name}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        {it.qty}
                      </td>
                      <td className={`px-4 py-3 font-mono ${sev.text}`}>
                        {it.days_on_hand} ngày
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${sev.chip}`}
                        >
                          {sev.label}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-on-surface-variant/60">
                        {/* Phase 4.3 — UC-INTMP-03-TC017/_018: icon > điều hướng
                            sang chi tiết phiếu (trước fix link sang list view). */}
                        <Link
                          href={`/inbound-adhoc/${it.temp_id}`}
                          title={`Mở chi tiết phiếu ${it.pnt_code}`}
                          className="hover:text-primary inline-flex items-center"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            chevron_right
                          </span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <ListPageFooter {...pg} unit="mã hàng" />
        </div>

        {/* Footer hint */}
        <p className="text-xs text-on-surface-variant/70">
          ⓘ Quy ước: <b className="text-rose-600">Quá hạn</b> &gt; 3 ngày ·{" "}
          <b className="text-amber-700">Sắp quá</b> 2–3 ngày ·{" "}
          <b className="text-sky-700">Mới</b> &lt; 2 ngày
        </p>
      </div>
    </AppLayout>
  );
}

function KpiCard({
  label,
  value,
  color,
  suffix,
  active,
  onClick,
  danger,
}: {
  label: string;
  value: number;
  color: string;
  suffix?: string;
  active: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-white p-4 rounded-xl border shadow-sm text-left transition-all ${
        active
          ? "border-primary ring-2 ring-primary/10"
          : danger
            ? "border-rose-200 hover:border-rose-300"
            : "border-outline-variant hover:border-outline-variant"
      }`}
    >
      <span
        className={`text-[10px] font-bold uppercase tracking-wider block ${danger ? "text-rose-600" : "text-on-surface-variant"}`}
      >
        {label}
      </span>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        {suffix && (
          <span className="text-xs text-on-surface-variant">{suffix}</span>
        )}
      </div>
    </button>
  );
}
