"use client";

/**
 * UC-DASH-02: Dashboard tổng quan cho Quản lý.
 * - 4 KPI top: SKU / Tồn / Pallet đang dùng / Cảnh báo
 * - 4 card: Tồn theo nhóm hàng · Top mã xuất tương đối · Cảnh báo HSD · Phiếu chờ xử lý
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";

type ManagerKPI = {
  period: "day" | "week" | "month";
  total_sku: number;
  total_stock: number;
  pallets_used: number;
  total_locations: number;
  alerts: number;
  by_group: { code: string; name: string; qty: number; pct: number }[];
  top_outbound: { rank: number; item_code: string; item_name: string; qty: number }[];
  expiring: { d7_lots: number; d7_qty: number; d30_lots: number; d30_qty: number; safe_lots: number; safe_qty: number };
  pending: { inbound: number; inbound_temp: number; pallets_waiting: number; pallets_moving: number; adjustments: number };
};

export default function ManagerDashboardPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [kpi, setKpi] = useState<ManagerKPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"day" | "week" | "month">("month");

  const loadKpi = (p: typeof period) => {
    setLoading(true);
    fetch(`${basePath}/api/dashboard/manager-kpi?period=${p}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setKpi(j.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadKpi(period); }, [period]);

  return (
    <AppLayout title="DASHBOARD QUẢN LÝ">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[28px]">analytics</span>
              📊 Dashboard Quản lý
            </h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Tổng quan toàn bộ kho — {new Date().toLocaleDateString("vi-VN")}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as typeof period)}
              className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white font-semibold"
            >
              <option value="day">Hôm nay</option>
              <option value="week">Tuần này</option>
              <option value="month">Tháng này</option>
            </select>
            <button
              onClick={() => loadKpi(period)}
              className="px-3 py-2 text-sm border border-outline-variant rounded-lg hover:bg-surface-low flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Làm mới
            </button>
          </div>
        </div>

        {loading || !kpi ? (
          <div className="flex justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
          </div>
        ) : (
          <>
            {/* UC-DASH-02: 4 KPI top */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm">
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase">Tổng SKU</p>
                <p className="text-2xl font-bold mt-0.5 font-mono">{kpi.total_sku.toLocaleString()}</p>
                <p className="text-[10px] text-emerald-600 mt-0.5">Sản phẩm đang dùng</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm">
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase">Tổng tồn (đơn vị)</p>
                <p className="text-2xl font-bold mt-0.5 font-mono">{kpi.total_stock.toLocaleString()}</p>
                <p className="text-[10px] text-emerald-600 mt-0.5">Khả dụng + chờ</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm">
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase">Pallet đang dùng</p>
                <p className="text-2xl font-bold mt-0.5 font-mono">
                  {kpi.pallets_used}<span className="text-sm font-normal text-on-surface-variant/70">/{kpi.total_locations}</span>
                </p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  {kpi.total_locations > 0
                    ? `${Math.round((kpi.pallets_used / kpi.total_locations) * 100)}% lấp đầy`
                    : "—"}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm" style={{ borderLeftWidth: 4, borderLeftColor: "rgb(244 63 94)" }}>
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase">Cảnh báo</p>
                <p className={`text-2xl font-bold mt-0.5 font-mono ${kpi.alerts > 0 ? "text-rose-600" : "text-on-surface-variant"}`}>
                  {kpi.alerts}
                </p>
                <p className="text-[10px] text-rose-500 mt-0.5">
                  {kpi.expiring.d7_lots > 0 ? `${kpi.expiring.d7_lots} nguy cấp ≤7d` : "An toàn"}
                </p>
              </div>
            </div>

            {/* 4 card chính */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Tồn theo nhóm hàng */}
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
                <h4 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-1">
                  📊 Tồn theo nhóm hàng
                </h4>
                {kpi.by_group.length === 0 ? (
                  <p className="text-xs text-on-surface-variant/70 py-4 text-center">Chưa có dữ liệu</p>
                ) : (
                  <div className="space-y-2.5">
                    {kpi.by_group.map((g) => (
                      <div key={g.code}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{g.name}</span>
                          <b className="font-mono">{g.qty.toLocaleString()}</b>
                        </div>
                        <div className="h-1.5 bg-surface-low rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${g.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card 2: Top mã xuất tương đối */}
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
                <h4 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-1">
                  🏆 Top mã xuất tương đối ({period === "day" ? "hôm nay" : period === "week" ? "tuần" : "tháng"})
                </h4>
                {kpi.top_outbound.length === 0 ? (
                  <p className="text-xs text-on-surface-variant/70 py-4 text-center">Chưa có giao dịch xuất trong kỳ</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {kpi.top_outbound.map((t) => (
                        <tr key={t.rank} className="border-t border-outline-variant/50">
                          <td className="py-2">
                            <span className="text-on-surface-variant/70 mr-1.5">{t.rank}.</span>
                            <b className="font-mono text-primary text-xs">{t.item_code}</b>
                            <span className="text-on-surface-variant ml-1.5 text-xs">{t.item_name}</span>
                          </td>
                          <td className="py-2 text-right font-mono font-bold">{t.qty.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Card 3: Cảnh báo HSD */}
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
                <h4 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-1">
                  📅 Cảnh báo HSD
                </h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-t border-outline-variant/50">
                      <td className="py-2"><span className="text-rose-600 font-semibold">🔴 ≤ 7 ngày</span></td>
                      <td className="py-2 text-right">
                        <b className="text-rose-600">{kpi.expiring.d7_lots} lô</b>
                        <span className="text-on-surface-variant/70 text-xs ml-2 font-mono">{kpi.expiring.d7_qty.toLocaleString()}</span>
                      </td>
                    </tr>
                    <tr className="border-t border-outline-variant/50">
                      <td className="py-2"><span className="text-amber-600 font-semibold">🟡 ≤ 30 ngày</span></td>
                      <td className="py-2 text-right">
                        <b className="text-amber-600">{kpi.expiring.d30_lots} lô</b>
                        <span className="text-on-surface-variant/70 text-xs ml-2 font-mono">{kpi.expiring.d30_qty.toLocaleString()}</span>
                      </td>
                    </tr>
                    <tr className="border-t border-outline-variant/50">
                      <td className="py-2"><span className="text-emerald-600 font-semibold">🟢 &gt; 30 ngày</span></td>
                      <td className="py-2 text-right">
                        <b className="text-emerald-600">{kpi.expiring.safe_lots} lô</b>
                        <span className="text-on-surface-variant/70 text-xs ml-2 font-mono">{kpi.expiring.safe_qty.toLocaleString()}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <Link href="/inventory/alerts" className="text-xs text-primary hover:underline mt-3 inline-flex items-center gap-1">
                  Trung tâm cảnh báo →
                </Link>
              </div>

              {/* Card 4: Phiếu chờ xử lý */}
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
                <h4 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-1">
                  📋 Phiếu chờ xử lý
                </h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-t border-outline-variant/50">
                      <td className="py-2">Phiếu nhập có slip</td>
                      <td className="py-2 text-right">
                        <Link href="/inbound" className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 hover:bg-amber-100">
                          {kpi.pending.inbound}
                        </Link>
                      </td>
                    </tr>
                    <tr className="border-t border-outline-variant/50">
                      <td className="py-2">Phiếu nhập tồn tạm</td>
                      <td className="py-2 text-right">
                        <Link href="/inbound-adhoc" className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 hover:bg-amber-100">
                          {kpi.pending.inbound_temp}
                        </Link>
                      </td>
                    </tr>
                    <tr className="border-t border-outline-variant/50">
                      <td className="py-2">Pallet chờ xếp</td>
                      <td className="py-2 text-right">
                        <Link href="/forklift" className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 hover:bg-amber-100">
                          {kpi.pending.pallets_waiting}
                        </Link>
                      </td>
                    </tr>
                    <tr className="border-t border-outline-variant/50">
                      <td className="py-2">Pallet đang di chuyển</td>
                      <td className="py-2 text-right">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-low text-on-surface-variant">
                          {kpi.pending.pallets_moving}
                        </span>
                      </td>
                    </tr>
                    <tr className="border-t border-outline-variant/50">
                      <td className="py-2">Phiếu điều chỉnh chờ duyệt</td>
                      <td className="py-2 text-right">
                        <Link href="/inventory/adjustments" className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100">
                          {kpi.pending.adjustments}
                        </Link>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
