"use client";
import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import Link from "next/link";

type LocationRow = {
  id: string; code: string; zone: string; rack: string; level: string;
  status: string;
  max_pallets: number | null;
  max_weight_kg: number | null;
  has_pallet: boolean;
  total_qty_box: number;
  total_weight_kg: number;
  item_names: string;
  pallet_count: number;
  has_expiring_soon: boolean;
};

type ZoneSummary = { zone: string; total: number; occupied: number; empty: number };

type LineRow = {
  pallet_id: string; pallet_code: string; pallet_status: string;
  line_id: string;
  item_code_id: string; item_code: string; item_name: string;
  lot: string | null;
  manufactured_date: string | null;
  expiry_date: string | null;
  qty_box: number;
  weight_kg: number;
};

type RackmateRow = {
  code: string;
  level: string;
  has_pallet: boolean;
  pallet_count: number;
  max_pallets: number | null;
  visual: "ACTIVE" | "EMPTY" | "LOCKED" | "EXPIRING";
  is_current: boolean;
};

type LocationDetail = {
  id: string; code: string; zone: string; rack: string; level: string;
  status: string;
  max_pallets: number | null;
  max_weight_kg: number | null;
  current_pallets: number;
  current_weight_kg: number;
  lines: LineRow[];
  rackmates: RackmateRow[];
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  EMPTY: { label: "Trống", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  USING: { label: "Đang chứa", color: "bg-amber-50 text-amber-700 border-amber-200" },
  RESERVED: { label: "Đã đặt", color: "bg-blue-50 text-blue-700 border-blue-200" },
  MAINTENANCE: { label: "Bảo trì", color: "bg-rose-50 text-rose-700 border-rose-200" },
  LOCKED: { label: "Khóa", color: "bg-rose-100 text-rose-700 border-rose-300" },
};

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("vi-VN") : "—");

export default function ByLocationPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [data, setData] = useState<LocationRow[]>([]);
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState("");
  const [searchCode, setSearchCode] = useState("");
  const [searchZone, setSearchZone] = useState("");
  const [detail, setDetail] = useState<LocationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load list
  const loadList = useCallback(() => {
    setLoading(true);
    fetch(`${basePath}/api/inventory/by-location`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          setData(r.data);
          setZones(r.zones);
          if (!selectedZone && r.zones.length) setSelectedZone(r.zones[0].zone);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [basePath, selectedZone]);

  useEffect(() => { loadList(); }, [loadList]);

  // Lookup detail
  const lookupCode = (codeRaw: string, zoneFilter?: string) => {
    const code = codeRaw.trim().toUpperCase();
    if (!code) {
      setError("Vui lòng nhập mã vị trí.");
      return;
    }
    setError(null);
    setDetailLoading(true);
    const params = new URLSearchParams({ code });
    if (zoneFilter) params.set("zone", zoneFilter);
    fetch(`${basePath}/api/inventory/by-location?${params}`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success && r.detail) {
          setDetail(r.detail);
          setSelectedZone(r.detail.zone);
        } else {
          setDetail(null);
          setError(`Không tìm thấy vị trí "${code}".`);
        }
      })
      .catch((e) => setError(e?.message || "Lỗi tra cứu."))
      .finally(() => setDetailLoading(false));
  };

  // Click 1 ô grid → lookup
  const onClickLocation = (code: string) => {
    setSearchCode(code);
    lookupCode(code);
  };

  // Click sửa số tồn → mở adjustment pre-fill
  const adjustHref = (l: LineRow) => {
    const params = new URLSearchParams({
      pallet_id: l.pallet_id,
      pallet_code: l.pallet_code,
      item_code_id: l.item_code_id,
      item_code: l.item_code,
      item_name: l.item_name,
      location_id: detail?.id || "",
      location_code: detail?.code || "",
      lot: l.lot || "",
      qty_before: String(l.qty_box),
      from: "by-location",
    });
    return `/inventory/adjustments/new?${params}`;
  };

  // Xuất Excel = CSV download (đơn giản, không cần lib)
  const exportCSV = () => {
    if (!detail) return;
    const rows = [
      ["Pallet", "Mã hàng", "Tên hàng", "Lô", "NSX", "HSD", "SL còn", "KG", "Trạng thái pallet"],
      ...detail.lines.map((l) => [
        l.pallet_code, l.item_code, l.item_name, l.lot || "",
        fmtDate(l.manufactured_date), fmtDate(l.expiry_date),
        String(l.qty_box), String(l.weight_kg), l.pallet_status,
      ]),
    ];
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ton-vi-tri-${detail.code}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = selectedZone ? data.filter((d) => d.zone === selectedZone) : data;

  const getGridColor = (loc: LocationRow) => {
    if (loc.status === "MAINTENANCE" || loc.status === "LOCKED") return "bg-rose-200 text-rose-900";
    if (loc.has_expiring_soon) return "bg-amber-200 text-amber-900";
    if (loc.has_pallet) return "bg-emerald-500 text-white";
    return "bg-slate-200 text-slate-700";
  };

  const getRackmateColor = (r: RackmateRow) => {
    if (r.is_current) return "ring-4 ring-blue-500 bg-blue-500 text-white";
    if (r.visual === "LOCKED") return "bg-rose-400 text-white";
    if (r.visual === "EXPIRING") return "bg-amber-400 text-amber-900";
    if (r.visual === "ACTIVE") return "bg-emerald-500 text-white";
    return "bg-slate-300 text-slate-700";
  };

  return (
    <AppLayout title="TỒN KHO THEO VỊ TRÍ">
      <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
        <BackButton fallback="/inventory">Quay lại</BackButton>
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[28px]">grid_view</span>
          Tồn kho theo vị trí
        </h1>

        {/* Khu tabs */}
        <div className="flex gap-2 flex-wrap">
          {zones.map((z) => (
            <button
              key={z.zone}
              onClick={() => { setSelectedZone(z.zone); setDetail(null); setSearchCode(""); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                selectedZone === z.zone ? "bg-primary text-white" : "bg-surface-low hover:bg-surface-mid"
              }`}
            >
              Khu {z.zone} <span className="text-xs opacity-70">({z.occupied}/{z.total})</span>
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-4 flex gap-3 items-center flex-wrap">
          <span className="material-symbols-outlined text-[28px] text-rose-500">location_on</span>
          <div className="flex-1 min-w-[200px]">
            <p className="text-xs text-on-surface-variant mb-1">Mã vị trí</p>
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") lookupCode(searchCode, searchZone); }}
              placeholder="VD: A-03-02"
              className="w-full px-3 py-2 border border-outline-variant rounded-lg font-mono uppercase"
            />
          </div>
          <div className="w-[150px]">
            <p className="text-xs text-on-surface-variant mb-1">Khu</p>
            <select
              value={searchZone}
              onChange={(e) => setSearchZone(e.target.value)}
              className="w-full px-3 py-2 border border-outline-variant rounded-lg"
            >
              <option value="">— Tất cả —</option>
              {zones.map((z) => <option key={z.zone} value={z.zone}>Khu {z.zone}</option>)}
            </select>
          </div>
          <button
            onClick={() => lookupCode(searchCode, searchZone)}
            disabled={detailLoading}
            className="px-5 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 self-end"
          >
            {detailLoading ? "Đang tra…" : "Tra cứu"}
          </button>
          <button
            onClick={exportCSV}
            disabled={!detail}
            className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 self-end flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Xuất Excel
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Grid layout — khi chưa có detail */}
        {!detail && (
          loading ? (
            <div className="flex justify-center py-12">
              <span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-5">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                {filtered.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => onClickLocation(loc.code)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-bold transition-all hover:ring-2 hover:ring-primary/30 ${getGridColor(loc)}`}
                  >
                    <span>{loc.code}</span>
                    {loc.has_pallet && (
                      <span className="text-[8px] mt-0.5 opacity-80">
                        {loc.pallet_count}/{loc.max_pallets || "—"}P
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-4 mt-4 text-[11px] flex-wrap">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" /> Có hàng</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400" /> Sắp HSD</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-300" /> Trống</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-400" /> Bảo trì / Khóa</span>
              </div>
            </div>
          )
        )}

        {/* Detail view */}
        {detail && (
          <>
            {/* Info card — UC-INV-02 chi tiết vị trí */}
            {(() => {
              const fmtNum = (n: number) => n.toLocaleString("vi-VN");
              const palletPct = detail.max_pallets && detail.max_pallets > 0
                ? Math.min(100, (detail.current_pallets / detail.max_pallets) * 100)
                : null;
              const palletOver = detail.max_pallets != null && detail.current_pallets > detail.max_pallets;
              const weightPct = detail.max_weight_kg && detail.max_weight_kg > 0
                ? Math.min(100, (detail.current_weight_kg / detail.max_weight_kg) * 100)
                : null;
              const weightOver = detail.max_weight_kg != null && detail.current_weight_kg > detail.max_weight_kg;
              const weightOverRatio = weightOver && detail.max_weight_kg
                ? (detail.current_weight_kg / detail.max_weight_kg)
                : null;
              const isOverCapacity = palletOver || weightOver;
              return (
                <div className={`bg-white rounded-xl shadow-sm p-5 border ${isOverCapacity ? "border-rose-300 ring-1 ring-rose-200" : "border-outline-variant"}`}>
                  {/* Header dòng địa chỉ */}
                  <div className="flex items-baseline gap-3 mb-3 flex-wrap">
                    <span className="material-symbols-outlined text-[24px] text-rose-500">location_on</span>
                    <p className="text-lg">
                      Vị trí: <strong className="font-mono">{detail.code}</strong>
                      <span className="text-on-surface-variant"> · Khu {detail.zone} · Kệ {detail.rack} · Tầng {detail.level}</span>
                    </p>
                    {(() => {
                      const st = STATUS_BADGE[detail.status] || { label: detail.status, color: "bg-surface-low" };
                      return <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${st.color}`}>{st.label}</span>;
                    })()}
                    {isOverCapacity && (
                      <span className="px-2 py-0.5 rounded-full border border-rose-300 bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">warning</span>
                        QUÁ TẢI
                      </span>
                    )}
                  </div>

                  {/* 3 metric cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Card 1: Sức chứa pallet */}
                    <div
                      className="border border-outline-variant/60 rounded-lg p-3"
                      title="Sức chứa = số pallet TỐI ĐA được phép đặt ở vị trí này (cấu hình lúc tạo vị trí)"
                    >
                      <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">pallet</span>
                        Sức chứa pallet
                      </p>
                      <p className="data-mono text-2xl font-bold mt-1">
                        {detail.max_pallets != null ? fmtNum(detail.max_pallets) : "∞"}
                      </p>
                      <p className="text-[11px] text-on-surface-variant/70 mt-0.5">
                        {detail.max_pallets != null ? "pallet tối đa" : "Không giới hạn"}
                      </p>
                    </div>

                    {/* Card 2: Đang chứa pallet */}
                    <div
                      className={`border rounded-lg p-3 ${palletOver ? "border-rose-300 bg-rose-50" : "border-outline-variant/60"}`}
                      title="Đang chứa = số pallet vật lý hiện đang đặt ở vị trí (1 pallet có thể chứa nhiều dòng hàng)"
                    >
                      <p className={`text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${palletOver ? "text-rose-700" : "text-on-surface-variant"}`}>
                        <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                        Đang chứa
                      </p>
                      <p className={`data-mono text-2xl font-bold mt-1 ${palletOver ? "text-rose-700" : ""}`}>
                        {fmtNum(detail.current_pallets)}
                        {detail.max_pallets != null && (
                          <span className="text-sm font-normal text-on-surface-variant/70"> / {fmtNum(detail.max_pallets)}</span>
                        )}
                      </p>
                      {palletPct != null && (
                        <div className="w-full h-1.5 bg-surface-high mt-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${palletOver ? "bg-rose-500" : palletPct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${palletPct}%` }}
                          />
                        </div>
                      )}
                      <p className="text-[11px] text-on-surface-variant/70 mt-1">
                        {palletOver ? `Vượt ${detail.current_pallets - (detail.max_pallets || 0)} pallet` : detail.max_pallets ? `${palletPct?.toFixed(0)}% sức chứa` : "—"}
                      </p>
                    </div>

                    {/* Card 3: Trọng lượng */}
                    <div
                      className={`border rounded-lg p-3 ${weightOver ? "border-rose-300 bg-rose-50" : "border-outline-variant/60"}`}
                      title="Trọng lượng hiện tại / tối đa cho phép. Vượt mức có nguy cơ gãy kệ — phải kiểm tra ngay."
                    >
                      <p className={`text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${weightOver ? "text-rose-700" : "text-on-surface-variant"}`}>
                        <span className="material-symbols-outlined text-[14px]">scale</span>
                        Trọng lượng
                      </p>
                      <p className={`data-mono text-2xl font-bold mt-1 ${weightOver ? "text-rose-700" : ""}`}>
                        {fmtNum(detail.current_weight_kg)}
                        {detail.max_weight_kg != null && (
                          <span className="text-sm font-normal text-on-surface-variant/70"> / {fmtNum(detail.max_weight_kg)}</span>
                        )}
                        <span className="text-sm font-normal text-on-surface-variant/70"> kg</span>
                      </p>
                      {weightPct != null && (
                        <div className="w-full h-1.5 bg-surface-high mt-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${weightOver ? "bg-rose-500" : weightPct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${weightPct}%` }}
                          />
                        </div>
                      )}
                      <p className="text-[11px] mt-1">
                        {weightOver && weightOverRatio ? (
                          <span className="text-rose-700 font-semibold">
                            ⚠ Vượt {weightOverRatio < 2
                              ? `${((weightOverRatio - 1) * 100).toFixed(0)}%`
                              : `${weightOverRatio.toFixed(1)}× sức chứa`}
                          </span>
                        ) : detail.max_weight_kg ? (
                          <span className="text-on-surface-variant/70">{weightPct?.toFixed(0)}% sức chứa</span>
                        ) : (
                          <span className="text-on-surface-variant/70">Không giới hạn</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Cảnh báo dài khi quá tải */}
                  {isOverCapacity && (
                    <div className="mt-3 bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-800 flex items-start gap-2">
                      <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
                      <span>
                        <strong>Vị trí này đang quá tải.</strong> Có thể do (1) data nhập sai khi tạo pallet (kiểm tra `weight_per_box` của mã hàng), (2) cấu hình `max_weight_kg` của vị trí quá thấp, hoặc (3) thủ kho xếp nhầm pallet vào vị trí không phù hợp. Đề nghị kiểm tra & điều chỉnh ngay.
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => { setDetail(null); setSearchCode(""); }}
                    className="mt-3 text-xs text-secondary hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                    Đóng chi tiết
                  </button>
                </div>
              );
            })()}

            {/* Lines table */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-low">
                  <tr className="text-left label-caps text-on-surface-variant">
                    <th className="px-3 py-2 font-semibold">PALLET</th>
                    <th className="px-3 py-2 font-semibold">MÃ HÀNG</th>
                    <th className="px-3 py-2 font-semibold">TÊN HÀNG</th>
                    <th className="px-3 py-2 font-semibold">LÔ</th>
                    <th className="px-3 py-2 font-semibold">NSX</th>
                    <th className="px-3 py-2 font-semibold">HSD</th>
                    <th className="px-3 py-2 font-semibold text-right">SL CÒN</th>
                    <th className="px-3 py-2 font-semibold">TRẠNG THÁI</th>
                    <th className="px-3 py-2 font-semibold text-center">HÀNH ĐỘNG</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-on-surface-variant">
                        Vị trí này chưa có pallet.
                      </td>
                    </tr>
                  ) : (
                    detail.lines.map((l, i) => {
                      const expDate = l.expiry_date ? new Date(l.expiry_date) : null;
                      const isExpiringSoon = expDate && expDate.getTime() - Date.now() < 30 * 86400000;
                      return (
                        <tr key={`${l.pallet_id}-${l.line_id}`} className={i > 0 ? "border-t border-outline-variant/50" : ""}>
                          <td className="px-3 py-3 font-mono font-bold text-primary">
                            <Link href={`/pallets/${l.pallet_id}`} className="hover:underline">{l.pallet_code}</Link>
                          </td>
                          <td className="px-3 py-3 font-mono">{l.item_code}</td>
                          <td className="px-3 py-3">{l.item_name}</td>
                          <td className="px-3 py-3 font-mono text-xs">{l.lot || "—"}</td>
                          <td className="px-3 py-3 text-xs">{fmtDate(l.manufactured_date)}</td>
                          <td className={`px-3 py-3 text-xs ${isExpiringSoon ? "text-rose-600 font-semibold" : ""}`}>
                            {fmtDate(l.expiry_date)}
                            {isExpiringSoon && <span className="ml-1">⚠</span>}
                          </td>
                          <td className="px-3 py-3 text-right data-mono font-bold">{l.qty_box}</td>
                          <td className="px-3 py-3">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                              Khả dụng
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <Link
                              href={adjustHref(l)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-white rounded text-xs font-semibold hover:bg-amber-600"
                            >
                              <span className="material-symbols-outlined text-[14px]">edit</span>
                              Sửa số tồn
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Hint */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] flex-shrink-0">warning</span>
              <span>
                <strong>Khi kiểm thấy không đúng:</strong> Bấm "Sửa số tồn" trên dòng cần chỉnh
                → hệ thống mở màn hình <strong>Điều chỉnh số tồn về thực tế</strong> (UC-INV-09)
                đã pre-fill thông tin pallet/lô/vị trí. Người dùng nhập SL thực, lý do, lưu —
                phiếu điều chỉnh chuyển sang Quản lý duyệt.
              </span>
            </div>

            {/* Sơ đồ kệ */}
            {detail.rackmates.length > 0 && (
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-5">
                <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-1">
                  🛒 Sơ đồ khu {detail.zone} — Kệ {detail.rack}
                </h3>
                <div className="flex gap-2 flex-wrap">
                  {detail.rackmates.map((r) => (
                    <button
                      key={r.code}
                      onClick={() => !r.is_current && onClickLocation(r.code)}
                      disabled={r.is_current}
                      className={`w-20 h-20 rounded-lg flex flex-col items-center justify-center text-xs font-bold transition-all ${getRackmateColor(r)} ${
                        !r.is_current ? "hover:opacity-80 cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <span>{r.code}</span>
                      {r.is_current ? (
                        <span className="text-[10px] mt-0.5">★</span>
                      ) : r.visual === "LOCKED" ? (
                        <span className="text-[10px] mt-0.5">Khóa</span>
                      ) : r.visual === "EXPIRING" ? (
                        <span className="text-[10px] mt-0.5">HSD</span>
                      ) : (
                        <span className="text-[10px] mt-0.5">{r.pallet_count}/{r.max_pallets || "—"}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
