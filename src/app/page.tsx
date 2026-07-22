"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { auth } from "@/lib/auth";
import { useSystemConfig } from "@/lib/use-system-config";

type KPI = {
  total_stock_items: number;
  total_stock_weight_kg: number;
  inbound_this_period: number;
  outbound_this_period: number;
  location_usage_percent: number;
  expiring_items_7d: number;
  expiring_items_30d: number;
  forklift_tasks_today: number;
  pallet_queue_count: number;
  open_stocktakes: number;
};

type WarehouseBin = {
  id: string;
  code: string;
  type: "STORAGE" | "INBOUND_STAGING" | "OUTBOUND_STAGING" | "STOCKTAKE";
  status: string;
};

type WarehouseMap = {
  locations: WarehouseBin[];
  total: number;
  shown: number;
  counts: Record<string, number>;
};

type InboundItem = {
  id: string;
  code: string;
  status: string;
  created_at: string;
  supplier?: { name: string } | null;
  _count?: { lines: number };
};

type AccountantKPI = {
  inbound_processing: number;
  inbound_reconciling: number;
  temp_pending: number;
  temp_lines: number;
  discrepancy_count: number;
  pending_adjustments: number;
  expiring_7d: number;
  expiring_30d: number;
  low_stock_skus: number;
  recent_updates: Array<{
    id: string;
    code: string;
    status: string;
    kind: "INBOUND" | "ADJUSTMENT";
    at: string;
  }>;
};

// ── Sơ đồ kho — màu theo trạng thái vị trí (đồng bộ với trang Vị trí kho UC-MD-05) ──
const BIN_STATUS_STYLE: Record<string, string> = {
  EMPTY: "bg-surface-low text-on-surface-variant border border-dashed border-outline-variant",
  USING: "bg-blue-50 text-blue-700 border border-blue-200",
  PARTIAL: "bg-orange-50 text-orange-700 border border-orange-200",
  FULL: "bg-rose-50 text-rose-700 border border-rose-200",
  RESERVED: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  WAITING_OUTBOUND: "bg-violet-50 text-violet-700 border border-violet-200",
  NEEDS_CHECK: "bg-purple-50 text-purple-700 border border-purple-200",
  CHECK_AGAIN: "bg-amber-50 text-amber-700 border border-amber-200",
  MAINTENANCE: "bg-gray-100 text-gray-600 border border-gray-300",
};
const BIN_STATUS_LABEL: Record<string, string> = {
  EMPTY: "Trống", USING: "Đang dùng", PARTIAL: "Còn một phần", FULL: "Đầy",
  RESERVED: "Đặt chỗ", WAITING_OUTBOUND: "Chờ xuất", NEEDS_CHECK: "Chờ kiểm kê",
  CHECK_AGAIN: "Cần kiểm tra lại", MAINTENANCE: "Khóa SD",
};
const STAGING_STYLE = "bg-secondary-container text-secondary border border-dashed border-surface-variant";

function isStaging(bin: WarehouseBin) {
  return bin.type === "INBOUND_STAGING" || bin.type === "OUTBOUND_STAGING";
}

function WarehouseMapCard({ whMap, fillPercent }: { whMap: WarehouseMap | null; fillPercent: number }) {
  const counts = whMap?.counts || {};
  const legend = [
    { label: "Trống", swatch: "bg-surface-low border border-dashed border-outline-variant", n: counts.EMPTY ?? 0, always: true },
    { label: "Đang dùng", swatch: "bg-blue-100 border border-blue-300", n: counts.USING ?? 0, always: true },
    { label: "Còn một phần", swatch: "bg-orange-100 border border-orange-300", n: counts.PARTIAL ?? 0, always: false },
    { label: "Đầy", swatch: "bg-rose-100 border border-rose-300", n: counts.FULL ?? 0, always: false },
    { label: "Khóa SD", swatch: "bg-gray-200 border border-gray-300", n: counts.MAINTENANCE ?? 0, always: false },
    { label: "Khu chờ", swatch: STAGING_STYLE, n: null as number | null, always: true },
  ].filter((it) => it.always || (it.n ?? 0) > 0);

  return (
    <Card className="p-5 rounded-lg">
      <div className="flex justify-between items-start gap-4 mb-4 flex-wrap">
        <div>
          <h4 className="label-caps text-primary">SƠ ĐỒ KHO</h4>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Trực quan hóa công suất sàn thực tế — Tỷ lệ lấp đầy:{" "}
            <span className="font-semibold text-primary">{fillPercent}%</span>
            {whMap ? <> • {whMap.total} vị trí</> : null}
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs">
          {legend.map((it) => (
            <span key={it.label} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded ${it.swatch}`}></span>
              {it.label}
              {it.n !== null ? <span className="text-on-surface-variant"> ({it.n})</span> : null}
            </span>
          ))}
        </div>
      </div>

      {!whMap || whMap.total === 0 ? (
        <div className="text-center py-10 text-on-surface-variant">
          <span className="material-symbols-outlined text-[40px] opacity-30">grid_view</span>
          <p className="mt-2 text-sm">Chưa có vị trí kho nào.</p>
          <Link href="/locations" className="text-xs text-primary hover:underline mt-1 inline-block">
            Thiết lập vị trí kho
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-8 gap-2 max-h-72 overflow-y-auto pr-1">
            {whMap.locations.map((bin) => (
              <div
                key={bin.id}
                title={`${bin.code} — ${BIN_STATUS_LABEL[bin.status] || bin.status}`}
                className={`h-10 flex items-center justify-center rounded-md text-[9px] font-semibold leading-none text-center px-0.5 overflow-hidden ${
                  isStaging(bin)
                    ? `${STAGING_STYLE} col-span-2`
                    : BIN_STATUS_STYLE[bin.status] || BIN_STATUS_STYLE.EMPTY
                }`}
              >
                {isStaging(bin) ? (
                  <span className="flex items-center gap-1 truncate">
                    <span className="material-symbols-outlined text-[14px]">
                      {bin.type === "INBOUND_STAGING" ? "login" : "logout"}
                    </span>
                    <span className="truncate">{bin.code}</span>
                  </span>
                ) : (
                  <span className="truncate w-full">{bin.code}</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-on-surface-variant">
            <span>
              {whMap.total > whMap.shown
                ? `Đang hiển thị ${whMap.shown}/${whMap.total} vị trí`
                : `Tổng ${whMap.total} vị trí`}
            </span>
            <Link href="/locations" className="text-primary hover:underline inline-flex items-center gap-1">
              {whMap.total > whMap.shown ? "Xem sơ đồ đầy đủ" : "Quản lý vị trí kho"}
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [whMap, setWhMap] = useState<WarehouseMap | null>(null);
  const [inbounds, setInbounds] = useState<InboundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState<Date | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [accKpi, setAccKpi] = useState<AccountantKPI | null>(null);
  const [accLoading, setAccLoading] = useState(true);
  // UC_SYS_01_TC12: footer đọc từ cấu hình hệ thống (footer_text) thay vì hardcode.
  const { config } = useSystemConfig();

  const isXeNang = process.env.NEXT_PUBLIC_BASE_PATH === "/xenang";
  const isThukho = process.env.NEXT_PUBLIC_BASE_PATH === "/thukho";
  const isKiemke = process.env.NEXT_PUBLIC_BASE_PATH === "/kiemke";
  const isStandaloneMobile = isXeNang || isThukho || isKiemke;

  useEffect(() => {
    if (isXeNang) {
      router.replace("/forklift");
      return;
    }
    if (isThukho) {
      router.replace("/thukho");
      return;
    }
    if (isKiemke) {
      router.replace("/kiemke");
      return;
    }

    // === LỚP BẢO VỆ 2: Mobile roles trên WMS instance → redirect sang app mobile ===
    const currentUser = auth.getUser();
    if (currentUser) {
      setRole(currentUser.role);
      setUserName(currentUser.fullName || "");
      const MOBILE_REDIRECTS: Record<string, string> = {
        XE_NANG: "/xenang/forklift",
        THU_KHO: "/thukho",
        KIEM_KE: "/kiemke",
      };
      const target = MOBILE_REDIRECTS[currentUser.role];
      if (target) {
        window.location.href = target;
        return;
      }
    }
  }, [isXeNang, isThukho, isKiemke, router]);

  // Build standalone mobile: hiển thị loading spinner trong khi redirect
  if (isStandaloneMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  useEffect(() => {
    Promise.all([
      fetch(`${basePath}/api/dashboard/kpi?period=7d`).then(r => r.json()),
      fetch(`${basePath}/api/inbound?status=&q=`).then(r => r.json()),
      fetch(`${basePath}/api/dashboard/warehouse-map`).then(r => r.json()),
    ])
      .then(([kpiRes, inboundRes, whRes]) => {
        if (kpiRes.success) setKpi(kpiRes.data);
        if (inboundRes.success) setInbounds((inboundRes.data || []).slice(0, 4));
        if (whRes.success) setWhMap(whRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [basePath]);

  // Dashboard Kế toán — fetch riêng khi role là KE_TOAN
  const isAccounting = role === "KE_TOAN";
  useEffect(() => {
    if (!isAccounting) return;
    setAccLoading(true);
    fetch(`${basePath}/api/dashboard/accountant-kpi`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setAccKpi(j.data); })
      .catch(console.error)
      .finally(() => setAccLoading(false));
  }, [isAccounting, basePath]);

  useEffect(() => {
    setClock(new Date());
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const statusBadge = (status: string) => {
    const map: Record<string, "success" | "warning" | "info" | "neutral" | "error"> = {
      DRAFT: "neutral",
      PENDING: "warning",
      RECEIVING: "info",
      RECONCILING: "info",
      COMPLETED: "success",
      CANCELLED: "error",
    };
    return <Badge variant={map[status] || "neutral"}>{status}</Badge>;
  };

  const timeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    if (diffH < 24) return `${diffH}h trước`;
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  };

  if (loading || (isAccounting && accLoading)) {
    return (
      <AppLayout title="TỔNG QUAN">
        <div className="flex items-center justify-center min-h-[60vh]">
          <span className="material-symbols-outlined animate-spin text-[40px] text-primary">progress_activity</span>
        </div>
      </AppLayout>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD KẾ TOÁN — UC-DASH-01
  // ═══════════════════════════════════════════════════════════════════
  if (isAccounting) {
    const STATUS_LABEL: Record<string, { label: string; color: string }> = {
      DRAFT: { label: "Nháp", color: "bg-surface-low text-on-surface-variant" },
      PENDING: { label: "Chờ TK", color: "bg-amber-50 text-amber-700" },
      RECEIVING: { label: "Nhận hàng", color: "bg-blue-50 text-blue-700" },
      RECONCILING: { label: "Đối chiếu", color: "bg-purple-50 text-purple-700" },
      COMPLETED: { label: "Hoàn tất", color: "bg-emerald-50 text-emerald-700" },
      CANCELLED: { label: "Hủy", color: "bg-rose-50 text-rose-600" },
      APPROVED: { label: "Đã duyệt", color: "bg-emerald-50 text-emerald-700" },
      REJECTED: { label: "Từ chối", color: "bg-rose-50 text-rose-600" },
    };

    const todayStr = new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

    return (
      <AppLayout title="TỔNG QUAN">
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              👋 Chào, {userName || "Kế toán"} — Hôm nay {todayStr}
            </h1>
            <p className="text-sm text-on-surface-variant mt-0.5">Dashboard Kế toán kho</p>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 rounded-xl border-l-4 border-l-primary">
              <p className="label-caps text-[10px] text-on-surface-variant">PHIẾU NHẬP ĐANG XỬ LÝ</p>
              <p className="data-mono text-3xl font-bold mt-1">{accKpi?.inbound_processing ?? "—"}</p>
              <p className="text-[11px] text-on-surface-variant/70 mt-1">{accKpi?.inbound_reconciling ?? 0} chờ đối chiếu</p>
            </Card>
            <Card className="p-4 rounded-xl border-l-4 border-l-amber-400">
              <p className="label-caps text-[10px] text-on-surface-variant">TỒN TẠM CHỜ CHUẨN HÓA</p>
              <p className="data-mono text-3xl font-bold mt-1 text-amber-600">{accKpi?.temp_pending ?? "—"}</p>
              <p className="text-[11px] text-on-surface-variant/70 mt-1">{accKpi?.temp_lines ?? 0} dòng</p>
            </Card>
            <Card className={`p-4 rounded-xl border-l-4 ${accKpi && accKpi.discrepancy_count > 0 ? "border-l-rose-500" : "border-l-slate-300"}`}>
              <p className="label-caps text-[10px] text-on-surface-variant">PHIẾU LỆCH SL</p>
              <p className={`data-mono text-3xl font-bold mt-1 ${accKpi && accKpi.discrepancy_count > 0 ? "text-rose-600" : ""}`}>
                {accKpi?.discrepancy_count ?? "—"}
              </p>
              <p className="text-[11px] text-on-surface-variant/70 mt-1">
                {accKpi && accKpi.discrepancy_count > 0 ? "Cần xử lý" : "Không có"}
              </p>
            </Card>
            <Card className="p-4 rounded-xl border-l-4 border-l-slate-400">
              <p className="label-caps text-[10px] text-on-surface-variant">PHIẾU ĐIỀU CHỈNH CHỜ DUYỆT</p>
              <p className="data-mono text-3xl font-bold mt-1">{accKpi?.pending_adjustments ?? "—"}</p>
              <p className="text-[11px] text-on-surface-variant/70 mt-1">&nbsp;</p>
            </Card>
          </div>

          {/* 2 cards: Cảnh báo HSD/Tồn thấp · Phiếu vừa cập nhật */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 rounded-xl">
              <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-1">
                🚨 Cảnh báo HSD / Tồn thấp
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-t border-outline-variant/50">
                    <td className="py-2">🔴 ≤ 7 ngày</td>
                    <td className="py-2 text-right"><b className="text-rose-600 data-mono">{accKpi?.expiring_7d ?? 0} lô</b></td>
                  </tr>
                  <tr className="border-t border-outline-variant/50">
                    <td className="py-2">🟡 ≤ 30 ngày</td>
                    <td className="py-2 text-right"><b className="text-amber-600 data-mono">{accKpi?.expiring_30d ?? 0} lô</b></td>
                  </tr>
                  <tr className="border-t border-outline-variant/50">
                    <td className="py-2">🔻 Dưới min</td>
                    <td className="py-2 text-right"><b className="data-mono">{accKpi?.low_stock_skus ?? 0} SKU</b></td>
                  </tr>
                </tbody>
              </table>
              <Link href="/inventory/alerts" className="text-xs text-primary hover:underline mt-3 inline-flex items-center gap-1">
                Xem chi tiết →
              </Link>
            </Card>

            <Card className="p-5 rounded-xl">
              <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-1">
                📋 Phiếu vừa cập nhật
              </h3>
              {!accKpi || accKpi.recent_updates.length === 0 ? (
                <p className="text-xs text-on-surface-variant/70 py-4 text-center">Chưa có phiếu nào</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {accKpi.recent_updates.map((r) => {
                      const st = STATUS_LABEL[r.status] || { label: r.status, color: "bg-surface-low" };
                      const href = r.kind === "INBOUND" ? `/inbound/${r.id}` : `/inventory/adjustments/${r.id}`;
                      return (
                        <tr key={`${r.kind}-${r.id}`} className="border-t border-outline-variant/50">
                          <td className="py-2 font-mono font-bold text-xs">
                            <Link href={href} className="text-primary hover:underline">{r.code}</Link>
                          </td>
                          <td className="py-2 text-right">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.color}`}>{st.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <Link href="/inbound" className="text-xs text-primary hover:underline mt-3 inline-flex items-center gap-1">
                Tất cả phiếu →
              </Link>
            </Card>
          </div>

          <footer className="text-center text-xs text-on-surface-variant py-4 label-caps">
            {config.footer_text || "© 2026 Vĩnh Giang · WMS v3.0"}
          </footer>
        </div>
      </AppLayout>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD QUẢN LÝ / ADMIN — Trung tâm Điều hành Kho (mặc định)
  // ═══════════════════════════════════════════════════════════════════
  return (
    <AppLayout title="TỔNG QUAN">
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Hero Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="headline-lg text-primary tracking-tight">
              Trung tâm Điều hành Kho
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-success live-pulse"></span>
              <p className="text-sm text-on-surface-variant">
                Trạng thái:{" "}
                <span className="text-success font-semibold">Đang hoạt động</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="data-mono headline-md text-primary">
              {clock ? clock.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).toUpperCase() : "—"}
            </p>
            <p className="label-caps text-on-surface-variant">
              {clock ? clock.toLocaleDateString("vi-VN", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : "—"} — GMT+7
            </p>
          </div>
        </div>

        {/* KPI Grid (5 cards) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4 rounded-lg">
            <span className="label-caps text-on-surface-variant">
              TỔNG TỒN KHO
            </span>
            <div className="mt-3">
              <span className="data-mono text-3xl text-primary">{kpi ? kpi.total_stock_items.toLocaleString() : "—"}</span>
              <p className="label-caps text-[10px] text-on-surface-variant mt-1">
                {kpi ? `${kpi.total_stock_weight_kg.toLocaleString()} kg` : ""}
              </p>
            </div>
          </Card>
          <Card className="p-4 rounded-lg">
            <span className="label-caps text-on-surface-variant">
              PALLET CHỜ XẾP
            </span>
            <div className="mt-3">
              <span className="data-mono text-3xl text-primary">{kpi ? kpi.pallet_queue_count : "—"}</span>
              <div className="w-full h-1 bg-surface-high mt-2 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: kpi && kpi.pallet_queue_count > 0 ? "100%" : "0%" }}></div>
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-lg">
            <span className="label-caps text-on-surface-variant">
              NHẬP KHO 7 NGÀY
            </span>
            <div className="mt-3">
              <span className="data-mono text-3xl text-primary">{kpi ? kpi.inbound_this_period : "—"}</span>
              <p className="label-caps text-[10px] text-on-surface-variant mt-1">
                Xuất: {kpi ? kpi.outbound_this_period : "—"}
              </p>
            </div>
          </Card>
          <Card className={`p-4 rounded-lg ${kpi && kpi.expiring_items_7d > 0 ? "border-l-4 border-l-error bg-error-container/10" : ""}`}>
            <span className={`label-caps ${kpi && kpi.expiring_items_7d > 0 ? "text-error" : "text-on-surface-variant"}`}>HÀNG SẮP HẾT HẠN</span>
            <div className={`mt-3 ${kpi && kpi.expiring_items_7d > 0 ? "text-error" : ""}`}>
              <span className="data-mono text-3xl">{kpi ? kpi.expiring_items_7d : "—"}</span>
              <p className="label-caps text-[10px] mt-1">≤7 NGÀY | {kpi ? kpi.expiring_items_30d : 0} ≤30 NGÀY</p>
            </div>
          </Card>
          <Card className="p-4 rounded-lg">
            <span className="label-caps text-on-surface-variant">
              TỶ LỆ LẤP ĐẦY
            </span>
            <div className="mt-3">
              <span className="data-mono text-3xl text-primary">{kpi ? `${kpi.location_usage_percent}%` : "—"}</span>
              <div className="w-full h-1 bg-surface-high mt-2 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${kpi?.location_usage_percent || 0}%` }}></div>
              </div>
            </div>
          </Card>
        </div>

        {/* Lists Row */}
        <div className="grid grid-cols-12 gap-6">
          {/* Recent Inbound */}
          <Card className="col-span-12 lg:col-span-8 p-5 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h4 className="label-caps text-primary">
                PHIẾU NHẬP KHO GẦN ĐÂY
              </h4>
              <Link href="/inbound" className="text-sm text-secondary hover:underline">
                Xem tất cả →
              </Link>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left label-caps text-on-surface-variant border-b border-surface-variant">
                  <th className="pb-2 pt-1">MÃ PHIẾU</th>
                  <th className="pb-2 pt-1">NCC</th>
                  <th className="pb-2 pt-1">TRẠNG THÁI</th>
                  <th className="pb-2 pt-1 text-right">SỐ DÒNG</th>
                  <th className="pb-2 pt-1 text-right">THỜI GIAN</th>
                </tr>
              </thead>
              <tbody>
                {inbounds.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-on-surface-variant">Chưa có phiếu nhập nào.</td>
                  </tr>
                ) : (
                  inbounds.map((ib, idx) => (
                    <tr key={ib.id} className={idx < inbounds.length - 1 ? "border-b border-surface-low" : ""}>
                      <td className="py-3 data-mono">{ib.code}</td>
                      <td>{ib.supplier?.name || "—"}</td>
                      <td>{statusBadge(ib.status)}</td>
                      <td className="text-right data-mono">{ib._count?.lines || 0}</td>
                      <td className="text-right text-on-surface-variant">
                        {timeAgo(ib.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>

          {/* Alerts & Activity */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            {/* Critical alerts */}
            <Card className={`p-5 rounded-lg ${kpi && (kpi.expiring_items_7d > 0 || kpi.pallet_queue_count > 0) ? "border-l-4 border-l-error" : ""}`}>
              <h4 className="label-caps text-error mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">
                  warning
                </span>
                CẢNH BÁO QUAN TRỌNG
              </h4>
              <div className="space-y-3">
                {kpi && kpi.expiring_items_7d > 0 && (
                  <div className="pb-3 border-b border-surface-low">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="font-semibold text-sm">
                        HSD sắp hết hạn
                      </span>
                      <span className="label-caps text-[9px] text-on-surface-variant">
                        ≤7 ngày
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {kpi.expiring_items_7d} mặt hàng hết hạn trong 7 ngày tới.
                    </p>
                  </div>
                )}
                {kpi && kpi.pallet_queue_count > 0 && (
                  <div className="pb-3 border-b border-surface-low">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="font-semibold text-sm">
                        Pallet chờ xếp
                      </span>
                      <span className="label-caps text-[9px] text-on-surface-variant">
                        Xe nâng
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {kpi.pallet_queue_count} pallet đã xác nhận, chờ xe nâng xếp vào vị trí.
                    </p>
                  </div>
                )}
                {kpi && kpi.open_stocktakes > 0 && (
                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="font-semibold text-sm">
                        Kiểm kê đang mở
                      </span>
                      <span className="label-caps text-[9px] text-on-surface-variant">
                        Kiểm kê
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {kpi.open_stocktakes} phiên kiểm kê đang tiến hành.
                    </p>
                  </div>
                )}
                {kpi && kpi.expiring_items_7d === 0 && kpi.pallet_queue_count === 0 && kpi.open_stocktakes === 0 && (
                  <p className="text-sm text-on-surface-variant text-center py-2">Không có cảnh báo nào.</p>
                )}
              </div>
            </Card>

            {/* Quick stats */}
            <Card className="p-5 rounded-lg">
              <h4 className="label-caps text-primary mb-3">
                THỐNG KÊ NHANH
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-on-surface-variant">Xe nâng hôm nay</span>
                  <span className="data-mono font-semibold">{kpi?.forklift_tasks_today || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-on-surface-variant">Kiểm kê đang mở</span>
                  <span className="data-mono font-semibold">{kpi?.open_stocktakes || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-on-surface-variant">HSD ≤30 ngày</span>
                  <span className="data-mono font-semibold text-amber-600">{kpi?.expiring_items_30d || 0}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Sơ đồ kho — dữ liệu thật từ /api/dashboard/warehouse-map */}
        <WarehouseMapCard whMap={whMap} fillPercent={kpi?.location_usage_percent || 0} />

        <footer className="text-center text-xs text-on-surface-variant py-4 label-caps">
          {config.footer_text || "© 2026 Vĩnh Giang · WMS v3.0"}
        </footer>
      </div>
    </AppLayout>
  );
}
