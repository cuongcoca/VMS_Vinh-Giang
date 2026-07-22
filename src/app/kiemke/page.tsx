"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { mobileHref } from "@/lib/mobile-href";
import { auth } from "@/lib/auth";

type StocktakeSessionLite = {
  id: string;
  code?: string;
  type?: string;
  status: string;
  discrepancies?: number;
  total_counts?: number;
  counted?: number;
  progress?: number;
  note?: string | null;
  created_at: string;
};

export default function KiemkeDashboardPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [sessions, setSessions] = useState<StocktakeSessionLite[]>([]);
  const [activeSession, setActiveSession] = useState<StocktakeSessionLite | null>(null);
  const [activeDetails, setActiveDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [userName, setUserName] = useState("Người kiểm kê");

  useEffect(() => {
    const u = auth.getUser();
    if (u) {
      setUserName(u.fullName || "Người kiểm kê");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`${basePath}/api/stock-count`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          const list = j.data || [];
          setSessions(list);
          // Tìm session hoạt động gần nhất (OPEN hoặc COUNTING hoặc RECONCILING)
          const active = list.find(
            (s: any) => s.status === "OPEN" || s.status === "COUNTING" || s.status === "RECONCILING"
          );
          if (active) {
            setActiveSession(active);
            setLoadingDetails(true);
            fetch(`${basePath}/api/stock-count/${active.id}`)
              .then((r2) => r2.json())
              .then((res) => {
                if (res.success) {
                  setActiveDetails(res.data);
                }
              })
              .catch(console.error)
              .finally(() => setLoadingDetails(false));
          } else {
            setActiveSession(null);
            setActiveDetails(null);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [basePath]);

  // Gom nhóm các counts được giao theo Khu (zone) và Kệ (rack)
  const getAssignedZones = () => {
    if (!activeDetails || !activeDetails.counts) return [];
    
    const groups: Record<string, { zone: string; rack: string; total: number; counted: number }> = {};
    
    activeDetails.counts.forEach((c: any) => {
      const loc = c.location;
      if (!loc) return;
      const key = `${loc.zone}-${loc.rack}`;
      if (!groups[key]) {
        groups[key] = {
          zone: loc.zone,
          rack: loc.rack,
          total: 0,
          counted: 0,
        };
      }
      groups[key].total += 1;
      if (c.actual_qty !== null) {
        groups[key].counted += 1;
      }
    });
    
    return Object.values(groups).sort((a, b) => {
      if (a.zone !== b.zone) return a.zone.localeCompare(b.zone);
      return a.rack.localeCompare(b.rack);
    });
  };

  const assignedZones = getAssignedZones();

  // Đếm tổng quan cho KPIs
  const openCount = sessions.filter((s) => s.status === "OPEN").length;
  const countingCount = sessions.filter((s) => s.status === "COUNTING").length;
  const completedCount = sessions.filter((s) => s.status === "CLOSED").length;
  const withDiscrepancyCount = sessions.filter((s) => (s.discrepancies || 0) > 0).length;

  return (
    <div className="flex flex-col gap-lg px-margin-mobile py-md">
      {/* 1. Header Đợt kiểm kê hôm nay (gradient block theo mockup) */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-600 text-white rounded-2xl p-5 shadow-md flex flex-col justify-between">
        <div>
          <div className="text-[11px] md:text-xs font-semibold uppercase tracking-wider opacity-85">
            Người KK · {userName}
          </div>
          <h1 className="text-xl font-bold mt-1">Đợt kiểm kê hôm nay</h1>
        </div>
      </div>

      {/* 2. Card Đợt kiểm kê (tiến độ và thanh progress bar) */}
      {loading ? (
        <div className="py-10 text-center">
          <span className="material-symbols-outlined animate-spin text-2xl text-purple-600">progress_activity</span>
        </div>
      ) : activeSession ? (
        <section className="flex flex-col gap-sm">
          <div className="industrial-card p-md rounded-xl bg-surface border-l-4 border-l-purple-600 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <b className="font-mono text-sm text-primary font-bold">{activeSession.code}</b>
                <div className="text-[11px] md:text-xs text-on-surface-variant mt-0.5">
                  {activeSession.type === "BY_LOCATION" ? "Theo vị trí" : "Theo mã hàng"} • {new Date(activeSession.created_at).toLocaleDateString("vi-VN")}
                </div>
              </div>
              <span className="bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full text-[11px] md:text-xs font-bold uppercase tracking-wider">
                {activeSession.status === "OPEN" ? "Đang mở" : "Đang đếm"}
              </span>
            </div>

            {/* Thanh tiến độ */}
            <div className="mt-4">
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-600 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, activeSession.progress || 0)}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center mt-2 text-xs text-on-surface-variant font-semibold">
                <span>Tiến độ: {activeSession.counted}/{activeSession.total_counts} vị trí ({Math.min(100, activeSession.progress || 0)}%)</span>
              </div>
            </div>
          </div>

          {/* 3. Vị trí được giao (Assigned Locations) */}
          <div className="mt-2">
            <h3 className="font-mono text-[11px] md:text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Vị trí được giao
            </h3>
            {loadingDetails ? (
              <div className="py-6 text-center">
                <span className="material-symbols-outlined animate-spin text-xl text-purple-600">progress_activity</span>
              </div>
            ) : assignedZones.length === 0 ? (
              <div className="industrial-card p-4 text-center text-xs text-on-surface-variant">
                Không có vị trí cụ thể nào được giao.
              </div>
            ) : (
              <div className="flex flex-col gap-xs">
                {assignedZones.map((g, idx) => {
                  const isDone = g.counted === g.total;
                  return (
                    <div key={idx} className="industrial-card p-sm rounded-xl bg-surface shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-on-surface">Khu {g.zone} · Kệ {g.rack}</span>
                        <div className="text-[11px] md:text-xs text-on-surface-variant mt-0.5">Tổng số: {g.total} vị trí</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[11px] md:text-xs font-bold ${isDone ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                        {isDone ? `Hoàn tất ${g.counted}/${g.total}` : `${g.counted}/${g.total}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Nút Tiếp tục kiểm kê */}
          <Link href={mobileHref(`/kiemke/tasks/${activeSession.id}`)} className="mt-2 w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-center text-sm font-bold shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-1.5">
            Tiếp tục kiểm kê <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </section>
      ) : (
        /* UC-DASH-01-TC27: Hiển thị "Không có dữ liệu" khi không có đợt kiểm kê */
        <div className="industrial-card p-8 text-center bg-surface border border-outline-variant/30 rounded-xl">
          <span className="material-symbols-outlined text-[48px] opacity-35 text-slate-400 block mb-2">fact_check</span>
          <p className="text-sm font-bold text-on-surface">Không có dữ liệu</p>
          <p className="text-xs text-on-surface-variant mt-1">Hiện không có đợt kiểm kê nào đang diễn ra hôm nay.</p>
        </div>
      )}

      {/* 4. Thống kê nhanh tổng quan kiểm kê (KPIs) */}
      <section className="flex flex-col gap-sm">
        <h2 className="font-mono text-[11px] md:text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Thống kê nhanh
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-gutter">
          <div className="industrial-card p-md rounded-xl bg-surface flex flex-col items-center shadow-sm">
            <span className="text-[11px] md:text-xs text-on-surface-variant/80 font-medium">Đang mở</span>
            <span className="text-3xl font-bold font-jetbrains text-blue-600 mt-1">{openCount}</span>
          </div>
          <div className="industrial-card p-md rounded-xl bg-surface flex flex-col items-center shadow-sm">
            <span className="text-[11px] md:text-xs text-on-surface-variant/80 font-medium">Đang đếm</span>
            <span className="text-3xl font-bold font-jetbrains text-amber-600 mt-1">{countingCount}</span>
          </div>
          <div className="industrial-card p-md rounded-xl bg-surface flex flex-col items-center shadow-sm">
            <span className="text-[11px] md:text-xs text-on-surface-variant/80 font-medium">Đã đóng</span>
            <span className="text-3xl font-bold font-jetbrains text-success mt-1">{completedCount}</span>
          </div>
          <div className="industrial-card p-md rounded-xl bg-surface flex flex-col items-center shadow-sm">
            <span className="text-[11px] md:text-xs text-on-surface-variant/80 font-medium">Lệch SL</span>
            <span className="text-3xl font-bold font-jetbrains text-error mt-1">{withDiscrepancyCount}</span>
          </div>
        </div>
      </section>

      {/* 5. Phím tắt tác vụ nhanh */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-gutter">
        <Link href={mobileHref("/kiemke/tasks")} className="industrial-card flex items-center gap-md p-md rounded-xl hover:border-primary/50 transition-all">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-blue-600 text-[28px]">assignment</span>
          </div>
          <div>
            <span className="text-sm font-bold text-primary">Nhiệm vụ kiểm kê</span>
            <p className="text-[11px] md:text-xs text-on-surface-variant">Xem phiên được phân công</p>
          </div>
        </Link>
        <Link href={mobileHref("/kiemke/scan")} className="industrial-card flex items-center gap-md p-md rounded-xl hover:border-primary/50 transition-all">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-green-600 text-[28px]">qr_code_scanner</span>
          </div>
          <div>
            <span className="text-sm font-bold text-primary">Quét & Đếm nhanh</span>
            <p className="text-[11px] md:text-xs text-on-surface-variant">Quét vị trí, đếm hàng</p>
          </div>
        </Link>
        <Link href={mobileHref("/kiemke/history")} className="industrial-card flex items-center gap-md p-md rounded-xl hover:border-primary/50 transition-all">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-purple-600 text-[28px]">history</span>
          </div>
          <div>
            <span className="text-sm font-bold text-primary">Tra cứu pallet</span>
            <p className="text-[11px] md:text-xs text-on-surface-variant">Lịch sử pallet, di chuyển</p>
          </div>
        </Link>
      </section>

      {/* 6. Danh sách phiên kiểm kê gần đây */}
      {sessions.length > 0 && (
        <section className="flex flex-col gap-sm">
          <h2 className="font-mono text-[11px] md:text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Phiên gần đây
          </h2>
          <div className="flex flex-col gap-xs">
            {sessions.slice(0, 5).map((s) => (
              <Link
                key={s.id}
                href={mobileHref(`/kiemke/tasks/${s.id}`)}
                className="industrial-card p-sm rounded-xl bg-surface shadow-sm hover:border-primary/30 transition-all"
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono text-sm text-primary font-bold">{s.code || `STK-${s.id?.slice(0, 6)}`}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold ${
                    s.status === "CLOSED" ? "bg-green-100 text-green-700" :
                    s.status === "OPEN" ? "bg-blue-100 text-blue-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>
                    {s.status === "CLOSED" ? "Đã đóng" :
                     s.status === "OPEN" ? "Đang mở" :
                     s.status === "COUNTING" ? "Đang đếm" : "Đối chiếu"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
