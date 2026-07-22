"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import Link from "next/link";
import { auth } from "@/lib/auth";

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

// Sprint A · D1-001: KPI Kế toán từ endpoint dedicated `/api/dashboard/accountant-kpi`
// thay vì generic KPI (trước đây 4 ô hiển thị data không liên quan).
type AccountingKPI = {
  inbound_processing: number;
  inbound_reconciling: number;
  temp_pending: number;
  temp_lines: number;
  discrepancy_count: number;
  pending_adjustments: number;
  expiring_7d: number;
  expiring_30d: number;
  low_stock_skus: number;
  recent_updates: Array<{ id: string; code: string; status: string; kind: "INBOUND" | "ADJUSTMENT"; at: string }>;
};

type RecentInbound = { id: string; code: string; status: string };

export default function DashboardPage() {
  const router = useRouter();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [acctKpi, setAcctKpi] = useState<AccountingKPI | null>(null);
  const [recent, setRecent] = useState<RecentInbound[]>([]);
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const u = auth.getUser();
    setRole(u?.role || null);
    setUserName(u?.fullName || "");
    // UC-DASH-01: redirect MANAGER/QUAN_LY/ADMIN sang trang manager riêng
    if (u && (u.role === "MANAGER" || u.role === "QUAN_LY" || u.role === "ADMIN")) {
      router.replace("/dashboard/manager");
    }
  }, [router]);

  useEffect(() => {
    // Chờ role được load
    if (role === null) return;
    setLoading(true);
    const isAcct = role === "KE_TOAN" || role === "STAFF";

    if (isAcct) {
      // Sprint A · D1-001/D1-002: dùng endpoint chuyên dụng cho Kế toán
      // (4 KPI khớp mockup + recent_updates đã merge inbound + adjustment).
      fetch(`${basePath}/api/dashboard/accountant-kpi`)
        .then((r) => r.json())
        .then((r) => {
          if (r.success) {
            setAcctKpi(r.data);
            // Map recent_updates (chỉ INBOUND) cho card "Phiếu vừa cập nhật"
            const recentInbound = (r.data.recent_updates as AccountingKPI["recent_updates"])
              .filter((x) => x.kind === "INBOUND")
              .slice(0, 5)
              .map((x) => ({ id: x.id, code: x.code, status: x.status }));
            setRecent(recentInbound);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      // Generic KPI cho ADMIN fallback (mặc dù đã redirect ở useEffect trên)
      fetch(`${basePath}/api/dashboard/kpi?period=${period}d`)
        .then((r) => r.json())
        .then((r) => { if (r.success) setKpi(r.data); })
        .catch(console.error)
        .finally(() => setLoading(false));
      // Recent inbound cho generic view
      fetch(`${basePath}/api/inbound`)
        .then((r) => r.json())
        .then((j) => { if (j.success) setRecent((j.data || []).slice(0, 5)); })
        .catch(console.error);
    }
  }, [basePath, period, role]);

  // UC-DASH-01: Dashboard Kế toán — 4 KPI chuyên dùng + 2 card
  const isAccounting = role === "KE_TOAN" || role === "STAFF";

  // 4 KPI mới cho Kế toán khớp mockup (Sprint A · D1-001)
  const accountingKpis = acctKpi ? [
    {
      icon: "input",
      label: "Phiếu nhập đang xử lý",
      value: acctKpi.inbound_processing,
      delta: acctKpi.inbound_reconciling > 0 ? `${acctKpi.inbound_reconciling} chờ đối chiếu` : "",
      color: "border-l-primary",
    },
    {
      icon: "pending_actions",
      label: "Tồn tạm chờ chuẩn hóa",
      value: acctKpi.temp_pending,
      delta: `${acctKpi.temp_lines} dòng`,
      color: "border-l-amber-400",
    },
    {
      icon: "compare_arrows",
      label: "Phiếu lệch SL",
      value: acctKpi.discrepancy_count,
      delta: acctKpi.discrepancy_count > 0 ? "Cần xử lý" : "",
      color: "border-l-rose-500",
    },
    {
      icon: "edit_note",
      label: "Phiếu điều chỉnh chờ duyệt",
      value: acctKpi.pending_adjustments,
      delta: "",
      color: "border-l-slate-400",
    },
  ] : [];

  const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "Nháp", color: "bg-surface-low text-on-surface-variant" },
    PENDING: { label: "Chờ TK", color: "bg-amber-50 text-amber-700" },
    RECEIVING: { label: "Nhận hàng", color: "bg-blue-50 text-blue-700" },
    RECONCILING: { label: "Đối chiếu", color: "bg-purple-50 text-purple-700" },
    COMPLETED: { label: "Hoàn tất", color: "bg-emerald-50 text-emerald-700" },
    CANCELLED: { label: "Hủy", color: "bg-rose-50 text-rose-600" },
  };

  // Generic KPI cards (cho ADMIN/khác — fallback)
  const genericCards = kpi ? [
    { icon: "inventory_2", label: "Tổng SL tồn", value: kpi.total_stock_items.toLocaleString(), color: "text-primary bg-primary/10" },
    { icon: "scale", label: "Tổng KG", value: `${kpi.total_stock_weight_kg.toLocaleString()} kg`, color: "text-blue-600 bg-blue-50" },
    { icon: "input", label: `Nhập ${period}d`, value: kpi.inbound_this_period, color: "text-emerald-600 bg-emerald-50" },
    { icon: "output", label: `Xuất ${period}d`, value: kpi.outbound_this_period, color: "text-amber-600 bg-amber-50" },
    { icon: "grid_view", label: "Lấp đầy vị trí", value: `${kpi.location_usage_percent}%`, color: "text-indigo-600 bg-indigo-50" },
    { icon: "warning", label: "HSD ≤7d", value: kpi.expiring_items_7d, color: kpi.expiring_items_7d > 0 ? "text-rose-600 bg-rose-50" : "text-emerald-600 bg-emerald-50" },
    { icon: "schedule", label: "HSD ≤30d", value: kpi.expiring_items_30d, color: kpi.expiring_items_30d > 0 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50" },
    { icon: "forklift", label: "Xe nâng hôm nay", value: kpi.forklift_tasks_today, color: "text-on-surface-variant bg-surface-low" },
  ] : [];

  const quickLinks = [
    { href: "/inventory", icon: "inventory_2", label: "Tồn kho", desc: "Xem tồn kho theo mã hàng", color: "bg-primary/5 border-primary/20 hover:bg-primary/10" },
    { href: "/inventory/alerts", icon: "warning", label: "Cảnh báo", desc: "HSD & tồn thấp", color: "bg-rose-50 border-rose-200 hover:bg-rose-100" },
    { href: "/inbound", icon: "input", label: "Phiếu nhập", desc: "Quản lý phiếu nhập kho", color: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100" },
    { href: "/forklift", icon: "forklift", label: "Xe nâng", desc: "Hàng đợi & xếp vị trí", color: "bg-blue-50 border-blue-200 hover:bg-blue-100" },
    { href: "/stock-count", icon: "fact_check", label: "Kiểm kê", desc: "Phiên kiểm kê tồn kho", color: "bg-amber-50 border-amber-200 hover:bg-amber-100" },
    { href: "/outbound", icon: "output", label: "Xuất kho", desc: "Khu chờ xuất & cân tồn", color: "bg-indigo-50 border-indigo-200 hover:bg-indigo-100" },
  ];

  // Đợi redirect (manager) hoặc loading
  if (role === "MANAGER" || role === "QUAN_LY" || role === "ADMIN") {
    return <AppLayout title="TỔNG QUAN"><div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span></div></AppLayout>;
  }

  return (
    <AppLayout title="TỔNG QUAN">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              👋 Chào, {userName || "Người dùng"}
            </h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {isAccounting ? "Dashboard Kế toán kho" : "Tổng quan hệ thống kho Vĩnh Giang"} — {new Date().toLocaleDateString("vi-VN")}
            </p>
          </div>
          <div className="flex gap-1.5">
            {["7", "30", "90"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  period === p ? "bg-primary text-white" : "bg-surface-low hover:bg-surface-mid"
                }`}
              >
                {p} ngày
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
          </div>
        ) : isAccounting ? (
          // UC-DASH-01: View Kế toán — 4 KPI chuyên dùng
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {accountingKpis.map((c, i) => (
                <div key={i} className={`bg-white p-4 rounded-xl border shadow-sm ${c.color} border-l-4`}>
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[22px] text-on-surface-variant/70">{c.icon}</span>
                    <div>
                      <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">{c.label}</p>
                      <p className="text-2xl font-bold mt-0.5 font-mono">{c.value}</p>
                      {c.delta && <p className="text-[10px] text-on-surface-variant/70 mt-0.5">{c.delta}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Cảnh báo HSD/Tồn thấp */}
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
                <h3 className="text-sm font-bold text-on-surface mb-2 flex items-center gap-1">
                  🚨 Cảnh báo HSD / Tồn thấp
                </h3>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-t border-outline-variant/50">
                      <td className="py-2">🔴 ≤ 7 ngày</td>
                      <td className="py-2 text-right"><b className="text-rose-600">{acctKpi?.expiring_7d ?? 0} lô</b></td>
                    </tr>
                    <tr className="border-t border-outline-variant/50">
                      <td className="py-2">🟡 ≤ 30 ngày</td>
                      <td className="py-2 text-right"><b className="text-amber-600">{acctKpi?.expiring_30d ?? 0} lô</b></td>
                    </tr>
                    <tr className="border-t border-outline-variant/50">
                      <td className="py-2">🔻 Dưới min</td>
                      <td className="py-2 text-right"><b>{acctKpi?.low_stock_skus ?? "—"}</b></td>
                    </tr>
                  </tbody>
                </table>
                <Link href="/inventory/alerts" className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1">
                  Xem chi tiết →
                </Link>
              </div>

              {/* Card 2: Phiếu vừa cập nhật */}
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
                <h3 className="text-sm font-bold text-on-surface mb-2 flex items-center gap-1">
                  📋 Phiếu nhập vừa cập nhật
                </h3>
                {recent.length === 0 ? (
                  <p className="text-xs text-on-surface-variant/70 py-4 text-center">Chưa có phiếu nào</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {recent.map((r) => {
                        const st = STATUS_LABEL[r.status] || { label: r.status, color: "bg-surface-low" };
                        return (
                          <tr key={r.id} className="border-t border-outline-variant/50">
                            <td className="py-2 font-mono font-bold text-xs">
                              <Link href={`/inbound/${r.id}`} className="text-primary hover:underline">{r.code}</Link>
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
                <Link href="/inbound" className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1">
                  Tất cả phiếu →
                </Link>
              </div>
            </div>

            {/* Truy cập nhanh */}
            <div>
              <h2 className="text-sm font-bold text-on-surface-variant uppercase mb-3">Truy cập nhanh</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {quickLinks.map((ql) => (
                  <Link key={ql.href} href={ql.href} className={`p-4 rounded-xl border shadow-sm flex items-center gap-3 transition-all ${ql.color}`}>
                    <span className="material-symbols-outlined text-[24px]">{ql.icon}</span>
                    <div>
                      <p className="text-sm font-bold">{ql.label}</p>
                      <p className="text-[10px] text-on-surface-variant">{ql.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        ) : (
          // Generic view (ADMIN fallback — không reach vì đã redirect ở trên)
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {genericCards.map((c, i) => (
                <div key={i} className="bg-white rounded-xl border border-outline-variant shadow-sm p-4 flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${c.color}`}>
                    <span className="material-symbols-outlined text-[20px]">{c.icon}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-on-surface-variant uppercase leading-tight">{c.label}</p>
                    <p className="text-xl font-bold mt-0.5 font-mono">{c.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface-variant uppercase mb-3">Truy cập nhanh</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {quickLinks.map((ql) => (
                  <Link key={ql.href} href={ql.href} className={`p-4 rounded-xl border shadow-sm flex items-center gap-3 transition-all ${ql.color}`}>
                    <span className="material-symbols-outlined text-[24px]">{ql.icon}</span>
                    <div>
                      <p className="text-sm font-bold">{ql.label}</p>
                      <p className="text-[10px] text-on-surface-variant">{ql.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
