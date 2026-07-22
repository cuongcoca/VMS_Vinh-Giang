"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useClientPagination, ListPageFooter } from "@/components/ui";

type PalletSummary = {
  id: string;
  code: string;
  status: string;
  supplier?: { name: string } | null;
};

type HistoryEvent = {
  id: string;
  kind: "audit" | "movement" | "created";
  action: string;
  label: string;
  reason: string | null;
  performed_by_name: string | null;
  performed_by_role: string | null;
  performed_at: string;
  from_location?: { code: string; zone: string } | null;
  to_location?: { code: string; zone: string } | null;
};

type MovementRow = {
  id: string;
  movement_type: string;
  performed_at: string;
  pallet?: { code?: string } | null;
  from_location?: { code?: string } | null;
  to_location?: { code?: string } | null;
  item_code?: { code?: string; short_name?: string } | null;
  performer?: { full_name?: string } | null;
};

const ACTION_ICON: Record<string, { icon: string; color: string }> = {
  CREATE_PALLET: { icon: "add_circle", color: "bg-blue-100 text-blue-700" },
  CREATE: { icon: "add_circle", color: "bg-blue-100 text-blue-700" },
  ADD_PALLET_LINE: { icon: "add_box", color: "bg-indigo-100 text-indigo-700" },
  ADD_LINE: { icon: "add_box", color: "bg-indigo-100 text-indigo-700" },
  EDIT_PALLET_LINE: { icon: "edit", color: "bg-amber-100 text-amber-700" },
  DELETE_PALLET_LINE: { icon: "delete", color: "bg-rose-100 text-rose-700" },
  DELETE_LINE: { icon: "delete", color: "bg-rose-100 text-rose-700" },
  CONFIRM_PALLET: { icon: "check_circle", color: "bg-emerald-100 text-emerald-700" },
  CONFIRM: { icon: "check_circle", color: "bg-emerald-100 text-emerald-700" },
  UNLOCK_PALLET: { icon: "lock_open", color: "bg-amber-100 text-amber-700" },
  CANCEL_PALLET: { icon: "cancel", color: "bg-rose-100 text-rose-700" },
  PUT_AWAY: { icon: "where_to_vote", color: "bg-emerald-100 text-emerald-700" },
  RELOCATE: { icon: "swap_horiz", color: "bg-indigo-100 text-indigo-700" },
  STAGE_OUT: { icon: "outbox", color: "bg-amber-100 text-amber-700" },
  RETURN: { icon: "undo", color: "bg-purple-100 text-purple-700" },
  EDIT_PALLET_LINE_VIA_RETURN: { icon: "edit_note", color: "bg-orange-100 text-orange-700" },
};

const ROLE_SHORT: Record<string, string> = {
  ADMIN: "Quản trị",
  MANAGER: "Quản lý",
  QUAN_LY: "Quản lý",
  KE_TOAN: "Kế toán",
  THU_KHO: "Thủ kho",
  XE_NANG: "Xe nâng",
  KIEM_KE: "Kiểm kê",
  STAFF: "Nhân viên",
};

const MOVEMENT_LABEL: Record<string, string> = {
  PUT_AWAY: "Xếp kho",
  RELOCATE: "Chuyển vị trí",
  STAGE_OUT: "Sang khu chờ xuất",
  RETURN: "Hoàn trả",
  ADJUSTMENT: "Điều chỉnh",
  OUTBOUND: "Xuất kho",
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  EMPTY: { label: "Đang thêm", color: "bg-slate-100 text-slate-700" },
  COUNTING: { label: "Đang đếm", color: "bg-blue-100 text-blue-700" },
  CONFIRMED: { label: "Đã xác nhận", color: "bg-emerald-100 text-emerald-700" },
  IN_STORAGE: { label: "Trong kho", color: "bg-indigo-100 text-indigo-700" },
  IN_STAGING: { label: "Chờ xuất", color: "bg-amber-100 text-amber-700" },
  RELEASED: { label: "Đã xuất", color: "bg-purple-100 text-purple-700" },
  CANCELLED: { label: "Đã hủy", color: "bg-rose-100 text-rose-600" },
};

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function KiemkeHistoryPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [tab, setTab] = useState<"pallet" | "movement">("pallet");
  const [pallets, setPallets] = useState<PalletSummary[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedPallet, setSelectedPallet] = useState<PalletSummary | null>(null);
  const [palletHistory, setPalletHistory] = useState<HistoryEvent[]>([]);

  const searchPallets = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${basePath}/api/pallets?q=${encodeURIComponent(search)}`);
      const json = await res.json();
      if (json.success) setPallets(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : "";
      const res = await fetch(`${basePath}/api/movements${params}`);
      const json = await res.json();
      if (json.success) setMovements(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [basePath, search]);

  const viewPalletHistory = async (pallet: PalletSummary) => {
    setSelectedPallet(pallet);
    setPalletHistory([]);
    try {
      const res = await fetch(`${basePath}/api/pallets/${pallet.id}/history`);
      const json = await res.json();
      if (json.success) setPalletHistory(json.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (tab === "movement") fetchMovements();
  }, [tab, fetchMovements]);

  // Phân trang client-side theo tab đang hiển thị (pallet: card · movement: timeline)
  const activeList: (PalletSummary | MovementRow)[] = tab === "pallet" ? pallets : movements;
  const pg = useClientPagination(activeList, {
    resetKey: `${tab}|${search}`,
  });
  const { paged } = pg;

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      <h1 className="text-lg font-bold text-primary flex items-center gap-2">
        <span className="material-symbols-outlined">history</span> Tra cứu
      </h1>

      <div className="flex gap-xs border-b border-outline-variant">
        <button
          onClick={() => setTab("pallet")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            tab === "pallet" ? "border-primary text-primary" : "border-transparent text-on-surface-variant"
          }`}
        >
          Lịch sử pallet
        </button>
        <button
          onClick={() => setTab("movement")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            tab === "movement" ? "border-primary text-primary" : "border-transparent text-on-surface-variant"
          }`}
        >
          Luân chuyển
        </button>
      </div>

      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">search</span>
        <input
          type="text"
          placeholder={tab === "pallet" ? "Tìm mã pallet…" : "Tìm mã pallet, mã hàng…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (tab === "pallet" ? searchPallets() : fetchMovements())}
          className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-lg text-sm bg-surface focus:outline-none focus:border-primary"
        />
      </div>

      {/* ===== TAB LỊCH SỬ PALLET ===== */}
      {tab === "pallet" ? (
        <>
          {selectedPallet ? (
            <div className="flex flex-col gap-sm">
              <button
                onClick={() => {
                  setSelectedPallet(null);
                  setPalletHistory([]);
                }}
                className="text-xs text-secondary hover:underline flex items-center gap-1 font-semibold w-fit"
              >
                <span className="material-symbols-outlined text-[14px]">arrow_back</span> Quay lại
              </button>

              {/* Pallet header */}
              <div className="industrial-card p-md rounded-xl bg-primary-container/20 border border-primary/20">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-sm text-primary font-bold">{selectedPallet.code}</span>
                    <p className="text-[11px] md:text-xs text-on-surface-variant">{selectedPallet.supplier?.name || "—"}</p>
                  </div>
                  {(() => {
                    const st = STATUS_LABEL[selectedPallet.status] || { label: selectedPallet.status, color: "bg-slate-100" };
                    return <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.color}`}>{st.label}</span>;
                  })()}
                </div>
              </div>

              <span className="font-mono text-[11px] md:text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Timeline ({palletHistory.length} sự kiện)
              </span>

              {/* Timeline */}
              <div className="flex flex-col bg-surface rounded-xl p-md border border-outline-variant/30 shadow-sm">
                {palletHistory.length === 0 ? (
                  <p className="text-sm text-on-surface-variant text-center py-4">Chưa có lịch sử</p>
                ) : (
                  palletHistory.map((h, i) => {
                    const meta = ACTION_ICON[h.action] || { icon: "circle", color: "bg-slate-100 text-slate-700" };
                    const isLast = i === palletHistory.length - 1;
                    const fromCode = h.from_location?.code;
                    const toCode = h.to_location?.code;
                    return (
                      <div key={h.id} className="flex gap-md">
                        {/* Dot + line */}
                        <div className="flex flex-col items-center pt-1">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${meta.color}`}>
                            <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
                          </div>
                          {!isLast && <div className="w-[2px] flex-1 bg-outline-variant/40 min-h-[20px] my-1" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 pb-4">
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-sm font-bold text-on-surface">{h.label || h.action}</span>
                            <span className="text-[11px] text-on-surface-variant/70 whitespace-nowrap">
                              {fmtDateTime(h.performed_at)}
                            </span>
                          </div>

                          {/* Movement: từ → đến */}
                          {h.kind === "movement" && (fromCode || toCode) && (
                            <p className="text-[11px] mt-0.5 flex items-center gap-1 text-on-surface-variant">
                              <span className="material-symbols-outlined text-[12px]">location_on</span>
                              <span className="font-mono">{fromCode || "—"}</span>
                              <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                              <span className="font-mono">{toCode || "—"}</span>
                            </p>
                          )}

                          {/* Reason */}
                          {h.reason && (
                            <p className="text-[11px] mt-0.5 text-on-surface-variant italic">
                              <span className="not-italic">📝</span> {h.reason}
                            </p>
                          )}

                          {/* Người thực hiện */}
                          {h.performed_by_name && (
                            <p className="text-[11px] text-on-surface-variant/70 mt-0.5">
                              👤 {h.performed_by_name}
                              {h.performed_by_role && (
                                <span className="ml-1 text-[11px] uppercase">({ROLE_SHORT[h.performed_by_role] || h.performed_by_role})</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-sm">
              {loading ? (
                <div className="py-8 text-center">
                  <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
                </div>
              ) : pallets.length === 0 ? (
                <div className="py-8 text-center text-sm text-on-surface-variant">
                  {search ? "Không tìm thấy pallet" : "Nhập mã pallet để tìm"}
                </div>
              ) : (
                <>
                  {(paged as PalletSummary[]).map((p) => {
                    const st = STATUS_LABEL[p.status] || { label: p.status, color: "bg-slate-100 text-slate-700" };
                    return (
                      <button
                        key={p.id}
                        onClick={() => viewPalletHistory(p)}
                        className="industrial-card p-md rounded-xl bg-surface shadow-sm hover:border-primary/30 transition-all text-left w-full"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-sm text-primary font-bold">{p.code}</span>
                            <p className="text-[11px] md:text-xs text-on-surface-variant">{p.supplier?.name || "—"}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.color}`}>{st.label}</span>
                        </div>
                      </button>
                    );
                  })}
                  <ListPageFooter {...pg} unit="kết quả" />
                </>
              )}
            </div>
          )}
        </>
      ) : (
        /* ===== TAB LUÂN CHUYỂN ===== */
        <div className="flex flex-col bg-surface rounded-xl p-md border border-outline-variant/30 shadow-sm">
          {loading ? (
            <div className="py-8 text-center">
              <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
            </div>
          ) : movements.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-8">Không có lịch sử</p>
          ) : (
            (() => {
              const pagedMovements = paged as MovementRow[];
              return (
                <>
                  {pagedMovements.map((m, i) => {
              const isLast = i === pagedMovements.length - 1;
              const meta = ACTION_ICON[m.movement_type] || { icon: "swap_horiz", color: "bg-slate-100 text-slate-700" };
              const fromCode = m.from_location?.code;
              const toCode = m.to_location?.code;
              const typeLabel = MOVEMENT_LABEL[m.movement_type] || m.movement_type;
              return (
                <div key={m.id} className="flex gap-md">
                  <div className="flex flex-col items-center pt-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${meta.color}`}>
                      <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
                    </div>
                    {!isLast && <div className="w-[2px] flex-1 bg-outline-variant/40 min-h-[20px] my-1" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-xs font-mono font-bold text-primary">{m.pallet?.code || "—"}</span>
                        <span className={`ml-1 px-1.5 py-0.5 rounded text-[11px] font-bold ${meta.color}`}>{typeLabel}</span>
                      </div>
                      <span className="text-[11px] text-on-surface-variant/70 whitespace-nowrap">
                        {fmtDateTime(m.performed_at)}
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5 flex items-center gap-1 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[12px]">location_on</span>
                      <span className="font-mono">{fromCode || "—"}</span>
                      <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                      <span className="font-mono">{toCode || "—"}</span>
                    </p>
                    {m.item_code?.code && (
                      <p className="text-[11px] text-on-surface-variant/80 mt-0.5">
                        {m.item_code.code}{m.item_code.short_name ? ` · ${m.item_code.short_name}` : ""}
                      </p>
                    )}
                    {m.performer?.full_name && (
                      <p className="text-[11px] text-on-surface-variant/70 mt-0.5">👤 {m.performer.full_name}</p>
                    )}
                  </div>
                </div>
              );
                  })}
                  <ListPageFooter {...pg} unit="kết quả" />
                </>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}
