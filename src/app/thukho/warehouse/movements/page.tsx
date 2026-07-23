"use client";
import { mobileHref } from "@/lib/mobile-href";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BackLink } from "@/components/mobile/BackLink";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const TYPE_TABS = [
  { key: "", label: "Tất cả" }, { key: "PUT_AWAY", label: "Xếp kho" },
  { key: "RELOCATE", label: "Chuyển" }, { key: "STAGE_OUT", label: "Xuất khu" },
  { key: "RETURN", label: "Hoàn trả" },
];

type MovementItem = {
  id: string;
  movement_type: string;
  performed_at: string;
  pallet?: { code?: string } | null;
  from_location?: { code?: string } | null;
  to_location?: { code?: string } | null;
  item_code?: { code?: string; short_name?: string } | null;
  performer?: { full_name?: string } | null;
};

const TYPE_LABEL: Record<string, string> = {
  PUT_AWAY: "Xếp kho",
  RELOCATE: "Chuyển",
  STAGE_OUT: "Xuất khu",
  RETURN: "Hoàn trả",
  ADJUSTMENT: "Điều chỉnh",
  OUTBOUND: "Xuất kho",
};

export default function ThukhoMovementsPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [moves, setMoves] = useState<MovementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("");
  const [search, setSearch] = useState("");
  const [searchQ, setSearchQ] = useState(""); // dùng để trigger re-fetch khi Enter

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (tab) params.set("type", tab);
    if (searchQ) params.set("q", searchQ);
    fetch(`${basePath}/api/movements?${params}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setMoves(j.data || []);
        else setError(j.error || "Lỗi tải dữ liệu");
      })
      .catch((e) => setError(e?.message || "Lỗi mạng"))
      .finally(() => setLoading(false));
  }, [tab, searchQ, basePath]);

  const getTypeColor = (t: string) => {
    switch (t) {
      case "PUT_AWAY": return "bg-green-100 text-green-700";
      case "RELOCATE": return "bg-blue-100 text-blue-700";
      case "STAGE_OUT": return "bg-amber-100 text-amber-700";
      case "RETURN": return "bg-purple-100 text-purple-700";
      case "OUTBOUND": return "bg-red-100 text-red-700";
      case "ADJUSTMENT": return "bg-gray-200 text-gray-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  // Phân trang client-side cho danh sách luân chuyển (reset khi đổi tab/tìm kiếm)
  // Hoãn từ khoá tìm kiếm trước khi đưa vào resetKey: nếu dùng giá trị thô thì
  // mỗi ký tự gõ là một lần nhảy về trang 1.
  const debouncedSearch = useDebouncedValue(searchQ);
  const pg = useClientPagination(moves, { resetKey: `${tab}|${debouncedSearch}` });
  const { paged: pagedMoves } = pg;

  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      <BackLink href="/thukho/warehouse">Kho hàng</BackLink>
      <h1 className="text-lg font-bold text-primary flex items-center gap-2">
        <span className="material-symbols-outlined">swap_horiz</span> Lịch sử luân chuyển
      </h1>
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">search</span>
        <input
          type="text"
          placeholder="Tìm mã pallet / mã hàng..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") setSearchQ(search.trim()); }}
          className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-lg text-sm bg-surface"
        />
      </div>
      <div className="flex gap-xs overflow-x-auto custom-scroll-hide">
        {TYPE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${tab === t.key ? "bg-primary text-white" : "bg-surface-low text-on-surface-variant"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-0 bg-surface rounded-xl p-md border border-outline-variant/30 shadow-sm">
        {loading ? (
          <div className="py-8 text-center">
            <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
          </div>
        ) : error ? (
          <p className="text-sm text-error text-center py-8">{error}</p>
        ) : moves.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-8">Không có lịch sử</p>
        ) : (
          pagedMoves.map((m, i) => {
            const fromCode = m.from_location?.code;
            const toCode = m.to_location?.code;
            const typeLabel = TYPE_LABEL[m.movement_type] || m.movement_type;
            return (
              <div key={m.id || i} className="flex gap-md">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  {i < pagedMoves.length - 1 && <div className="w-[1px] h-full bg-outline-variant/50 min-h-[30px]"></div>}
                </div>
                <div className="flex flex-col pb-sm flex-1">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs text-primary font-medium truncate">{m.pallet?.code || "—"}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[11px] md:text-xs font-bold whitespace-nowrap ${getTypeColor(m.movement_type)}`}>{typeLabel}</span>
                  </div>
                  <span className="text-[11px] md:text-xs text-on-surface-variant">
                    {fromCode || "—"} → {toCode || "—"}
                  </span>
                  {m.item_code?.code && (
                    <span className="text-[11px] md:text-xs text-on-surface-variant/80 mt-0.5">
                      {m.item_code.code}{m.item_code.short_name ? ` · ${m.item_code.short_name}` : ""}
                    </span>
                  )}
                  <span className="text-[11px] md:text-xs text-on-surface-variant/60 mt-0.5">
                    {m.performed_at ? new Date(m.performed_at).toLocaleString("vi-VN") : "—"}
                    {m.performer?.full_name ? ` · ${m.performer.full_name}` : ""}
                  </span>
                </div>
              </div>
            );
          })
        )}
        {!loading && !error && moves.length > 0 && (
          <ListPageFooter {...pg} unit="lượt" />
        )}
      </div>
    </div>
  );
}
