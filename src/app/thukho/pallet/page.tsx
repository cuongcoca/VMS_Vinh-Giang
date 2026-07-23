"use client";
import { DateField } from "@/components/mobile";
import { mobileHref } from "@/lib/mobile-href";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ListPageFooter } from "@/components/ui/ListPagination";
import { useDebouncedValue, readSavedPaging } from "@/lib/use-debounced-value";

type PalletItem = {
  id: string;
  code: string;
  status: string;
  total_lines: number;
  total_weight_kg: string;
  created_at: string;
  confirmed_at: string | null;
  supplier: { id: string; code: string; name: string } | null;
  inbound_request?: { id: string; code: string } | null;
  location?: { id: string; code: string } | null;
};

// UC-PAL-01: 3 tab pill theo mockup — Đang xử lý / Đã xác nhận / Đã vào vị trí
const STATUS_TABS = [
  { key: "", label: "Tất cả", icon: "list", kpiKey: "TOTAL" },
  { key: "COUNTING", label: "Đang xử lý", icon: "hourglass_top", kpiKey: "COUNTING" },
  { key: "CONFIRMED", label: "Đã xác nhận", icon: "check_circle", kpiKey: "CONFIRMED" },
  { key: "IN_STORAGE", label: "Đã vào vị trí", icon: "shelves", kpiKey: "IN_STORAGE" },
];

const STATUS_META: Record<string, { label: string; chipBg: string; chipText: string; borderLeft: string }> = {
  EMPTY: { label: "Đang thêm hàng", chipBg: "bg-surface-low", chipText: "text-on-surface-variant", borderLeft: "bg-outline-variant" },
  COUNTING: { label: "Đang thêm hàng", chipBg: "bg-amber-100", chipText: "text-amber-700", borderLeft: "bg-amber-500" },
  CONFIRMED: { label: "Chờ xe nâng", chipBg: "bg-blue-100", chipText: "text-blue-700", borderLeft: "bg-blue-500" },
  IN_STORAGE: { label: "Trong kho", chipBg: "bg-emerald-100", chipText: "text-emerald-700", borderLeft: "bg-emerald-500" },
  IN_STAGING: { label: "Chờ xuất", chipBg: "bg-purple-100", chipText: "text-purple-700", borderLeft: "bg-purple-500" },
  RELEASED: { label: "Đã giải phóng", chipBg: "bg-surface-low", chipText: "text-on-surface-variant", borderLeft: "bg-surface-mid" },
  CANCELLED: { label: "Đã hủy", chipBg: "bg-rose-100", chipText: "text-rose-600", borderLeft: "bg-rose-400" },
};

export default function ThukhoPalletListPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [pallets, setPallets] = useState<PalletItem[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("");
  const [search, setSearch] = useState("");
  // UC-PAL-06 / TC_HISTORY_PAL_002+003: lọc theo ngày tạo + nhà cung cấp (mobile thủ kho)
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [suppliers, setSuppliers] = useState<{ id: string; code: string; name: string }[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const hasActiveFilter = !!(filterFrom || filterTo || filterSupplier);

  // Ô tìm kiếm gọi thẳng lên server nên phải hoãn, nếu không mỗi phím gõ là
  // một request (đo được 4 request khi gõ 4 ký tự).
  const debouncedSearch = useDebouncedValue(search);

  // Phân trang SERVER-SIDE. Trước đây trang này tải 200 bản ghi rồi cắt trang ở
  // client → kho >200 pallet thì phần dư không có cách nào xem được (đầu trang
  // ghi 230, chân trang ghi 200).
  // Khôi phục trang đang xem khi quay lại từ màn chi tiết.
  // Dùng sessionStorage giống `useClientPagination` — App Router không giữ
  // query string khi router.back() nên không lưu vào URL được.
  // Đọc ngay trong hàm khởi tạo state (không qua useEffect) để lần gọi API đầu
  // tiên đã đúng trang, tránh nạp trang 1 rồi nạp lại trang cũ.
  const storageKey = "wms:pagination:thukho-pallet";
  const [page, setPage] = useState(() => readSavedPaging(storageKey).page);
  const [limit, setLimit] = useState(() => readSavedPaging(storageKey).limit);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    try {
      if (page === 1 && limit === 10) window.sessionStorage.removeItem(storageKey);
      else window.sessionStorage.setItem(storageKey, JSON.stringify({ page, limit }));
    } catch {
      /* bỏ qua */
    }
  }, [page, limit]);

  // Đổi bộ lọc → về trang 1. So sánh giá trị thay vì cờ "lần chạy đầu" để
  // không bị React StrictMode chạy effect hai lần làm hỏng bước khôi phục.
  const filterKey = `${activeTab}|${debouncedSearch}|${filterFrom}|${filterTo}|${filterSupplier}`;
  const prevFilterKeyRef = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKeyRef.current === filterKey) return;
    prevFilterKeyRef.current = filterKey;
    setPage(1);
  }, [filterKey]);

  const fetchPallets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeTab) params.set("status", activeTab);
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      if (filterSupplier) params.set("supplier_id", filterSupplier);
      params.set("page", String(page));
      params.set("limit", String(limit));
      const res = await fetch(`${basePath}/api/pallets?${params}`);
      const json = await res.json();
      if (json.success) {
        setPallets(json.data || []);
        if (json.kpis) setKpis(json.kpis);
        if (json.pagination) {
          setTotal(json.pagination.total);
          setTotalPages(json.pagination.totalPages);
        }
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch, filterFrom, filterTo, filterSupplier, page, limit, basePath]);

  useEffect(() => { fetchPallets(); }, [fetchPallets]);

  // Tải danh sách NCC cho dropdown lọc (1 lần)
  useEffect(() => {
    fetch(`${basePath}/api/suppliers`)
      .then((r) => r.json())
      .then((r) => { if (r.success) setSuppliers(r.data || []); })
      .catch(() => {});
  }, [basePath]);

  // Không lọc lại ở client nữa: server đã lọc theo mã pallet / ghi chú / mã kệ /
  // tên NCC. Lọc hai lần với hai tiêu chí khác nhau khiến pallet server trả về
  // bị client giấu đi, kết quả tìm kiếm không đoán trước được.

  const formatTime = (iso: string | null | undefined) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    } catch { return null; }
  };

  // Server đã cắt trang sẵn nên `pallets` chính là dòng của trang hiện tại.
  const pagedPallets = pallets;
  const pg = {
    page,
    setPage,
    limit,
    setLimit,
    total,
    totalPages,
    from: total === 0 ? 0 : (page - 1) * limit + 1,
    to: Math.min(page * limit, total),
  };

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      {/* UC-PAL-01: Topbar mobile với title + FAB "+ Tạo" */}
      <div className="flex items-center justify-between sticky top-0 bg-surface-low/95 backdrop-blur-sm -mx-margin-mobile px-margin-mobile py-2 z-10">
        <div>
          <h1 className="text-lg font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px]">inventory_2</span>
            📦 Pallet của tôi
          </h1>
          <p className="text-[11px] md:text-xs text-on-surface-variant">
            {kpis.TOTAL ? `${kpis.TOTAL} pallet · ` : ""}Mã sinh theo PLYYMMDD.STT
          </p>
        </div>
        <Link
          href={mobileHref("/thukho/pallet/new")}
          className="px-3 py-2 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-primary-hover active:scale-95 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-sm">add</span> Tạo
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">search</span>
        <input
          type="text"
          placeholder="Tìm theo mã pallet, NCC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchPallets()}
          className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-lg text-sm bg-surface focus:outline-none focus:border-primary"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-rose-500"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>

      {/* UC-PAL-06 / TC_HISTORY_PAL_002+003: bộ lọc theo ngày + NCC */}
      <div>
        <button
          onClick={() => setShowFilter((v) => !v)}
          className={`flex items-center gap-1.5 text-xs font-semibold ${hasActiveFilter ? "text-primary" : "text-on-surface-variant"}`}
        >
          <span className="material-symbols-outlined text-[16px]">tune</span>
          Bộ lọc
          {hasActiveFilter && <span className="w-2 h-2 rounded-full bg-primary inline-block" />}
          <span className="material-symbols-outlined text-[16px]">{showFilter ? "expand_less" : "expand_more"}</span>
        </button>
        {showFilter && (
          <div className="mt-2 flex flex-col gap-2 bg-surface-low rounded-xl p-3 border border-outline-variant">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-on-surface-variant block mb-1">Từ ngày</label>
                <DateField
                  value={filterFrom}
                  onChange={(val) => setFilterFrom(val)}
                  className="border-outline-variant"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-on-surface-variant block mb-1">Đến ngày</label>
                <DateField
                  value={filterTo}
                  onChange={(val) => setFilterTo(val)}
                  className="border-outline-variant"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-on-surface-variant block mb-1">Nhà cung cấp</label>
              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="w-full px-2 py-1.5 border border-outline-variant rounded-lg text-xs bg-surface focus:outline-none focus:border-primary"
              >
                <option value="">Tất cả NCC</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                ))}
              </select>
            </div>
            {hasActiveFilter && (
              <button
                onClick={() => { setFilterFrom(""); setFilterTo(""); setFilterSupplier(""); }}
                className="self-end text-xs font-semibold text-rose-600 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">close</span> Xóa lọc
              </button>
            )}
          </div>
        )}
      </div>

      {/* UC-PAL-01: 3 tab pill (+ Tất cả) với count */}
      <div className="flex gap-2 overflow-x-auto custom-scroll-hide pb-1">
        {STATUS_TABS.map((tab) => {
          const count = kpis[tab.kpiKey] ?? 0;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                active
                  ? "bg-primary text-white shadow"
                  : "bg-white text-on-surface-variant border border-outline-variant hover:bg-surface-low"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
              {tab.label}
              {count > 0 && (
                <span className={`text-[11px] md:text-xs font-bold ${active ? "text-white/80" : "text-on-surface-variant/60"}`}>
                  ({count})
                </span>
              )}
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
        ) : pagedPallets.length === 0 ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">inventory_2</span>
            <p className="text-sm text-on-surface-variant mt-2">Không có pallet nào</p>
            <Link
              href={mobileHref("/thukho/pallet/new")}
              className="inline-flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold mt-3"
            >
              <span className="material-symbols-outlined text-[16px]">add</span> Tạo pallet đầu tiên
            </Link>
          </div>
        ) : (
          pagedPallets.map((p) => {
            const meta = STATUS_META[p.status] || STATUS_META.EMPTY;
            const timeLabel = p.status === "COUNTING"
              ? `⏱ ${formatTime(p.created_at) || ""}`
              : p.status === "CONFIRMED"
                ? `📍 XN ${formatTime(p.confirmed_at) || ""}`
                : null;
            return (
              <Link
                key={p.id}
                href={mobileHref(`/thukho/pallet/${p.id}`)}
                className="industrial-card p-md rounded-xl flex flex-col gap-1.5 bg-surface shadow-sm hover:border-primary/30 transition-all relative overflow-hidden active:scale-[0.99]"
              >
                {/* UC-PAL-01: Border-left color theo status */}
                <div className={`absolute top-0 left-0 w-1 h-full ${meta.borderLeft}`}></div>

                <div className="flex justify-between items-start pl-1">
                  <span className="font-mono text-sm text-primary font-bold">{p.code}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold ${meta.chipBg} ${meta.chipText}`}>
                    {meta.label}
                  </span>
                </div>

                {/* Sub line: N dòng + tên NCC */}
                <div className="pl-1 text-[11px] md:text-xs text-on-surface-variant">
                  {p.total_lines > 0 ? (
                    <>
                      {p.total_lines} dòng hàng
                      {p.supplier?.name && <> · {p.supplier.name}</>}
                    </>
                  ) : (
                    <span className="italic">Chưa có hàng</span>
                  )}
                </div>

                {/* Meta line: PHN badge + location + time */}
                <div className="pl-1 flex flex-wrap items-center gap-1.5 text-[11px] md:text-xs">
                  {p.inbound_request?.code ? (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                      <span className="material-symbols-outlined text-[11px]">link</span>
                      {p.inbound_request.code}
                    </span>
                  ) : (
                    p.status === "COUNTING" && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold" title="Pallet chưa liên kết phiếu nhập">
                        <span className="material-symbols-outlined text-[11px]">warning</span>
                        Chưa liên kết
                      </span>
                    )
                  )}
                  {p.location?.code && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                      <span className="material-symbols-outlined text-[11px]">location_on</span>
                      {p.location.code}
                    </span>
                  )}
                  {timeLabel && <span className="text-on-surface-variant/80">{timeLabel}</span>}
                  {!p.inbound_request?.code && !p.location?.code && !timeLabel && p.total_weight_kg && Number(p.total_weight_kg) > 0 && (
                    <span className="text-on-surface-variant/80">⚖ {p.total_weight_kg} kg</span>
                  )}
                </div>
              </Link>
            );
          })
        )}
        {!loading && total > 0 && <ListPageFooter {...pg} unit="pallet" />}
      </div>
    </div>
  );
}
