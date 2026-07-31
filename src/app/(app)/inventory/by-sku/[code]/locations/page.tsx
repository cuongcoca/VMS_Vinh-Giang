"use client";

/**
 * UC-INV-01.B: Drill-down từ /inventory — DS các vị trí chứa mã hàng cụ thể.
 *
 * Khi bấm "Chi tiết →" trên trang tồn kho theo mã hàng → mở trang này.
 * Sắp xếp: HSD xa nhất → đẩy lên top (giúp xác định hàng tồn lâu nhất / sản xuất gần đây hơn).
 */

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";

type ItemMeta = {
  id: string;
  code: string;
  short_name: string;
  full_name: string | null;
  unit?: { id: string; name: string; symbol: string | null } | null;
  group?: { id: string; code: string; name: string } | null;
  product?: { id: string; sku: string; name: string; min_stock: number; max_stock: number } | null;
};

type LocationLine = {
  id: string;
  location_code: string | null;
  location_zone: string | null;
  pallet_code: string | null;
  pallet_status: string | null;
  inbound_code: string | null;
  lot: string | null;
  expiry_date: string | null;
  qty_box: number;
  is_staging: boolean;
};

type DrillDownData = {
  item: ItemMeta;
  total_qty: number;
  location_count: number;
  lines: LocationLine[];
};

export default function InventoryBySkuLocationsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [data, setData] = useState<DrillDownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<"expiry_desc" | "expiry_asc">("expiry_desc");

  useEffect(() => {
    setLoading(true);
    fetch(`${basePath}/api/inventory/by-item/${encodeURIComponent(code)}?order=${order}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setData(j.data);
          setError(null);
        } else {
          setError(j.error || "Không lấy được dữ liệu");
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [basePath, code, order]);

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("vi-VN") : "—");
  const formatNsx = (expiryDate: string | null, monthsShelfLife = 24) => {
    if (!expiryDate) return "—";
    // Ước lượng NSX = HSD - shelfLife (mặc định 24 tháng)
    const d = new Date(expiryDate);
    d.setMonth(d.getMonth() - monthsShelfLife);
    return d.toLocaleDateString("vi-VN");
  };

  return (
    <AppLayout title="CHI TIẾT VỊ TRÍ">
      <div className="p-6 space-y-5">
        <div>
          <div className="mb-2"><BackButton fallback="/inventory">Tồn kho theo mã hàng</BackButton></div>
          {data && (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-primary">
                {data.item.code} — {data.item.short_name}
              </h1>
              {data.item.full_name && (
                <p className="text-sm text-on-surface-variant mt-0.5">{data.item.full_name}</p>
              )}
            </>
          )}
        </div>

        {loading && (
          <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-12 text-center">
            <span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
            <span className="material-symbols-outlined text-[18px] align-middle mr-1">error</span>
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* Summary card */}
            <div className="bg-surface-low rounded-xl border border-outline-variant p-4 flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <p className="text-xs font-semibold text-on-surface-variant uppercase">Tổng tồn</p>
                <p className="text-2xl font-bold mt-0.5 font-mono">
                  {data.total_qty.toLocaleString()}
                  <span className="text-sm font-normal text-on-surface-variant ml-1">
                    {data.item.unit?.symbol || data.item.unit?.name || "đv"}
                  </span>
                </p>
              </div>
              <div className="flex-1 min-w-[150px]">
                <p className="text-xs font-semibold text-on-surface-variant uppercase">Số vị trí</p>
                <p className="text-2xl font-bold mt-0.5 text-blue-600">{data.location_count}</p>
              </div>
              {data.item.group && (
                <div className="flex-1 min-w-[120px]">
                  <p className="text-xs font-semibold text-on-surface-variant uppercase">Nhóm</p>
                  <p className="text-sm font-semibold mt-0.5">{data.item.group.name}</p>
                </div>
              )}
              {data.item.product && (
                <div className="flex-1 min-w-[140px]">
                  <p className="text-xs font-semibold text-on-surface-variant uppercase">SKU chuẩn</p>
                  <p className="text-sm font-mono font-bold mt-0.5 text-emerald-700">{data.item.product.sku}</p>
                </div>
              )}
            </div>

            {/* Sort hint */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-primary font-semibold">
                📌 Sắp xếp: <b>{order === "expiry_desc" ? "Date xa nhất → top" : "HSD gần nhất → top"}</b> · {data.lines.length} dòng
                <span className="ml-2 text-on-surface-variant font-normal">
                  ({order === "expiry_desc"
                    ? "Giúp xác định hàng tồn lâu cần ưu tiên xuất"
                    : "FEFO — ưu tiên xuất HSD sắp hết"})
                </span>
              </p>
              <select
                value={order}
                onChange={(e) => setOrder(e.target.value as "expiry_desc" | "expiry_asc")}
                className="px-3 py-1.5 text-xs border border-outline-variant rounded-lg bg-white font-semibold"
              >
                <option value="expiry_desc">HSD xa nhất → top</option>
                <option value="expiry_asc">HSD gần nhất → top (FEFO)</option>
              </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 800 }}>
                  <thead>
                    <tr className="bg-surface-low border-b border-outline-variant">
                      <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Vị trí</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Pallet</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Lô</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden lg:table-cell">NSX (ước tính)</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">HSD</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">SL còn</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Trạng thái</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden lg:table-cell">Nguồn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lines.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-on-surface-variant">
                          Không có vị trí nào chứa mã này.
                        </td>
                      </tr>
                    ) : (
                      data.lines.map((line, idx) => {
                        const isFirstRow = idx === 0; // Date xa nhất (★)
                        return (
                          <tr
                            key={line.id}
                            className={`border-b border-outline-variant/40 ${
                              line.is_staging ? "bg-amber-50" : isFirstRow && order === "expiry_desc" ? "bg-orange-50/40" : ""
                            }`}
                          >
                            <td className="px-4 py-2.5 font-mono font-bold text-primary text-sm">
                              {line.is_staging ? (
                                <span className="text-amber-700">⚠ STAGING-OUT</span>
                              ) : (
                                line.location_code || "—"
                              )}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs">{line.pallet_code}</td>
                            <td className="px-4 py-2.5 text-xs text-on-surface-variant hidden md:table-cell">{line.lot || "—"}</td>
                            <td className="px-4 py-2.5 text-xs hidden lg:table-cell text-on-surface-variant">{formatNsx(line.expiry_date)}</td>
                            <td className="px-4 py-2.5">
                              <span className="font-mono font-semibold">{formatDate(line.expiry_date)}</span>
                              {isFirstRow && order === "expiry_desc" && (
                                <span className="ml-1 text-[10px] text-amber-600 font-bold">★ xa nhất</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold">{line.qty_box.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-center">
                              {line.is_staging ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">Chờ xuất</span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">Khả dụng</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-on-surface-variant hidden lg:table-cell">
                              {line.inbound_code ? (
                                <Link href={`/inbound`} className="text-primary hover:underline">📥 {line.inbound_code}</Link>
                              ) : (
                                <span className="text-on-surface-variant/50">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[11px] text-on-surface-variant italic">
              ★ Dòng nền cam = Date xa nhất (sản xuất gần đây hơn so với các lô khác cùng SKU) ·
              {" "}🟡 Dòng nền vàng = đang ở khu chờ xuất (staging-out).
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
