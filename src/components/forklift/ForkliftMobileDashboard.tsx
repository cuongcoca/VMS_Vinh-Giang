"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

type QueuePallet = {
  id: string;
  code: string;
  status: string;
  total_lines: number;
  total_weight_kg: string;
  total_qty?: number;
  line_count?: number;
  nearest_expiry?: string | null;
  confirmed_at: string | null;
  supplier: { id: string; code: string; name: string } | null;
  inbound_request?: { id: string; code: string } | null;
};

type TaskTab = "PUT_AWAY" | "RELOCATE" | "TO_STAGING_OUT" | "RETURN";

type LocCell = { id: string; code: string; zone: string; status: string };

const LOC_STATUS_STYLE: Record<string, { cls: string; label: string }> = {
  EMPTY: { cls: "bg-outline-variant/15 border border-outline-variant/40", label: "Trống" },
  USING: { cls: "bg-secondary/50", label: "Đang dùng" },
  PARTIAL: { cls: "bg-secondary/30", label: "Còn chỗ" },
  FULL: { cls: "bg-[#ea580c]/60", label: "Đầy" },
  WAITING_OUTBOUND: { cls: "bg-amber-300", label: "Chờ xuất" },
  RESERVED: { cls: "bg-indigo-300", label: "Đặt trước" },
  MAINTENANCE: { cls: "bg-zinc-400", label: "Bảo trì" },
  NEEDS_CHECK: { cls: "bg-rose-300", label: "Cần kiểm" },
  CHECK_AGAIN: { cls: "bg-rose-300", label: "Kiểm lại" },
};
const locStyle = (s: string) => LOC_STATUS_STYLE[s] ?? { cls: "bg-outline-variant/15 border border-outline-variant/40", label: s };

export default function ForkliftMobileDashboard() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [queue, setQueue] = useState<QueuePallet[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TaskTab>("PUT_AWAY");

  // Sơ đồ kho — vị trí thật từ /api/locations
  const [locations, setLocations] = useState<LocCell[]>([]);
  const [locLoading, setLocLoading] = useState(true);
  const [lastActiveLoc, setLastActiveLoc] = useState<string | null>(null);

  // Cảnh báo FEFO — dữ liệu thật từ /api/inventory/alerts
  const [fefoAlert, setFefoAlert] = useState<{
    urgentCount: number; warningCount: number;
    topCode: string | null; topName: string | null; topExpiry: string | null; topDays: number | null;
  } | null>(null);

  const fetchData = async (tab: TaskTab = activeTab) => {
    try {
      setLoading(true);
      const [queueRes, palletsRes] = await Promise.all([
        fetch(`${basePath}/api/forklift/queue?task_type=${tab}`),
        fetch(`${basePath}/api/pallets`)
      ]);

      const qJson = await queueRes.json();
      const pJson = await palletsRes.json();

      if (qJson.success) {
        setQueue(qJson.data);
        if (qJson.kpis) setKpis(prev => ({ ...prev, ...qJson.kpis }));
      }
      if (pJson.success && pJson.kpis) setKpis(prev => ({ ...prev, ...pJson.kpis }));
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const getWaitTime = (confirmedAt: string | null) => {
    if (!confirmedAt) return "—";
    const diff = Date.now() - new Date(confirmedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} phút`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}p`;
  };

  const formatExpiry = (iso: string | null | undefined) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString("vi-VN");
    } catch { return null; }
  };

  const formatConfirmedTime = (iso: string | null) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    } catch { return null; }
  };

  // UC-FK-06: Lịch sử hoạt động hôm nay — fetch real từ /api/movements
  type TimelineItem = { id: string; action: string; pallet: string; dest: string; time: string; type: "success" | "primary" };
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fromStr = today.toISOString().slice(0, 10);
    fetch(`${basePath}/api/movements?from=${fromStr}&limit=5`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) return;
        const items: TimelineItem[] = res.data.map((m: {
          id: string;
          movement_type: string;
          performed_at: string;
          pallet: { code: string };
          from_location: { code: string } | null;
          to_location: { code: string } | null;
        }) => {
          const actionMap: Record<string, string> = {
            PUT_AWAY: "Đã xếp vị trí",
            RELOCATE: "Đã chuyển",
            STAGE_OUT: "Đã rút sang chờ xuất",
            RETURN: "Đã hoàn trả",
          };
          const action = actionMap[m.movement_type] || "Đã luân chuyển";
          const dest = m.to_location?.code || m.from_location?.code || "—";
          const diffMs = Date.now() - new Date(m.performed_at).getTime();
          const mins = Math.floor(diffMs / 60000);
          const time = mins < 1 ? "Vừa xong" : mins < 60 ? `${mins} phút trước` : `${Math.floor(mins / 60)}h ${mins % 60}p trước`;
          return {
            id: m.id,
            action,
            pallet: m.pallet.code,
            dest,
            time,
            type: m.movement_type === "PUT_AWAY" ? "primary" : "success",
          };
        });
        setTimelineItems(items);
        setLastActiveLoc(res.data[0]?.to_location?.code ?? null);
      })
      .catch((e) => console.error("fetch timeline error:", e));
  }, [basePath]);

  // Sơ đồ kho: tải vị trí STORAGE thật
  useEffect(() => {
    fetch(`${basePath}/api/locations?type=STORAGE`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setLocations(
            res.data.map((l: { id: string; code: string; zone: string; status: string }) => ({
              id: l.id, code: l.code, zone: l.zone, status: l.status,
            }))
          );
        }
      })
      .catch((e) => console.error("fetch locations error:", e))
      .finally(() => setLocLoading(false));
  }, [basePath]);

  // Cảnh báo FEFO thật
  useEffect(() => {
    fetch(`${basePath}/api/inventory/alerts`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) return;
        const urgent = res.data?.expiry?.urgent ?? [];
        const top = urgent[0] ?? null;
        const topDays = top?.expiry_date
          ? Math.ceil((new Date(top.expiry_date).getTime() - Date.now()) / 86400000)
          : null;
        setFefoAlert({
          urgentCount: res.summary?.urgent_expiry ?? 0,
          warningCount: res.summary?.warning_expiry ?? 0,
          topCode: top?.item_code?.code ?? null,
          topName: top?.item_code?.short_name ?? null,
          topExpiry: top?.expiry_date ?? null,
          topDays,
        });
      })
      .catch((e) => console.error("fetch fefo alert error:", e));
  }, [basePath]);

  // UC-FK-01: 4 task type tabs (Vào vị trí · Luân chuyển · Sang chờ xuất · Hoàn trả)
  const TASK_TABS: { key: TaskTab; label: string; kpiKey: string }[] = [
    { key: "PUT_AWAY", label: "Vào vị trí", kpiKey: "PUT_AWAY" },
    { key: "RELOCATE", label: "Luân chuyển", kpiKey: "RELOCATE" },
    { key: "TO_STAGING_OUT", label: "Sang chờ xuất", kpiKey: "TO_STAGING_OUT" },
    { key: "RETURN", label: "Hoàn trả vị trí", kpiKey: "RETURN" },
  ];

  const getHref = (palletId: string) => {
    if (activeTab === "PUT_AWAY") return `/forklift/put-away?pallet_id=${palletId}`;
    if (activeTab === "RELOCATE") return `/forklift/relocate?pallet_id=${palletId}`;
    if (activeTab === "TO_STAGING_OUT") return `/forklift/stage-out?pallet_id=${palletId}`;
    return `/forklift/return?pallet_id=${palletId}`;
  };

  return (
    <div className="flex flex-col gap-lg px-margin-mobile py-md">
      {/* UC-FK-01 + Phase 3.1: Section header "Việc của tôi" (KHÔNG còn sticky topbar đè header layout — fix DOUBLE HEADER) */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[20px] text-[#ea580c]">forklift</span>
            Việc của tôi
          </h2>
          <p className="text-[11px] md:text-xs text-on-surface-variant">Pallet chờ xếp + lệnh luân chuyển</p>
        </div>
        <button
          onClick={() => fetchData(activeTab)}
          className="text-xs font-semibold text-on-surface-variant flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-low"
          aria-label="Làm mới"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Làm mới
        </button>
      </div>

      {/* UC-FK-01: 4 KPI box theo mockup */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-gutter">
        <div className="industrial-card p-md rounded-xl flex flex-col gap-xs shadow-sm bg-surface">
          <span className="text-[11px] md:text-xs font-medium text-on-surface-variant/80">Pallet chờ xếp</span>
          <div className="flex items-baseline gap-xs mt-1">
            <span className="text-3xl font-bold font-jetbrains text-[#ea580c]">
              {kpis.PUT_AWAY ?? 0}
            </span>
            <span className="text-xs text-on-surface-variant">pallet</span>
          </div>
        </div>
        <div className="industrial-card p-md rounded-xl flex flex-col gap-xs shadow-sm bg-surface">
          <span className="text-[11px] md:text-xs font-medium text-on-surface-variant/80">Pallet trong kho</span>
          <div className="flex items-baseline gap-xs mt-1">
            <span className="text-3xl font-bold font-jetbrains text-primary">
              {kpis.RELOCATE ?? 0}
            </span>
            <span className="text-xs text-on-surface-variant">pallet</span>
          </div>
        </div>
        <div className="industrial-card p-md rounded-xl flex flex-col gap-xs shadow-sm bg-surface">
          <span className="text-[11px] md:text-xs font-medium text-on-surface-variant/80">Yêu cầu xuất tương đối</span>
          <div className="flex items-baseline gap-xs mt-1">
            <span className="text-3xl font-bold font-jetbrains text-success">
              {kpis.TO_STAGING_OUT ?? 0}
            </span>
            <span className="text-xs text-on-surface-variant">lệnh</span>
          </div>
        </div>
        <div className="industrial-card p-md rounded-xl flex flex-col gap-xs shadow-sm bg-surface">
          <span className="text-[11px] md:text-xs font-medium text-on-surface-variant/80">Ở khu chờ xuất</span>
          <div className="flex items-baseline gap-xs mt-1">
            <span className="text-3xl font-bold font-jetbrains text-amber-600">
              {kpis.RETURN ?? 0}
            </span>
            <span className="text-xs text-on-surface-variant">pallet</span>
          </div>
        </div>
      </section>

      {/* UC-FK-01: 3 pill tabs */}
      <div className="flex gap-2 overflow-x-auto custom-scroll-hide">
        {TASK_TABS.map((t) => {
          const count = kpis[t.kpiKey] ?? 0;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                active
                  ? "bg-[#ea580c] text-white shadow"
                  : "bg-white text-on-surface-variant border border-outline-variant"
              }`}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Quick Actions Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-gutter">
        <Link href="/forklift/pallet" className="industrial-card flex flex-col items-center justify-center py-lg gap-sm rounded-xl active:bg-surface-variant/30 hover:border-primary/50 transition-all text-center">
          <span className="material-symbols-outlined text-secondary text-[32px] font-bold">inventory_2</span>
          <span className="text-body-md font-bold text-primary">Quét Pallet</span>
        </Link>
        <Link href="/forklift/relocate" className="industrial-card flex flex-col items-center justify-center py-lg gap-sm rounded-xl active:bg-surface-variant/30 hover:border-primary/50 transition-all text-center">
          <span className="material-symbols-outlined text-secondary text-[32px] font-bold">location_on</span>
          <span className="text-body-md font-bold text-primary">Quét Vị trí</span>
        </Link>
        <Link href="/forklift/relocate" className="industrial-card flex flex-col items-center justify-center py-lg gap-sm rounded-xl active:bg-surface-variant/30 hover:border-primary/50 transition-all text-center">
          <span className="material-symbols-outlined text-secondary text-[32px] font-bold">forklift</span>
          <span className="text-body-md font-bold text-primary">Lệnh Chuyển</span>
        </Link>
        <Link href="/forklift/stage-out" className="industrial-card flex flex-col items-center justify-center py-lg gap-sm rounded-xl active:bg-surface-variant/30 hover:border-primary/50 transition-all text-center">
          <span className="material-symbols-outlined text-secondary text-[32px] font-bold">timer</span>
          <span className="text-body-md font-bold text-primary">FEFO Picking</span>
        </Link>
      </section>

      {/* FEFO Alert Center — dữ liệu thật từ /api/inventory/alerts */}
      {fefoAlert && (fefoAlert.urgentCount > 0 || fefoAlert.warningCount > 0) && (
        <Link href="/inventory/alerts" className="industrial-card border-none bg-error-container/40 p-md rounded-xl flex gap-md items-center shadow-sm active:scale-[0.99] transition-all">
          <div className="w-12 h-12 rounded-lg bg-error/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-error text-[28px]">warning</span>
          </div>
          <div className="flex flex-col gap-xs">
            <span className="font-mono text-[11px] md:text-xs font-bold text-error uppercase tracking-wider">
              {fefoAlert.urgentCount > 0
                ? `Cảnh báo FEFO tới hạn (${fefoAlert.urgentCount} lô ≤7 ngày)`
                : `HSD cận hạn (${fefoAlert.warningCount} lô ≤30 ngày)`}
            </span>
            {fefoAlert.topCode && (
              <div className="flex flex-col">
                <span className="text-xs text-primary font-bold">SKU: {fefoAlert.topCode}{fefoAlert.topName ? ` (${fefoAlert.topName})` : ""}</span>
                <span className="text-[11px] md:text-xs text-error font-semibold">
                  HSD: {fefoAlert.topExpiry ? new Date(fefoAlert.topExpiry).toLocaleDateString("vi-VN") : "—"}
                  {typeof fefoAlert.topDays === "number" ? ` (còn ${fefoAlert.topDays} ngày)` : ""}
                </span>
              </div>
            )}
          </div>
        </Link>
      )}

      {/* UC-FK-01: Task Queue — card pallet với border-left cam, info dòng/đv/date/PHN */}
      <section className="flex flex-col gap-sm">
        <div className="flex justify-between items-center">
          <h2 className="font-mono text-[11px] md:text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Danh sách pallet ({queue.length})
          </h2>
        </div>

        <div className="flex flex-col gap-sm">
          {loading ? (
            <div className="py-10 text-center">
              <span className="material-symbols-outlined animate-spin text-2xl text-[#ea580c]">progress_activity</span>
            </div>
          ) : queue.length === 0 ? (
            <div className="industrial-card p-6 rounded-xl text-center bg-surface">
              <span className="material-symbols-outlined text-[40px] opacity-30 text-success mb-2">check_circle</span>
              <p className="text-sm text-on-surface-variant">
                {activeTab === "PUT_AWAY" ? "Không có pallet nào chờ xếp vị trí." :
                 activeTab === "RELOCATE" ? "Chưa có pallet nào trong kho để sắp xếp lại." :
                 activeTab === "TO_STAGING_OUT" ? "Không có yêu cầu sang chờ xuất." :
                 "Không có pallet nào ở khu chờ xuất."}
              </p>
            </div>
          ) : (
            queue.map((p: any) => {
              if (p.is_outbound_task) {
                const shipDateStr = p.ship_date ? new Date(p.ship_date).toLocaleDateString("vi-VN") : "";
                return (
                  <Link
                    key={p.id}
                    href={`/forklift/outbound/${p.id}`}
                    className="industrial-card p-md rounded-xl flex flex-col gap-1.5 relative overflow-hidden bg-surface shadow-sm hover:border-blue-400/40 transition-all active:scale-[0.99]"
                  >
                    {/* Border-left blue/purple for outbound task */}
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>

                    <div className="flex justify-between items-start pl-1">
                      <span className="font-mono text-sm font-bold text-primary">{p.code}</span>
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold">
                        Đang lấy hàng
                      </span>
                    </div>

                    <div className="pl-1 text-xs text-on-surface-variant">
                      Khách hàng: <b>{p.customer || "—"}</b>
                    </div>

                    <div className="pl-1 flex flex-wrap gap-2 text-[11px] md:text-xs text-on-surface-variant/80">
                      <span>📦 {p.line_count || 0} dòng hàng</span>
                      {shipDateStr && <span>📅 Hạn giao: {shipDateStr}</span>}
                    </div>
                  </Link>
                );
              }

              const nearestExpiry = formatExpiry(p.nearest_expiry);
              const confirmedTime = formatConfirmedTime(p.confirmed_at);
              return (
                <Link
                  key={p.id}
                  href={getHref(p.id)}
                  className="industrial-card p-md rounded-xl flex flex-col gap-1.5 relative overflow-hidden bg-surface shadow-sm hover:border-[#ea580c]/40 transition-all active:scale-[0.99]"
                >
                  {/* Border-left orange — UC-FK-01 */}
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#ea580c]"></div>

                  <div className="flex justify-between items-start pl-1">
                    <span className="font-mono text-sm font-bold text-primary">{p.code}</span>
                    {/* Nhãn theo tab: mỗi tab là một loại việc khác nhau, không phải
                        tab nào cũng là "chờ đưa vào vị trí". */}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold ${
                      activeTab === "RELOCATE" ? "bg-blue-100 text-blue-700"
                      : activeTab === "RETURN" ? "bg-rose-100 text-rose-700"
                      : "bg-amber-100 text-amber-700"
                    }`}>
                      {activeTab === "RELOCATE" ? "Trong kho"
                       : activeTab === "RETURN" ? "Ở khu chờ xuất"
                       : "Chờ đưa vào"}
                    </span>
                  </div>

                  {/* dòng · đv · Date gần nhất */}
                  <div className="pl-1 text-xs text-on-surface-variant">
                    {p.line_count ?? p.total_lines ?? 0} dòng
                    {(p.total_qty ?? 0) > 0 && <> · <b>{p.total_qty}</b> đv</>}
                    {nearestExpiry && <> · Date gần nhất: <b>{nearestExpiry}</b></>}
                  </div>

                  {/* PHN + XN time. Riêng RELOCATE/RETURN thì vị trí hiện tại mới là
                      thông tin cần, còn "chờ bao lâu" chỉ có nghĩa với hàng chờ xếp. */}
                  <div className="pl-1 flex flex-wrap gap-2 text-[11px] md:text-xs text-on-surface-variant/80">
                    {p.location?.code ? (
                      <span>📍 {p.location.code}</span>
                    ) : (
                      p.inbound_request?.code && <span>📥 {p.inbound_request.code}</span>
                    )}
                    {confirmedTime && activeTab === "PUT_AWAY" && (
                      <span>⏱ XN {confirmedTime}</span>
                    )}
                    {p.confirmed_at && activeTab === "PUT_AWAY" && (
                      <span className="ml-auto text-[10px] md:text-xs font-semibold text-[#ea580c]">
                        Chờ {getWaitTime(p.confirmed_at)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>

      {/* Warehouse Mini Map — dữ liệu thật từ /api/locations */}
      <section className="flex flex-col gap-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[11px] md:text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Sơ đồ kho vận hành
          </h2>
          {!locLoading && locations.length > 0 && (
            <span className="text-[10px] md:text-xs text-on-surface-variant">
              {locations.filter((l) => l.status !== "EMPTY").length}/{locations.length} vị trí đang dùng
            </span>
          )}
        </div>
        <div className="industrial-card p-md rounded-xl bg-surface-low shadow-sm">
          {locLoading ? (
            <div className="py-8 text-center">
              <span className="material-symbols-outlined animate-spin text-xl text-[#ea580c]">progress_activity</span>
            </div>
          ) : locations.length === 0 ? (
            <div className="py-8 text-center text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px] opacity-30 block">grid_off</span>
              <span className="mt-1 block">Chưa cấu hình vị trí kho.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-sm">
              {/* Chú thích */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] md:text-xs text-on-surface-variant">
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-outline-variant/15 border border-outline-variant/40"></span>Trống</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-secondary/50"></span>Đang dùng</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#ea580c]/60"></span>Đầy</span>
              </div>
              {/* Các khu thật */}
              {Array.from(new Set(locations.map((l) => l.zone))).sort().map((zone) => {
                const cells = locations.filter((l) => l.zone === zone);
                const used = cells.filter((c) => c.status !== "EMPTY").length;
                return (
                  <div key={zone} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] md:text-xs font-bold text-primary">Khu {zone}</span>
                      <span className="text-[10px] md:text-xs text-on-surface-variant">{used}/{cells.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {cells.map((c) => {
                        const st = locStyle(c.status);
                        const isActive = lastActiveLoc === c.code;
                        return (
                          <span
                            key={c.id}
                            title={`${c.code} · ${st.label}`}
                            className={`w-4 h-4 rounded-sm ${st.cls} ${isActive ? "ring-2 ring-primary ring-offset-1" : ""}`}
                          ></span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {/* Vị trí xe vừa thao tác (thật, từ movement gần nhất) */}
              {lastActiveLoc && (
                <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-primary border-t border-outline-variant/30 pt-2">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>forklift</span>
                  <span>Thao tác gần nhất tại <b className="font-mono">{lastActiveLoc}</b></span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Activity Timeline */}
      <section className="flex flex-col gap-sm">
        <h2 className="font-mono text-[11px] md:text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Lịch sử hoạt động hôm nay
        </h2>
        <div className="flex flex-col gap-0 bg-surface rounded-xl p-md border border-outline-variant/30 shadow-sm">
          {timelineItems.length === 0 ? (
            <div className="py-4 text-center text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[28px] opacity-30 block">history</span>
              <span className="mt-1 block">Chưa có hoạt động nào hôm nay.</span>
            </div>
          ) : (
            timelineItems.map((item, idx) => (
              <div key={item.id} className="flex gap-md">
                <div className="flex flex-col items-center">
                  <div className={`w-2 h-2 rounded-full ${item.type === "success" ? "bg-success" : "bg-primary"}`}></div>
                  {idx < timelineItems.length - 1 && <div className="w-[1px] h-full bg-outline-variant/50 min-h-[30px]"></div>}
                </div>
                <div className="flex flex-col pb-sm">
                  <span className="text-xs text-primary font-medium">
                    {item.action} <span className="font-bold">{item.pallet}</span> đến <span className="font-bold">{item.dest}</span>
                  </span>
                  <span className="text-[10px] md:text-xs text-on-surface-variant">{item.time}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
