"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { mobileHref } from "@/lib/mobile-href";

type PalletItem = {
  id: string;
  code: string;
  status: string;
  total_lines: number;
  total_weight_kg: string;
  created_at: string;
  supplier: { id: string; code: string; name: string } | null;
};

export default function ThukhoMobileDashboard() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [inboundPending, setInboundPending] = useState(0);
  const [inboundReceiving, setInboundReceiving] = useState(0);
  const [tempCount, setTempCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [recentPallets, setRecentPallets] = useState<PalletItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [palletsRes, inboundRes, tempRes, alertsRes] = await Promise.all([
        fetch(`${basePath}/api/pallets`),
        fetch(`${basePath}/api/inbound`),
        fetch(`${basePath}/api/inbound-temp/summary`).catch(() => null),
        fetch(`${basePath}/api/inventory/alerts`).catch(() => null),
      ]);

      const pJson = await palletsRes.json();
      if (pJson.success) {
        if (pJson.kpis) setKpis(pJson.kpis);
        if (pJson.data) setRecentPallets(pJson.data.slice(0, 5));
      }

      const iJson = await inboundRes.json();
      if (iJson.success && iJson.data) {
        setInboundPending(iJson.data.filter((r: { status: string }) => r.status === "PENDING").length);
        setInboundReceiving(iJson.data.filter((r: { status: string }) => r.status === "RECEIVING").length);
      }

      if (tempRes) {
        const tJson = await tempRes.json();
        if (tJson.success) setTempCount(tJson.data?.total_receipts || 0);
      }

      if (alertsRes) {
        const aJson = await alertsRes.json();
        if (aJson.success) setAlertCount(aJson.data?.length || 0);
      }
    } catch (err) {
      console.error("Error fetching dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COUNTING": return "bg-amber-100 text-amber-700";
      case "CONFIRMED": return "bg-blue-100 text-blue-700";
      case "IN_STORAGE": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "COUNTING": return "Đang đếm";
      case "CONFIRMED": return "Chờ xếp";
      case "IN_STORAGE": return "Trong kho";
      default: return status;
    }
  };

  return (
    <div className="flex flex-col gap-lg px-margin-mobile py-md">
      {/* KPI Overview */}
      <section className="flex flex-col gap-sm">
        <div className="flex justify-between items-center">
          <h2 className="font-mono text-[11px] md:text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Trạng thái kho hàng
          </h2>
          <button onClick={fetchData} className="text-xs text-secondary font-semibold hover:underline flex items-center gap-0.5">
            <span className="material-symbols-outlined text-xs">refresh</span> Làm mới
          </button>
        </div>

        <div className="flex sm:grid sm:grid-cols-4 overflow-x-auto sm:overflow-visible gap-gutter custom-scroll-hide pb-xs -mx-margin-mobile sm:mx-0 px-margin-mobile sm:px-0">
          {/* KPI 1: Pallet đang đếm */}
          <div className="industrial-card min-w-[140px] sm:min-w-0 flex-1 p-md rounded-xl flex flex-col gap-xs shadow-sm bg-surface">
            <span className="text-[11px] md:text-xs font-medium text-on-surface-variant/80">Đang thêm hàng</span>
            <div className="flex items-baseline gap-xs mt-1">
              <span className="text-3xl font-bold font-jetbrains text-primary">
                {loading ? "—" : (kpis.COUNTING || 0)}
              </span>
              <span className="text-xs text-on-surface-variant">pallet</span>
            </div>
            <div className="h-1 w-full bg-surface-variant rounded-full overflow-hidden mt-2">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, (kpis.COUNTING || 0) * 10)}%` }}></div>
            </div>
          </div>

          {/* KPI 2: Chờ xe nâng */}
          <div className="industrial-card min-w-[140px] sm:min-w-0 flex-1 p-md rounded-xl flex flex-col gap-xs shadow-sm bg-surface">
            <span className="text-[11px] md:text-xs font-medium text-on-surface-variant/80">Chờ xe nâng</span>
            <div className="flex items-baseline gap-xs mt-1">
              <span className="text-3xl font-bold font-jetbrains text-secondary">
                {loading ? "—" : (kpis.CONFIRMED || 0)}
              </span>
              <span className="text-xs text-on-surface-variant">pallet</span>
            </div>
            <div className="h-1 w-full bg-surface-variant rounded-full overflow-hidden mt-2">
              <div className="h-full bg-secondary" style={{ width: `${Math.min(100, (kpis.CONFIRMED || 0) * 10)}%` }}></div>
            </div>
          </div>

          {/* KPI 3: Phiếu chờ nhận */}
          <div className="industrial-card min-w-[140px] sm:min-w-0 flex-1 p-md rounded-xl flex flex-col gap-xs shadow-sm bg-surface">
            <span className="text-[11px] md:text-xs font-medium text-on-surface-variant/80">Phiếu chờ nhận</span>
            <div className="flex items-baseline gap-xs mt-1">
              <span className="text-3xl font-bold font-jetbrains text-amber-600">
                {loading ? "—" : inboundPending}
              </span>
              <span className="text-xs text-on-surface-variant">phiếu</span>
            </div>
            <div className="h-1 w-full bg-surface-variant rounded-full overflow-hidden mt-2">
              <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, inboundPending * 15)}%` }}></div>
            </div>
          </div>

          {/* KPI 4: Cảnh báo HSD */}
          <div className="industrial-card min-w-[140px] sm:min-w-0 flex-1 p-md rounded-xl flex flex-col gap-xs shadow-sm bg-surface">
            <span className="text-[11px] md:text-xs font-medium text-on-surface-variant/80">Cảnh báo HSD</span>
            <div className="flex items-baseline gap-xs mt-1">
              <span className="text-3xl font-bold font-jetbrains text-error">
                {loading ? "—" : alertCount}
              </span>
              <span className="text-xs text-on-surface-variant">mã</span>
            </div>
            <div className="h-1 w-full bg-surface-variant rounded-full overflow-hidden mt-2">
              <div className="h-full bg-error" style={{ width: `${Math.min(100, alertCount * 8)}%` }}></div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-gutter">
        <Link href={mobileHref("/thukho/pallet/new")} className="industrial-card flex flex-col items-center justify-center py-lg gap-sm rounded-xl active:bg-surface-variant/30 hover:border-primary/50 transition-all text-center">
          <span className="material-symbols-outlined text-secondary text-[32px] font-bold">add_box</span>
          <span className="text-body-md font-bold text-primary">Tạo pallet</span>
        </Link>
        <Link href={mobileHref("/thukho/inbound")} className="industrial-card flex flex-col items-center justify-center py-lg gap-sm rounded-xl active:bg-surface-variant/30 hover:border-primary/50 transition-all text-center">
          <span className="material-symbols-outlined text-secondary text-[32px] font-bold">input</span>
          <span className="text-body-md font-bold text-primary">Tiếp nhận hàng</span>
        </Link>
        <Link href={mobileHref("/thukho/adhoc/new")} className="industrial-card flex flex-col items-center justify-center py-lg gap-sm rounded-xl active:bg-surface-variant/30 hover:border-primary/50 transition-all text-center">
          <span className="material-symbols-outlined text-secondary text-[32px] font-bold">note_add</span>
          <span className="text-body-md font-bold text-primary">Nhập đột xuất</span>
        </Link>
        <Link href={mobileHref("/thukho/item-code/new")} className="industrial-card flex flex-col items-center justify-center py-lg gap-sm rounded-xl active:bg-surface-variant/30 hover:border-primary/50 transition-all text-center">
          <span className="material-symbols-outlined text-secondary text-[32px] font-bold">qr_code_2</span>
          <span className="text-body-md font-bold text-primary">Tạo mã hàng</span>
        </Link>
      </section>

      {/* Temp Stock Alert */}
      {tempCount > 0 && (
        <Link href={mobileHref("/thukho/adhoc")} className="industrial-card border-none bg-amber-50 p-md rounded-xl flex gap-md items-center shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-amber-600 text-[28px]">pending_actions</span>
          </div>
          <div className="flex flex-col gap-xs flex-1">
            <span className="font-mono text-[9px] font-bold text-amber-700 uppercase tracking-wider">
              Tồn tạm chờ xử lý
            </span>
            <span className="text-xs text-primary font-bold">{tempCount} phiếu tạm chưa chuẩn hóa</span>
          </div>
          <span className="material-symbols-outlined text-amber-400 text-[18px]">chevron_right</span>
        </Link>
      )}

      {/* Recent Pallets */}
      <section className="flex flex-col gap-sm">
        <div className="flex justify-between items-center">
          <h2 className="font-mono text-[11px] md:text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Pallet gần đây
          </h2>
          <Link href={mobileHref("/thukho/pallet")} className="text-xs text-secondary font-semibold hover:underline">
            Xem tất cả →
          </Link>
        </div>

        <div className="flex flex-col gap-sm">
          {loading ? (
            <div className="py-10 text-center">
              <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
            </div>
          ) : recentPallets.length === 0 ? (
            <div className="industrial-card p-6 rounded-xl text-center bg-surface">
              <span className="material-symbols-outlined text-[40px] opacity-30 text-on-surface-variant mb-2">inventory_2</span>
              <p className="text-sm text-on-surface-variant">Chưa có pallet nào.</p>
            </div>
          ) : (
            recentPallets.map((p) => (
              <Link
                key={p.id}
                href={mobileHref(`/thukho/pallet/${p.id}`)}
                className="industrial-card p-md rounded-xl flex justify-between items-center bg-surface shadow-sm hover:border-primary/30 transition-all"
              >
                <div className="flex flex-col">
                  <span className="font-mono text-sm text-primary font-bold">{p.code}</span>
                  <span className="text-[11px] md:text-xs text-on-surface-variant truncate max-w-[180px]">
                    {p.supplier?.name || "Chưa có NCC"}
                  </span>
                </div>
                <div className="flex items-center gap-sm">
                  <span className="text-[10px] md:text-xs text-on-surface-variant">{p.total_lines} dòng</span>
                  <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold ${getStatusColor(p.status)}`}>
                    {getStatusText(p.status)}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Inbound Summary */}
      {(inboundPending > 0 || inboundReceiving > 0) && (
        <section className="flex flex-col gap-sm">
          <h2 className="font-mono text-[11px] md:text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Phiếu nhập đang xử lý
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-gutter">
            <Link href={mobileHref("/thukho/inbound")} className="industrial-card p-md rounded-xl flex flex-col items-center bg-surface shadow-sm hover:border-primary/30 transition-all">
              <span className="text-2xl font-bold font-jetbrains text-amber-600">{inboundPending}</span>
              <span className="text-[10px] md:text-xs text-on-surface-variant mt-1">Chờ tiếp nhận</span>
            </Link>
            <Link href={mobileHref("/thukho/inbound")} className="industrial-card p-md rounded-xl flex flex-col items-center bg-surface shadow-sm hover:border-primary/30 transition-all">
              <span className="text-2xl font-bold font-jetbrains text-blue-600">{inboundReceiving}</span>
              <span className="text-[10px] md:text-xs text-on-surface-variant mt-1">Đang nhập</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
