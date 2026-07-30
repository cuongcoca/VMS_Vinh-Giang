"use client";
import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { ExcelExport } from "@/components/ExcelExport";
import { useClientPagination, ListPageFooter, TableSkeleton } from "@/components/ui";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type InventoryItem = { item_code_id: string; item_code: string; item_name: string; group_code: string | null; group_name: string | null; unit_name: string | null; unit_symbol: string | null; available_qty: number; staging_qty: number; confirmed_qty?: number; blocked_qty?: number; sellable_qty?: number; total_qty: number; min_stock: number; max_stock: number; nearest_expiry: string | null; days_until_expiry: number | null; alert_low_stock: boolean; alert_over_max: boolean; alert_expiry: boolean; alert_blocked?: boolean; alert_out_of_stock: boolean };

// UC-INV-01: dòng lô cận date — schema từ /api/inventory/by-lot
type LotLine = {
  id: string;
  qty_box: number | string;
  lot: string | null;
  expiry_date: string | null;
  days_until_expiry: number | null;
  urgency: "critical" | "warning" | "normal";
  item_code: { id: string; code: string; short_name: string };
  pallet: {
    id: string;
    code: string;
    status: string;
    location: { code: string; zone: string } | null;
  };
};

type ExpiryLimit = 5 | 10 | 9999;

export default function InventoryPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [data, setData] = useState<InventoryItem[]>([]);
  const [lotData, setLotData] = useState<LotLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [lotLoading, setLotLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(""); // UC-INV-01-TC06: lọc theo trạng thái tồn
  // UC-INV-01: panel "Cận date" hiển thị mặc định khi mở trang
  const [showExpiryPanel, setShowExpiryPanel] = useState(true);
  const [expiryLimit, setExpiryLimit] = useState<ExpiryLimit>(5);

  useEffect(() => {
    fetch(`${basePath}/api/inventory/by-item`)
      .then(r => r.json())
      .then(r => { if (r.success) setData(r.data); })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch(`${basePath}/api/inventory/by-lot`)
      .then(r => r.json())
      .then(r => { if (r.success) setLotData(r.data); })
      .catch(console.error)
      .finally(() => setLotLoading(false));
  }, [basePath]);


  const filtered = data.filter(d => {
    // UC-INV-01-TC06: lọc theo trạng thái tồn (dựa trên cờ cảnh báo từ API)
    if (statusFilter === "out_of_stock" && !d.alert_out_of_stock) return false;
    if (statusFilter === "low" && !d.alert_low_stock) return false;
    if (statusFilter === "over" && !d.alert_over_max) return false;
    if (statusFilter === "expiry" && !d.alert_expiry) return false;
    if (statusFilter === "blocked" && !(Number(d.blocked_qty || 0) > 0)) return false;
    if (statusFilter === "normal" && (d.alert_out_of_stock || d.alert_low_stock || d.alert_over_max || d.alert_expiry || Number(d.blocked_qty || 0) > 0)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return d.item_code.toLowerCase().includes(q) || d.item_name.toLowerCase().includes(q) || (d.group_name || "").toLowerCase().includes(q);
  });

  // Phân trang CLIENT-SIDE dùng chung (TC_PENDING_004)
  // Hoãn từ khoá tìm kiếm trước khi đưa vào resetKey: nếu dùng giá trị thô thì
  // mỗi ký tự gõ là một lần nhảy về trang 1.
  const debouncedSearch = useDebouncedValue(search);
  const pg = useClientPagination(filtered, { resetKey: `${debouncedSearch}|${statusFilter}` });
  const { paged } = pg;

  // UC-INV-01: lô cận date — sort HSD gần nhất → xa nhất, lọc ≤ 30 ngày khi limit=9999
  const expiringLots = useMemo(() => {
    const sorted = [...lotData]
      .filter(l => l.days_until_expiry !== null && l.days_until_expiry !== undefined)
      .sort((a, b) => (a.days_until_expiry ?? 99999) - (b.days_until_expiry ?? 99999));
    if (expiryLimit === 9999) return sorted.filter(l => (l.days_until_expiry ?? 99999) <= 30);
    return sorted.slice(0, expiryLimit);
  }, [lotData, expiryLimit]);

  // UC-INV-01: 4 KPI theo mockup — Tổng SKU / Khả dụng / Đang chờ / Hết hàng
  const totalSKU = data.length;
  const totalAvailable = data.reduce((s, d) => s + Number(d.available_qty || 0), 0);
  const totalStaging = data.reduce((s, d) => s + Number(d.staging_qty || 0), 0);
  const totalBlocked = data.reduce((s, d) => s + Number(d.blocked_qty || 0), 0); // WVG-239
  const blockedSkuCount = data.filter(d => Number(d.blocked_qty || 0) > 0).length;
  const outOfStockCount = data.filter(d => d.alert_out_of_stock).length;
  const alertCount = data.filter(d => d.alert_low_stock || d.alert_expiry || d.alert_over_max).length;

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("vi-VN") : "—");

  const urgencyRowBg = (u: "critical" | "warning" | "normal", days: number | null) => {
    if (u === "critical") return "bg-rose-50";
    if (u === "warning" && (days ?? 99) <= 14) return "bg-amber-50";
    if (u === "warning") return "bg-yellow-50";
    return "";
  };
  const urgencyText = (days: number | null) => {
    if (days === null) return "—";
    if (days <= 7) return `${days} ngày 🔴`;
    if (days <= 30) return `${days} ngày 🟡`;
    return `${days} ngày`;
  };

  return (
    <AppLayout title="TỒN KHO">
      <div className="p-6 space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">Tồn kho theo Mã hàng</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">SL khả dụng (sẵn sàng xuất) và SL chờ (đang chờ xếp/di chuyển)</p>
          </div>
          <ExcelExport
            data={filtered as unknown as Record<string, unknown>[]}
            columns={[
              { key: "item_code", header: "Mã hàng" },
              { key: "item_name", header: "Tên hàng" },
              { key: "group_name", header: "Nhóm" },
              { key: "unit_symbol", header: "ĐVT" },
              { key: "available_qty", header: "Khả dụng" },
              { key: "staging_qty", header: "Đang chờ" },
              { key: "total_qty", header: "Tổng" },
              { key: "min_stock", header: "Min" },
              { key: "max_stock", header: "Max" },
              { key: "nearest_expiry", header: "HSD gần nhất", transform: (v) => v ? new Date(v as string).toLocaleDateString("vi-VN") : "" },
            ]}
            filename="ton_kho_theo_ma_hang"
          />
        </div>

        {/* UC-INV-01: ⭐ Panel "Cận date" mặc định ở trên cùng */}
        {showExpiryPanel && (
          <div className="rounded-xl border border-error/30 bg-error-container/30 p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="font-bold text-rose-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  Cận date — Vị trí có HSD gần ngày hiện tại nhất
                </div>
                <div className="text-[11px] text-on-surface-variant mt-0.5">
                  Mặc định hiện khi mở màn hình tồn kho · cảnh báo trực quan các ô cần xuất gấp (FEFO).
                </div>
              </div>
              <div className="flex gap-1.5 items-center">
                <select
                  value={expiryLimit}
                  onChange={(e) => setExpiryLimit(Number(e.target.value) as ExpiryLimit)}
                  className="px-2 py-1 text-xs rounded border border-outline-variant bg-white font-semibold"
                >
                  <option value={5}>Top 5</option>
                  <option value={10}>Top 10</option>
                  <option value={9999}>Tất cả ≤ 30 ngày</option>
                </select>
                <button
                  onClick={() => setShowExpiryPanel(false)}
                  className="px-2.5 py-1 text-xs rounded border border-outline-variant bg-white hover:bg-surface-low font-semibold"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg overflow-hidden border border-rose-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-low border-b border-outline-variant">
                    <th className="text-left px-3 py-2 font-semibold text-on-surface-variant">Vị trí</th>
                    <th className="text-left px-3 py-2 font-semibold text-on-surface-variant">Mã hàng</th>
                    <th className="text-left px-3 py-2 font-semibold text-on-surface-variant">Tên</th>
                    <th className="text-left px-3 py-2 font-semibold text-on-surface-variant">Lô</th>
                    <th className="text-left px-3 py-2 font-semibold text-on-surface-variant">HSD</th>
                    <th className="text-right px-3 py-2 font-semibold text-on-surface-variant">Còn lại</th>
                    <th className="text-right px-3 py-2 font-semibold text-on-surface-variant">SL</th>
                    <th className="text-center px-3 py-2 font-semibold text-on-surface-variant"></th>
                  </tr>
                </thead>
                <tbody>
                  {lotLoading ? (
                    <tr><td colSpan={8} className="text-center py-6 text-on-surface-variant">
                      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    </td></tr>
                  ) : expiringLots.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-6 text-on-surface-variant">
                      ✓ Không có lô nào cận date (≤ 30 ngày).
                    </td></tr>
                  ) : (
                    expiringLots.map(l => {
                      const days = l.days_until_expiry;
                      const isUrgent = (days ?? 999) <= 14;
                      return (
                        <tr key={l.id} className={`border-b border-outline-variant/50 ${urgencyRowBg(l.urgency, days)}`}>
                          <td className="px-3 py-2 font-mono font-bold">{l.pallet.location?.code || l.pallet.code}</td>
                          <td className="px-3 py-2 font-mono font-semibold text-primary">{l.item_code.code}</td>
                          <td className="px-3 py-2 text-on-surface-variant">{l.item_code.short_name}</td>
                          <td className="px-3 py-2 font-mono text-on-surface-variant">{l.lot || "—"}</td>
                          <td className="px-3 py-2 font-mono font-semibold">{formatDate(l.expiry_date)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${l.urgency === "critical" ? "text-rose-600" : l.urgency === "warning" ? "text-amber-600" : "text-on-surface-variant"}`}>
                            {urgencyText(days)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{Number(l.qty_box)}</td>
                          <td className="px-3 py-2 text-center">
                            {isUrgent ? (
                              <Link
                                href={`/inventory/by-lot`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500 text-white rounded text-[10px] font-bold hover:bg-rose-600"
                              >
                                Xuất gấp
                              </Link>
                            ) : (
                              <Link
                                href={`/inventory/by-lot`}
                                className="text-xs text-on-surface-variant hover:text-primary"
                              >
                                Xem
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-[10.5px] text-on-surface-variant mt-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">settings</span>
              Ngưỡng cảnh báo: 🔴 ≤7 ngày · 🟡 ≤30 ngày — cấu hình tại{" "}
              <Link href="/inventory/alerts" className="text-primary font-semibold hover:underline ml-0.5">
                Cảnh báo (UC-INV-05)
              </Link>
            </div>
          </div>
        )}
        {!showExpiryPanel && (
          <button
            onClick={() => setShowExpiryPanel(true)}
            className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">warning</span>
            Hiện lại panel "Cận date" ({expiringLots.length} lô)
          </button>
        )}

        {/* Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { href: "/inventory", icon: "inventory_2", label: "Theo mã hàng", active: true, color: "text-primary bg-primary/10" },
            { href: "/inventory/by-location", icon: "grid_view", label: "Theo vị trí", color: "text-blue-600 bg-blue-50" },
            { href: "/inventory/by-pallet", icon: "pallet", label: "Theo pallet", color: "text-indigo-600 bg-indigo-50" },
            { href: "/inventory/by-lot", icon: "event", label: "Theo lô/HSD", color: "text-amber-600 bg-amber-50" },
            { href: "/inventory/alerts", icon: "warning", label: "Cảnh báo", count: alertCount, color: alertCount > 0 ? "text-rose-600 bg-rose-50" : "text-on-surface-variant bg-surface-low" },
          ].map(n => (
            <Link key={n.href} href={n.href} className={`p-3 rounded-xl border shadow-sm flex items-center gap-2.5 transition-all hover:shadow-md ${n.active ? "border-primary ring-2 ring-primary/10" : "border-outline-variant"}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${n.color}`}><span className="material-symbols-outlined text-[18px]">{n.icon}</span></div>
              <div><p className="text-xs font-semibold text-on-surface">{n.label}</p>{n.count !== undefined && <p className="text-[10px] text-rose-500 font-bold">{n.count} cảnh báo</p>}</div>
            </Link>
          ))}
        </div>

        {/* UC-INV-01: 4 KPI khớp mockup — Tổng SKU / Khả dụng / Đang chờ / Hết hàng */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white p-3.5 rounded-xl border shadow-sm">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase">Tổng SKU</span>
            <span className="text-xl font-bold mt-1 block">{totalSKU}</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border shadow-sm">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase">Khả dụng</span>
            <span className="text-xl font-bold mt-1 block text-emerald-600 font-mono">{totalAvailable.toLocaleString()}</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border shadow-sm">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase">Đang chờ</span>
            <span className="text-xl font-bold mt-1 block text-amber-600 font-mono">{totalStaging.toLocaleString()}</span>
          </div>
          {/* WVG-239: SL hàng hết hạn bị chặn xuất */}
          <div className="bg-white p-3.5 rounded-xl border shadow-sm" title={`${blockedSkuCount} mã có hàng hết hạn`}>
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase">Chặn xuất (HSD)</span>
            <span className={`text-xl font-bold mt-1 block font-mono ${totalBlocked > 0 ? "text-rose-600" : "text-on-surface-variant"}`}>{totalBlocked.toLocaleString()}</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border shadow-sm">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase">Hết hàng</span>
            <span className={`text-xl font-bold mt-1 block ${outOfStockCount > 0 ? "text-rose-600" : "text-on-surface-variant"}`}>{outOfStockCount}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1"><span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span><input type="text" placeholder="Tìm mã hàng, tên, nhóm..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-lg text-sm" /></div>
          {/* UC-INV-01-TC06: lọc theo Trạng thái tồn */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white min-w-[160px]">
            <option value="">— Tất cả trạng thái —</option>
            <option value="normal">Bình thường</option>
            <option value="low">Dưới min</option>
            <option value="over">Vượt max</option>
            <option value="expiry">Sắp hết hạn (≤30 ngày)</option>
            <option value="blocked">Đã hết hạn (chặn xuất)</option>
          </select>
        </div>

        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead><tr className="bg-surface-low/50 border-b border-outline-variant">
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Mã hàng</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tên</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Nhóm</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">ĐVT</th>
                <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Khả dụng</th>
                <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Đang chờ</th>
                <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant" title="Hàng hết hạn — bị chặn xuất">Chặn (HSD)</th>
                <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tổng tồn</th>
                <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden lg:table-cell">Min / Max</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">HSD gần nhất</th>
                <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Hành động</th>
              </tr></thead>
              <tbody>
                {loading ? <TableSkeleton rows={10} cols={11} />
                : filtered.length === 0 ? <tr><td colSpan={11} className="text-center py-12 text-on-surface-variant">Không có dữ liệu.</td></tr>
                : paged.map(d => (
                  <tr key={d.item_code_id} className="border-b border-outline-variant/40 hover:bg-surface-low/50">
                    <td className="px-4 py-2.5 font-mono font-bold text-primary text-sm">{d.item_code}</td>
                    <td className="px-4 py-2.5">{d.item_name}</td>
                    <td className="px-4 py-2.5 text-xs hidden md:table-cell">{(d.group_name || d.group_code) ? <span className="inline-flex px-1.5 py-0.5 rounded bg-surface-low text-on-surface-variant font-semibold" title={d.group_code || ""}>{d.group_name || d.group_code}</span> : <span className="text-on-surface-variant/70">—</span>}</td>
                    <td className="px-4 py-2.5 text-xs hidden md:table-cell text-on-surface-variant font-medium">{d.unit_symbol || d.unit_name || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-600">{d.available_qty}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-amber-600">{d.staging_qty || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{Number(d.blocked_qty || 0) > 0 ? <span className="text-rose-600 font-semibold" title="Hàng hết hạn — chặn xuất">{d.blocked_qty}</span> : <span className="text-on-surface-variant/60">—</span>}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold">{d.total_qty}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs hidden lg:table-cell text-on-surface-variant">
                      {d.min_stock || "—"} / {d.max_stock || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs hidden md:table-cell">{d.nearest_expiry ? new Date(d.nearest_expiry).toLocaleDateString("vi-VN") : "—"}</td>
                    <td className="px-4 py-2.5 text-center">
                      {Number(d.blocked_qty || 0) > 0 ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700" title="Có hàng hết hạn — chặn xuất">Hết hạn</span>
                      ) : d.alert_low_stock ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600">Dưới min</span>
                      ) : d.alert_out_of_stock ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-mid text-on-surface">Hết hàng</span>
                      ) : d.alert_over_max ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-600">Vượt max</span>
                      ) : (
                        <Link
                          href={`/inventory/by-sku/${encodeURIComponent(d.item_code)}/locations`}
                          className="inline-flex items-center gap-0.5 px-2 py-1 text-[11px] font-semibold border border-outline-variant rounded-lg hover:bg-surface-low hover:border-primary"
                        >
                          Chi tiết →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <ListPageFooter {...pg} unit="mã hàng" />
      </div>
    </AppLayout>
  );
}
