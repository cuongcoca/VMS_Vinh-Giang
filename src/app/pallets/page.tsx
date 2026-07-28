"use client";
import { fetchJson } from "@/lib/api";
import { useToast, ListPageFooter } from "@/components/ui";

import React, { Suspense, useState, useEffect, useRef } from "react";
import { useDebouncedValue, readSavedPaging } from "@/lib/use-debounced-value";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { ExcelExport } from "@/components/ExcelExport";

type Supplier = { id: string; code: string; name: string };
type InboundOption = { id: string; code: string; invoice_no?: string | null; supplier_id: string | null; supplier?: Supplier | null; status: string };
type Pallet = {
  id: string;
  code: string;
  code_date: string;
  code_seq: number;
  status: string;
  supplier_id: string | null;
  supplier: Supplier | null;
  inbound_request_id: string | null;
  inbound_request: { id: string; code: string } | null;
  inbound_date: string | null;
  note: string | null;
  total_lines: number;
  total_weight_kg: string;
  confirmed_at: string | null;
  created_at: string;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  EMPTY: { label: "Đang thêm hàng", color: "bg-surface-low text-on-surface-variant", icon: "inventory_2" },
  COUNTING: { label: "Đang thêm hàng", color: "bg-blue-50 text-blue-700", icon: "fact_check" },
  CONFIRMED: { label: "Đã xác nhận", color: "bg-emerald-50 text-emerald-700", icon: "check_circle" },
  IN_STORAGE: { label: "Trong kho", color: "bg-indigo-50 text-indigo-700", icon: "warehouse" },
  IN_STAGING: { label: "Chờ xuất", color: "bg-amber-50 text-amber-700", icon: "outbox" },
  RELEASED: { label: "Đã xuất", color: "bg-purple-50 text-purple-700", icon: "local_shipping" },
  CANCELLED: { label: "Đã hủy", color: "bg-rose-50 text-rose-600", icon: "cancel" },
};

export default function PalletsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Đang tải...</div>}>
      <PalletsContent />
    </Suspense>
  );
}

function PalletsContent() {
  const { toast } = useToast();
  const urlParams = useSearchParams();
  const newPhnId = urlParams.get("new_phn") || "";
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  // Phase 3.5 — TC_HISTORY_PAL_002/_003: filter ngày + NCC
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");

  // Ô tìm kiếm gọi thẳng lên server → phải hoãn để mỗi phím gõ không là 1 request.
  const debouncedSearch = useDebouncedValue(searchQuery);

  // Phân trang server-side. Nhớ trang đang xem khi mở chi tiết rồi quay lại —
  // dùng sessionStorage chứ không phải URL: App Router dựng lại địa chỉ từ state
  // nội bộ khi router.back() nên query string bị mất.
  const pageStorageKey = "wms:pagination:wms-pallets";
  const [page, setPage] = useState(() => readSavedPaging(pageStorageKey).page);
  const [limit, setLimit] = useState(() => readSavedPaging(pageStorageKey).limit);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    try {
      if (page === 1 && limit === 10) window.sessionStorage.removeItem(pageStorageKey);
      else window.sessionStorage.setItem(pageStorageKey, JSON.stringify({ page, limit }));
    } catch {
      /* bỏ qua */
    }
  }, [page, limit]);

  // Đổi bộ lọc → về trang 1. So sánh giá trị thay vì cờ "lần chạy đầu" để không
  // bị React StrictMode chạy effect hai lần làm hỏng bước khôi phục.
  const filterKey = `${debouncedSearch}|${filterStatus}|${filterFrom}|${filterTo}|${filterSupplier}`;
  const prevFilterKeyRef = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKeyRef.current === filterKey) return;
    prevFilterKeyRef.current = filterKey;
    setPage(1);
  }, [filterKey]);

  const [showModal, setShowModal] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  // UC-PAL-01: load PHN open (status PENDING/RECEIVING) để chọn khi tạo pallet
  const [openInbounds, setOpenInbounds] = useState<InboundOption[]>([]);
  const [form, setForm] = useState({
    inbound_request_id: "",
    supplier_id: "",
    inbound_date: "",
    note: "",
  });
  const [dateError, setDateError] = useState<string | null>(null);

  // Phase 3.1 — TC_CREATE_PAL_008 + L2 fix: validate inline thay vì toast spam
  const MAX_FUTURE_DAYS = 30;
  const maxAllowedDateStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + MAX_FUTURE_DAYS);
    return d.toISOString().slice(0, 10);
  })();

  const validateInboundDate = (val: string): string | null => {
    if (!val) return null;
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "Ngày không hợp lệ.";
    const year = d.getUTCFullYear();
    if (year < 2020 || year > 2100) return "Năm phải trong khoảng 2020 – 2100.";
    const maxAllowed = new Date();
    maxAllowed.setHours(23, 59, 59, 999);
    maxAllowed.setDate(maxAllowed.getDate() + MAX_FUTURE_DAYS);
    if (d.getTime() > maxAllowed.getTime()) {
      return `Không cho phép Ngày nhập quá ${MAX_FUTURE_DAYS} ngày trong tương lai.`;
    }
    return null;
  };

  const onInboundDateChange = (val: string) => {
    setForm((f) => ({ ...f, inbound_date: val }));
    setDateError(validateInboundDate(val));
  };
  const [saving, setSaving] = useState(false);

  // Fetch pallets — Phase 3.5: thêm from/to/supplier_id
  // Phân trang SERVER-SIDE: trước đây API cắt 200 bản ghi rồi client mới chia trang,
  // nên kho >200 pallet thì phần dư không xem được từ màn này.
  const fetchPallets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (filterStatus) params.set("status", filterStatus);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      if (filterSupplier) params.set("supplier_id", filterSupplier);
      params.set("page", String(page));
      params.set("limit", String(limit));
      const res = await fetch(`/wms/api/pallets?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setPallets(result.data);
        setKpis(result.kpis || {});
        if (result.pagination) {
          setTotal(result.pagination.total);
          setTotalPages(result.pagination.totalPages);
        }
      }
    } catch (err) {
      console.error("Fetch pallets error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch suppliers cho dropdown
  const fetchSuppliers = async () => {
    try {
      const body = await fetchJson<{ data?: unknown[] }>("/wms/api/suppliers");
      setSuppliers((body.data ?? []) as typeof suppliers);
    } catch (err) {
      console.error("Fetch suppliers error:", err);
    }
  };

  // 1 phiếu — nhiều pallet: hiện MỌI phiếu đang mở (kể cả đã có pallet) để tạo thêm pallet.
  // Pallet đầu copy dòng cho nhanh; pallet thứ 2+ để trống, Thủ kho quét hàng thực tế lên.
  const fetchOpenInbounds = async () => {
    try {
      const res = await fetch("/wms/api/inbound");
      const result = await res.json();
      if (result.success) {
        const open = (result.data as InboundOption[]).filter(
          (i) =>
            i.status === "PENDING" ||
            i.status === "RECEIVING" ||
            i.status === "RECONCILING"
        );
        setOpenInbounds(open);
      }
    } catch (err) {
      console.error("Fetch open inbounds error:", err);
    }
  };

  useEffect(() => {
    fetchPallets();
    fetchSuppliers();
    fetchOpenInbounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filterStatus, filterFrom, filterTo, filterSupplier, page, limit]);

  // Auto-open modal nếu URL có ?new_phn=X (link từ /wms/inbound/[id])
  useEffect(() => {
    if (newPhnId && openInbounds.length > 0) {
      const phn = openInbounds.find((i) => i.id === newPhnId);
      if (phn) {
        setForm({
          inbound_request_id: newPhnId,
          supplier_id: phn.supplier_id || "",
          inbound_date: "",
          note: "",
        });
        setShowModal(true);
      }
    }
  }, [newPhnId, openInbounds]);

  // Tạo pallet — Phase 3.1 TC_CREATE_PAL_008 validate Ngày nhập
  // L2 fix: validate đã chạy trên onChange, đây là safety net không spam toast
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateInboundDate(form.inbound_date);
    if (err) {
      setDateError(err);
      return; // Inline error đã hiện, không cần toast
    }
    setSaving(true);
    try {
      const res = await fetch("/wms/api/pallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inbound_request_id: form.inbound_request_id || null,
          supplier_id: form.supplier_id || null,
          inbound_date: form.inbound_date || null,
          note: form.note || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setShowModal(false);
        setForm({ inbound_request_id: "", supplier_id: "", inbound_date: "", note: "" });
        // Phương án A: hiện toast về số lines đã copy + warnings
        if (result.copied_lines_count > 0) {
          toast.success(
            `Đã tạo pallet ${result.data.code} với ${result.copied_lines_count} dòng hàng tự copy từ PHN.`
          );
        } else {
          toast.success(`Đã tạo pallet ${result.data.code}.`);
        }
        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach((w: string) => toast.error(w));
        }
        fetchPallets();
      } else {
        toast.error(result.error || "Lỗi khi tạo pallet.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối.");
    } finally {
      setSaving(false);
    }
  };

  // Hủy pallet
  const handleCancel = async (id: string, code: string) => {
    if (!confirm(`Hủy pallet "${code}"?`)) return;
    try {
      const res = await fetch(`/wms/api/pallets/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) fetchPallets();
      else toast.error(result.error);
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("vi-VN");
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
    <AppLayout title="PALLET">
      <div className="p-6 space-y-5 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">Quản lý Pallet</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Tạo và theo dõi pallet hàng hóa — mã tự sinh theo định dạng PLYYMMDD.STT
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExcelExport
              data={pallets as unknown as Record<string, unknown>[]}
              columns={[
                { key: "code", header: "Mã Pallet" },
                { key: "status", header: "Trạng thái", transform: (v) => STATUS_MAP[v as string]?.label || String(v) },
                { key: "supplier", header: "NCC", transform: (v) => (v as Supplier)?.name || "" },
                { key: "inbound_date", header: "Ngày nhập", transform: (v) => v ? new Date(v as string).toLocaleDateString("vi-VN") : "" },
                { key: "total_lines", header: "Số dòng" },
                { key: "total_weight_kg", header: "Tổng KL (kg)" },
                { key: "note", header: "Ghi chú" },
                { key: "created_at", header: "Ngày tạo", transform: (v) => v ? new Date(v as string).toLocaleDateString("vi-VN") : "" },
              ]}
              filename="danh_sach_pallet"
            />
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/pallets/qr-print`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm border border-outline-variant hover:bg-surface-low rounded-lg flex items-center gap-2 font-medium transition-colors text-on-surface"
            title="Mở trang in QR tất cả pallet (Ctrl+P để in)"
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
            In QR
          </a>
          <button
            onClick={() => { setShowModal(true); setForm({ inbound_request_id: "", supplier_id: "", inbound_date: "", note: "" }); }}
            className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Tạo pallet
          </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { key: "TOTAL", label: "Tổng", color: "text-on-surface" },
            { key: "EMPTY", label: "Đang thêm hàng", color: "text-on-surface-variant" },
            { key: "COUNTING", label: "Đang thêm hàng", color: "text-blue-600" },
            { key: "CONFIRMED", label: "Đã xác nhận", color: "text-emerald-600" },
            { key: "IN_STORAGE", label: "Trong kho", color: "text-indigo-600" },
          ].map(({ key, label, color }) => (
            <div
              key={key}
              onClick={() => key !== "TOTAL" ? setFilterStatus(filterStatus === key ? "" : key) : setFilterStatus("")}
              className={`bg-white p-4 rounded-xl border shadow-sm cursor-pointer transition-all ${
                filterStatus === key ? "border-primary ring-2 ring-primary/10 scale-[1.02]" : "border-outline-variant hover:border-outline-variant"
              }`}
            >
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{label}</span>
              <span className={`text-2xl font-bold mt-2 block ${color}`}>{kpis[key] || 0}</span>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
            <input
              type="text"
              placeholder="Tìm kiếm theo mã pallet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          {(filterStatus || filterFrom || filterTo || filterSupplier) && (
            <button
              onClick={() => {
                setFilterStatus("");
                setFilterFrom("");
                setFilterTo("");
                setFilterSupplier("");
              }}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              Xóa bộ lọc
            </button>
          )}
        </div>

        {/* Phase 3.5 — TC_HISTORY_PAL_002/_003: filter ngày + NCC */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-3 flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">Từ ngày</label>
            <input
              type="date"
              value={filterFrom}
              max={filterTo || undefined}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">Đến ngày</label>
            <input
              type="date"
              value={filterTo}
              min={filterFrom || undefined}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">Nhà cung cấp</label>
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">— Tất cả NCC —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead>
                <tr className="bg-surface-low border-b border-outline-variant">
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Mã Pallet</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Phiếu nhập</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Trạng thái</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">NCC</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Ngày nhập</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden lg:table-cell">Ghi chú</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden lg:table-cell">Ngày tạo</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-on-surface-variant">
                    <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
                    <p className="mt-2 text-sm">Đang tải...</p>
                  </td></tr>
                ) : pallets.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[40px] opacity-30">pallet</span>
                    <p className="mt-2 text-sm">Chưa có pallet nào.</p>
                  </td></tr>
                ) : (
                  pagedPallets.map((p) => {
                    const st = STATUS_MAP[p.status] || { label: p.status, color: "bg-surface-low text-on-surface-variant", icon: "help" };
                    return (
                      <tr key={p.id} className="border-b border-outline-variant/50 hover:bg-surface-low/50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-base"><Link href={`/pallets/${p.id}`} className="text-primary hover:underline">{p.code}</Link></td>
                        <td className="px-4 py-3">
                          {p.inbound_request ? (
                            <Link
                              href={`/inbound/${p.inbound_request.id}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                              title="Mở phiếu nhập"
                            >
                              <span className="material-symbols-outlined text-[12px]">link</span>
                              {p.inbound_request.code}
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200" title="Pallet chưa liên kết phiếu nhập">
                              <span className="material-symbols-outlined text-[12px]">warning</span>
                              Chưa liên kết
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                            <span className="material-symbols-outlined text-[14px]">{st.icon}</span>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-on-surface-variant">
                          {p.supplier ? (
                            <span className="text-sm">{p.supplier.name}</span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-on-surface-variant">{formatDate(p.inbound_date)}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-on-surface-variant text-xs max-w-[200px] truncate">{p.note || "—"}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-on-surface-variant text-xs">{formatDate(p.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/pallets/${p.id}`}
                              className="p-1.5 rounded-lg hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors"
                              title="Mở pallet">
                              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                            </Link>
                            {(p.status === "EMPTY" || p.status === "COUNTING") && (
                              <button
                                onClick={() => handleCancel(p.id, p.code)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-on-surface-variant hover:text-rose-600 transition-colors"
                                title="Hủy pallet">
                                <span className="material-symbols-outlined text-[18px]">cancel</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && pallets.length > 0 && <ListPageFooter {...pg} unit="pallet" />}
        </div>
      </div>

      {/* Modal Tạo Pallet */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-surface-low flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <span className="text-xs font-semibold text-on-surface-variant/70 uppercase tracking-wider">Tạo pallet mới</span>
                <h3 className="text-lg font-bold text-primary mt-0.5">Mã sẽ tự sinh</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-surface-low rounded-lg">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="bg-surface-low rounded-xl p-4 border border-dashed border-outline-variant text-center">
                <span className="material-symbols-outlined text-[32px] text-primary">qr_code_2</span>
                <p className="text-sm text-on-surface-variant mt-1">Mã pallet được hệ thống tự sinh</p>
                <p className="text-xs text-on-surface-variant/70 mt-0.5">Định dạng: PLYYMMDD.STT</p>
              </div>

              {/* UC-PAL-01: Liên kết phiếu nhập (KHUYẾN NGHỊ — auto-fill NCC + ngày nhập) */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Phiếu yêu cầu nhập (PHN) <span className="text-rose-600">*</span>
                </label>
                <select
                  value={form.inbound_request_id}
                  onChange={(e) => {
                    const phnId = e.target.value;
                    const phn = openInbounds.find((i) => i.id === phnId);
                    setForm({
                      ...form,
                      inbound_request_id: phnId,
                      // Auto-fill NCC từ PHN
                      supplier_id: phn?.supplier_id || form.supplier_id,
                    });
                  }}
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">— Chưa liên kết phiếu nhập (không khuyến nghị) —</option>
                  {openInbounds.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.code} · {i.invoice_no?.trim() ? `HĐ ${i.invoice_no.trim()}` : "(chưa có HĐ)"}{i.supplier?.name ? ` · ${i.supplier.name}` : ""} · [{i.status}]
                    </option>
                  ))}
                </select>
                {form.inbound_request_id ? (
                  <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">link</span>
                    Pallet sẽ link với phiếu này. Khi thêm hàng chỉ chọn được mã thuộc PHN.
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">warning</span>
                    Pallet không link PHN sẽ &quot;trôi nổi&quot; — khó truy vết khi đối chiếu.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Nguồn hàng (NCC)
                  {form.inbound_request_id && (
                    <span className="ml-2 text-[10px] font-normal text-emerald-600 normal-case">
                      (tự điền từ PHN)
                    </span>
                  )}
                </label>
                <select
                  value={form.supplier_id}
                  onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                  disabled={!!form.inbound_request_id}
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-surface-low disabled:text-on-surface-variant disabled:cursor-not-allowed"
                >
                  <option value="">— Không chọn —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Ngày nhập hàng
                </label>
                <input
                  type="date"
                  value={form.inbound_date}
                  min="2020-01-01"
                  max={maxAllowedDateStr}
                  onChange={(e) => onInboundDateChange(e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                    dateError
                      ? "border-rose-400 focus:ring-rose-200 bg-rose-50"
                      : "border-outline-variant focus:ring-primary/20 focus:border-primary"
                  }`}
                />
                {dateError ? (
                  <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {dateError}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-on-surface-variant/70">
                    Cho phép tối đa {MAX_FUTURE_DAYS} ngày tương lai (đến {new Date(maxAllowedDateStr).toLocaleDateString("vi-VN")}).
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Ghi chú
                </label>
                <textarea
                  rows={2}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Ghi chú cho pallet..."
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-low">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-low">
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving || !!dateError}
                  className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-container flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "add"}</span>
                  Tạo pallet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
