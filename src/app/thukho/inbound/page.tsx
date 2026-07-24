"use client";
import { mobileHref } from "@/lib/mobile-href";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

// UC-IN-02: Thủ kho tiếp nhận phiếu
type InboundItem = {
  id: string;
  code: string;
  status: string;
  expected_date: string | null;
  invoice_no: string | null;   // UC-IN-01: số hóa đơn — hiện trên thẻ để Thủ kho đối chiếu tờ giấy
  total_lines: number;
  supplier: { id: string; code: string; name: string } | null;
  creator: { id: string; full_name: string } | null;
  _count?: { lines: number };
  // Tổng SL từ lines
  total_qty?: number;
};

type Tab = "PENDING" | "RECEIVING" | "DONE";

const TABS: { key: Tab; label: string; statuses: string[] }[] = [
  { key: "PENDING", label: "Chờ tiếp nhận", statuses: ["PENDING"] },
  { key: "RECEIVING", label: "Đang chuẩn bị", statuses: ["RECEIVING", "RECONCILING"] },
  { key: "DONE", label: "Hoàn tất", statuses: ["COMPLETED"] },
];

export default function ThukhoInboundPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [items, setItems] = useState<InboundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("PENDING");
  // Tìm chung theo số hóa đơn HOẶC mã PHN. Gõ xong hỏi lại API (không giới hạn
  // số phiếu như lọc tại máy). API `/api/inbound?q=` đã tìm cả code lẫn invoice_no.
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    fetch(`${basePath}/api/inbound?${params}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setItems(j.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [basePath, debouncedSearch]);

  const currentTab = TABS.find((t) => t.key === tab)!;
  const filteredItems = items.filter((it) => currentTab.statuses.includes(it.status));
  const counts: Record<Tab, number> = {
    PENDING: items.filter((it) => TABS[0].statuses.includes(it.status)).length,
    RECEIVING: items.filter((it) => TABS[1].statuses.includes(it.status)).length,
    DONE: items.filter((it) => TABS[2].statuses.includes(it.status)).length,
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
  };

  const isNew = (d: string) => {
    if (!d) return false;
    const days = (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24);
    return days < 2;
  };

  // Phân trang client-side cho danh sách phiếu (reset khi đổi tab hoặc tìm kiếm)
  const pg = useClientPagination(filteredItems, { resetKey: `${tab}|${debouncedSearch}` });
  const { paged: pagedItems } = pg;

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      {/* Header banner xanh */}
      <div className="bg-primary text-white -mx-margin-mobile -mt-md px-margin-mobile py-4 mb-2">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px]">inbox</span>
          Phiếu cần tiếp nhận
        </h1>
      </div>

      {/* Ô tìm chung: số hóa đơn hoặc mã PHN — giúp Thủ kho tra nhanh theo tờ hóa đơn */}
      <div className="relative">
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          search
        </span>
        <input
          type="text"
          inputMode="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo số hóa đơn hoặc mã phiếu…"
          className="w-full min-h-[44px] pl-10 pr-9 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Xóa tìm kiếm"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-low text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

      {/* 3 Tabs */}
      <div className="flex gap-2 overflow-x-auto custom-scroll-hide">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "bg-surface-low text-on-surface-variant border border-outline-variant/40"
              }`}
            >
              {t.label} ({counts[t.key]})
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="flex flex-col gap-sm">
        {loading ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[40px] opacity-30 block">inbox</span>
            <p className="mt-2">Không có phiếu nào ở trạng thái này.</p>
          </div>
        ) : (
          pagedItems.map((item) => {
            const totalQty = item.total_qty || 0;
            return (
              <div
                key={item.id}
                className="industrial-card p-md rounded-xl bg-surface shadow-sm hover:border-primary/30 transition-all relative overflow-hidden border border-outline-variant/40"
              >
                {/* Border-left primary */}
                <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>

                <div className="flex justify-between items-start gap-2 pl-1">
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-mono text-sm text-primary font-bold">{item.code}</span>
                    <span className="text-[11px] text-on-surface-variant mt-0.5 truncate">
                      {item.supplier?.name || "Chưa rõ NCC"}
                      <span className="mx-1.5">·</span>
                      {item.total_lines} mã
                      {totalQty > 0 && (
                        <>
                          <span className="mx-1.5">·</span>
                          {totalQty} đv
                        </>
                      )}
                    </span>
                  </div>
                  {item.expected_date && isNew(item.expected_date) && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">
                      Mới
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-md mt-2 pl-1 text-[11px] text-on-surface-variant flex-wrap">
                  {item.invoice_no && (
                    <span className="flex items-center gap-1 font-semibold text-on-surface">
                      <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                      HĐ: {item.invoice_no}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                    Dự kiến {formatDate(item.expected_date)}
                  </span>
                  {item.creator && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">person</span>
                      {item.creator.full_name}
                    </span>
                  )}
                </div>

                {/* Action button — chỉ hiện cho PENDING/RECEIVING */}
                {item.status !== "COMPLETED" && (
                  <Link
                    href={mobileHref(`/thukho/inbound/${item.id}`)}
                    className="mt-3 ml-1 w-full py-2.5 bg-primary text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-primary-hover active:scale-[0.99] transition-all"
                  >
                    {item.status === "PENDING" ? "Tiếp nhận →" : "Tiếp tục →"}
                  </Link>
                )}
                {item.status === "COMPLETED" && (
                  <Link
                    href={mobileHref(`/thukho/inbound/${item.id}`)}
                    className="mt-3 ml-1 w-full py-2.5 bg-surface-low text-on-surface-variant rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border border-outline-variant"
                  >
                    Xem chi tiết
                  </Link>
                )}
              </div>
            );
          })
        )}
        {!loading && filteredItems.length > 0 && <ListPageFooter {...pg} unit="phiếu" />}
      </div>

      <p className="text-center text-[11px] text-on-surface-variant/60 mt-2">
        DS phiếu chờ tiếp nhận · UC-IN-02
      </p>
    </div>
  );
}
