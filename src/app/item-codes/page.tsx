"use client";
import { useToast, TableSkeleton } from "@/components/ui";
import dynamic from "next/dynamic";

const BarcodeScannerModal = dynamic(
  () => import("@/components/shared/BarcodeScannerModal").then((m) => m.BarcodeScannerModal),
  { ssr: false }
);

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface ProductGroup { id: string; name: string; }
interface UnitOfMeasure { id: string; name: string; symbol?: string; }
interface ProductRef { id: string; sku: string; name: string; short_name?: string; }

interface ItemCode {
  id: string;
  code: string;
  barcode?: string;
  short_name: string;
  full_name?: string;
  unit_id?: string;
  specification?: string;
  weight_per_box?: number;
  group_id?: string;
  product_id?: string;
  photo_url?: string;
  note?: string;
  status: string;
  created_by?: string;
  standardized_by?: string;
  standardized_at?: string;
  created_at: string;
  unit?: { id: string; name: string; symbol?: string };
  group?: { id: string; name: string };
  product?: { id: string; sku: string; name: string };
  creator?: { id: string; full_name: string };
  standardizer?: { id: string; full_name: string };
}

interface Pagination { total: number; page: number; limit: number; totalPages: number; }
interface Stats { pending: number; standardized: number; total: number; }

const EMPTY_FORM = {
  code: "", barcode: "", short_name: "", full_name: "", unit_id: "", specification: "",
  weight_per_box: "", group_id: "", product_id: "", note: "",
};

export default function ItemCodesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<ItemCode[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [stats, setStats] = useState<Stats>({ pending: 0, standardized: 0, total: 0 });

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterGroup, setFilterGroup] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  // TC_PENDING_004: cho phép đổi số dòng/trang (mặc định 10) để phân trang
  // hoạt động & kiểm thử được kể cả khi danh sách ít mã.
  const [limit, setLimit] = useState(10);

  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStdModal, setShowStdModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemCode | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ItemCode | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);

  // Suggest merge
  const [suggestQuery, setSuggestQuery] = useState("");
  const [suggestions, setSuggestions] = useState<{ similarCodes: ItemCode[]; matchingProducts: ProductRef[] }>({ similarCodes: [], matchingProducts: [] });

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const suggestTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch meta (once)
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [gRes, uRes] = await Promise.all([
          fetch("/wms/api/product-groups"),
          fetch("/wms/api/units"),
        ]);
        const gData = await gRes.json();
        const uData = await uRes.json();
        if (gData.success) setGroups(gData.data);
        if (uData.success) setUnits(uData.data);
      } catch { /* silent */ }
    };
    fetchMeta();
  }, []);

  // Fetch products for linking
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/wms/api/products?limit=100");
      const data = await res.json();
      if (data.success) setProducts(data.data.map((p: ProductRef & Record<string, unknown>) => ({ id: p.id, sku: p.sku, name: p.name, short_name: p.short_name })));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Fetch item codes
  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      if (filterGroup) params.set("groupId", filterGroup);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("page", page.toString());
      params.set("limit", limit.toString());

      const res = await fetch(`/wms/api/item-codes?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.data);
        setPagination(data.pagination);
        setStats(data.stats);
      }
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, [search, filterStatus, filterGroup, sortBy, sortOrder, page, limit]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => { setPage(1); }, 300);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) { setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }
    else { setSortBy(field); setSortOrder("asc"); }
    setPage(1);
  };

  // ===== TẠO MÃ HÀNG =====
  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setShowCreateModal(true);
  };

  const handleCreate = async (e: React.FormEvent, saveAndNew = false) => {
    e.preventDefault();
    if (formLoading) return;
    setFormError("");

    if (!form.code.trim()) { setFormError("Mã hàng theo chứng từ là bắt buộc."); return; }
    if (!form.short_name.trim()) { setFormError("Tên rút gọn là bắt buộc."); return; }
    if (!form.unit_id) { setFormError("Đơn vị tính là bắt buộc."); return; }
    if (!form.specification.trim()) { setFormError("Quy cách là bắt buộc."); return; }

    if (form.code.trim() && !/^[A-Za-z0-9\-_./]+$/.test(form.code.trim())) {
      setFormError("Mã hàng chỉ chứa chữ, số, dấu -, _, ., /"); return;
    }

    setFormLoading(true);
    try {
      const res = await apiFetch("/wms/api/item-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim(),
          barcode: form.barcode.trim() || null,
          short_name: form.short_name.trim(),
          unit_id: form.unit_id || null,
          specification: form.specification.trim() || null,
          weight_per_box: form.weight_per_box ? parseFloat(form.weight_per_box) : null,
          note: form.note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Thất bại."); setFormLoading(false); return; }

      if (saveAndNew) { setForm(EMPTY_FORM); setFormError(""); fetchItems(); }
      else { setShowCreateModal(false); fetchItems(); }
    } catch { setFormError("Lỗi kết nối mạng."); }
    finally { setFormLoading(false); }
  };

  // ===== CHUẨN HÓA =====
  const openStdModal = (item: ItemCode) => {
    setSelectedItem(item);
    setForm({
      code: item.code,
      barcode: item.barcode || "",
      short_name: item.short_name,
      full_name: item.full_name || "",
      unit_id: item.unit_id || "",
      specification: item.specification || "",
      weight_per_box: item.weight_per_box?.toString() || "",
      group_id: item.group_id || "",
      product_id: item.product_id || "",
      note: item.note || "",
    });
    setFormError("");
    setSuggestQuery("");
    setSuggestions({ similarCodes: [], matchingProducts: [] });
    setShowStdModal(true);
  };

  // Suggest merge (debounced)
  const handleSuggestSearch = (q: string) => {
    setSuggestQuery(q);
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    if (q.length < 2) { setSuggestions({ similarCodes: [], matchingProducts: [] }); return; }
    suggestTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/wms/api/item-codes/suggest-merge?q=${encodeURIComponent(q)}&excludeId=${selectedItem?.id || ""}`);
        const data = await res.json();
        if (data.success) setSuggestions(data.data);
      } catch { /* silent */ }
    }, 300);
  };

  const handleStandardize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formLoading || !selectedItem) return;
    setFormError("");

    // TC_STANDARD_006: chặn khi xóa trống field bắt buộc rồi lưu/chuẩn hóa
    if (!form.code.trim()) { setFormError("Mã hàng theo chứng từ là bắt buộc."); return; }
    if (!form.short_name.trim()) { setFormError("Tên rút gọn là bắt buộc."); return; }
    if (!form.full_name.trim()) { setFormError("Tên đầy đủ là bắt buộc khi chuẩn hóa."); return; }

    setFormLoading(true);
    try {
      const res = await fetch(`/wms/api/item-codes/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim(),
          barcode: form.barcode.trim() || null,
          short_name: form.short_name.trim(),
          full_name: form.full_name.trim(),
          unit_id: form.unit_id || null,
          specification: form.specification.trim() || null,
          weight_per_box: form.weight_per_box ? parseFloat(form.weight_per_box) : null,
          group_id: form.group_id || null,
          product_id: form.product_id || null,
          note: form.note.trim() || null,
          status: "standardized",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Thất bại."); setFormLoading(false); return; }

      setShowStdModal(false);
      fetchItems();
    } catch { setFormError("Lỗi kết nối mạng."); }
    finally { setFormLoading(false); }
  };

  // Update (save without changing status)
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formLoading || !selectedItem) return;
    setFormError("");

    // TC_STANDARD_006: chặn khi xóa trống field bắt buộc rồi lưu
    if (!form.code.trim()) { setFormError("Mã hàng theo chứng từ là bắt buộc."); return; }
    if (!form.short_name.trim()) { setFormError("Tên rút gọn là bắt buộc."); return; }

    setFormLoading(true);
    try {
      const res = await fetch(`/wms/api/item-codes/${selectedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim(),
          barcode: form.barcode.trim() || null,
          short_name: form.short_name.trim(),
          full_name: form.full_name.trim() || null,
          unit_id: form.unit_id || null,
          specification: form.specification.trim() || null,
          weight_per_box: form.weight_per_box ? parseFloat(form.weight_per_box) : null,
          group_id: form.group_id || null,
          product_id: form.product_id || null,
          note: form.note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Thất bại."); setFormLoading(false); return; }

      setShowStdModal(false);
      fetchItems();
    } catch { setFormError("Lỗi kết nối mạng."); }
    finally { setFormLoading(false); }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(`/wms/api/item-codes/${deleteConfirm.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Xóa thất bại."); setDeleteConfirm(null); return; }
      setDeleteConfirm(null);
      fetchItems();
    } catch { toast.error("Lỗi kết nối mạng."); }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <span className="material-symbols-outlined text-[14px] ml-1 opacity-50">
      {sortBy === field ? (sortOrder === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
    </span>
  );

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <AppLayout title="QUẢN LÝ MÃ HÀNG">
      <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="headline-md text-primary">Quản lý Mã hàng</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              UC-MD-02 · Tạo mã hàng tạm → Kế toán chuẩn hóa
            </p>
          </div>
          <button onClick={openCreateModal} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-container flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Tạo mã hàng
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface rounded-lg border border-surface-variant p-4 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all" onClick={() => { setFilterStatus(""); setPage(1); }}>
            <p className="label-caps text-on-surface-variant mb-1">TỔNG MÃ HÀNG</p>
            <p className="text-2xl font-bold text-primary" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{stats.total}</p>
          </div>
          <div className={`bg-surface rounded-lg border border-surface-variant p-4 cursor-pointer hover:ring-2 hover:ring-warning/20 transition-all ${filterStatus === "pending" ? "ring-2 ring-warning" : ""}`} onClick={() => { setFilterStatus("pending"); setPage(1); }}>
            <p className="label-caps text-on-surface-variant mb-1">CHỜ XỬ LÝ</p>
            <p className="text-2xl font-bold text-warning" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{stats.pending}</p>
          </div>
          <div className={`bg-surface rounded-lg border border-surface-variant p-4 cursor-pointer hover:ring-2 hover:ring-success/20 transition-all ${filterStatus === "standardized" ? "ring-2 ring-success" : ""}`} onClick={() => { setFilterStatus("standardized"); setPage(1); }}>
            <p className="label-caps text-on-surface-variant mb-1">ĐÃ CHUẨN HÓA</p>
            <p className="text-2xl font-bold text-success" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{stats.standardized}</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5">
              <label className="label-caps text-on-surface-variant block mb-1">Tìm kiếm mã / tên</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
                <input type="text" placeholder="Nhập mã hàng hoặc tên..." value={search} onChange={(e) => handleSearch(e.target.value)} className="w-full pl-10 pr-3 py-2 bg-surface-low rounded-lg border-0 text-sm focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="label-caps text-on-surface-variant block mb-1">Trạng thái</label>
              <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="w-full px-3 py-2 bg-surface-low rounded-lg border-0 text-sm focus:ring-2 focus:ring-primary/20">
                <option value="">Tất cả</option>
                <option value="pending">⏳ Chờ xử lý</option>
                <option value="standardized">✅ Đã chuẩn hóa</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="label-caps text-on-surface-variant block mb-1">Nhóm hàng</label>
              <select value={filterGroup} onChange={(e) => { setFilterGroup(e.target.value); setPage(1); }} className="w-full px-3 py-2 bg-surface-low rounded-lg border-0 text-sm focus:ring-2 focus:ring-primary/20">
                <option value="">Tất cả nhóm</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-1 flex items-end">
              <button onClick={() => { setSearch(""); setFilterStatus("pending"); setFilterGroup(""); setPage(1); }} className="w-full p-2 bg-surface-low rounded-lg hover:bg-surface-mid transition-colors flex items-center justify-center" title="Xóa bộ lọc">
                <span className="material-symbols-outlined text-on-surface-variant">filter_alt_off</span>
              </button>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 800 }}>
              <thead className="bg-surface-low">
                <tr className="text-left label-caps text-on-surface-variant">
                  <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort("code")}>MÃ HÀNG<SortIcon field="code" /></th>
                  <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort("short_name")}>TÊN RÚT GỌN<SortIcon field="short_name" /></th>
                  <th className="px-4 py-3">ĐVT</th>
                  <th className="px-4 py-3">QUY CÁCH</th>
                  <th className="px-4 py-3">LIÊN KẾT SKU</th>
                  <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort("status")}>TRẠNG THÁI<SortIcon field="status" /></th>
                  <th className="px-4 py-3">NGÀY TẠO</th>
                  <th className="px-4 py-3 text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableSkeleton rows={10} cols={8} />
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-[32px] mb-2 block opacity-40">qr_code_2</span>
                    {filterStatus === "pending" ? "Không có mã hàng chờ xử lý" : "Không có dữ liệu"}
                  </td></tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-t border-surface-low hover:bg-surface-low/50">
                      <td className="px-4 py-3 data-mono font-medium">
                        <div>{item.code}</div>
                        {item.barcode && <div className="text-[10px] text-primary/80 font-mono font-semibold">Barcode: {item.barcode}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div>{item.short_name}</div>
                        {item.full_name && <div className="text-xs text-on-surface-variant">{item.full_name}</div>}
                      </td>
                      <td className="px-4 py-3">{item.unit?.name || "—"}</td>
                      <td className="px-4 py-3 text-on-surface-variant text-xs">{item.specification || "—"}</td>
                      <td className="px-4 py-3">
                        {item.product ? (
                          <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded font-medium">{item.product.sku}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {item.status === "pending" ? (
                          <Badge variant="warning">CHỜ XỬ LÝ</Badge>
                        ) : (
                          <Badge variant="success">ĐÃ CHUẨN HÓA</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">{formatDate(item.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {item.status === "pending" ? (
                          <>
                            <button onClick={() => openStdModal(item)} className="p-1 hover:bg-primary/10 rounded transition-colors mr-1" title="Chuẩn hóa">
                              <span className="material-symbols-outlined text-[18px] text-primary">verified</span>
                            </button>
                            <button onClick={() => setDeleteConfirm(item)} className="p-1 hover:bg-error/10 rounded transition-colors" title="Xóa">
                              <span className="material-symbols-outlined text-[18px] text-error">delete</span>
                            </button>
                          </>
                        ) : (
                          <button onClick={() => openStdModal(item)} className="p-1 hover:bg-surface-mid rounded transition-colors" title="Xem / Sửa">
                            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination — TC_PENDING_004: luôn hiện thông tin + cho chọn số dòng/trang
              (kể cả khi chỉ 1 trang) để phân trang hoạt động & kiểm thử được với limit nhỏ. */}
          {pagination.total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-low gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-xs text-on-surface-variant">
                  {(page - 1) * limit + 1} - {Math.min(page * limit, pagination.total)} / {pagination.total}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-on-surface-variant">Số dòng/trang:</span>
                  <select
                    value={limit}
                    onChange={(e) => { setLimit(parseInt(e.target.value, 10)); setPage(1); }}
                    className="px-2 py-1 bg-surface-low rounded-lg border-0 text-xs focus:ring-2 focus:ring-primary/20"
                  >
                    {[3, 5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              {pagination.totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(1)} disabled={page === 1} className="p-1 rounded hover:bg-surface-low disabled:opacity-30"><span className="material-symbols-outlined text-[18px]">first_page</span></button>
                  <button onClick={() => setPage(page - 1)} disabled={page === 1} className="p-1 rounded hover:bg-surface-low disabled:opacity-30"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-on-surface-variant">...</span>}
                        <button onClick={() => setPage(p)} className={`w-8 h-8 rounded text-sm font-medium ${p === page ? "bg-primary text-white" : "hover:bg-surface-low"}`}>{p}</button>
                      </React.Fragment>
                    ))}
                  <button onClick={() => setPage(page + 1)} disabled={page === pagination.totalPages} className="p-1 rounded hover:bg-surface-low disabled:opacity-30"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
                  <button onClick={() => setPage(pagination.totalPages)} disabled={page === pagination.totalPages} className="p-1 rounded hover:bg-surface-low disabled:opacity-30"><span className="material-symbols-outlined text-[18px]">last_page</span></button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ====== MODAL TẠO MÃ HÀNG (Thủ kho) ====== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ animation: "fadeIn 0.2s ease-out" }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-[560px] max-w-[95vw] max-h-[90vh] overflow-y-auto" style={{ animation: "scaleIn 0.2s ease-out" }}>
            <div className="sticky top-0 bg-white border-b border-surface-low px-6 py-4 flex items-center justify-between z-10">
              <h2 className="headline-sm text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">qr_code_2</span>
                Tạo mã hàng mới
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-surface-low rounded-lg">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={(e) => handleCreate(e)} className="p-6 space-y-4">
              {formError && (
                <div className="text-error text-sm font-medium bg-error/5 p-3 rounded-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>{formError}
                </div>
              )}

              <div className="bg-primary/5 p-3 rounded-lg text-xs text-on-surface-variant flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary mt-0.5">info</span>
                <span>Nhập thông tin từ chứng từ NCC. Mã hàng sẽ ở trạng thái <strong>&quot;Chờ xử lý&quot;</strong> cho đến khi Kế toán chuẩn hóa.</span>
              </div>

              <div>
                <label className="label-caps text-on-surface-variant block mb-1">Mã hàng theo chứng từ <span className="text-error">*</span></label>
                <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono" placeholder="VD: UNI-2024-A001" />
              </div>

              <div>
                <label className="label-caps text-on-surface-variant block mb-1">Mã vạch (Barcode)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="flex-1 px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                    placeholder="VD: 8934673000123"
                  />
                  <button
                    type="button"
                    onClick={() => setScanModalOpen(true)}
                    className="px-3 bg-surface-low border border-outline-variant rounded-lg flex items-center justify-center hover:bg-surface-mid transition-colors"
                    title="Quét mã vạch"
                  >
                    <span className="material-symbols-outlined text-[20px] text-primary">qr_code_scanner</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="label-caps text-on-surface-variant block mb-1">Tên rút gọn <span className="text-error">*</span></label>
                <input type="text" value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="VD: Omo Matic 4.2kg" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-caps text-on-surface-variant block mb-1">Đơn vị tính <span className="text-error">*</span></label>
                  <select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary">
                    <option value="">— Chọn ĐVT —</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-caps text-on-surface-variant block mb-1">Quy cách <span className="text-error">*</span></label>
                  <input type="text" value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="VD: Thùng 6 chai" />
                </div>
              </div>

              <div>
                <label className="label-caps text-on-surface-variant block mb-1">Trọng lượng / thùng (kg)</label>
                <input type="number" step="0.001" min="0" value={form.weight_per_box} onChange={(e) => setForm({ ...form, weight_per_box: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="0.000" />
              </div>

              <div>
                <label className="label-caps text-on-surface-variant block mb-1">Ghi chú</label>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" placeholder="Ghi chú thêm..." />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-low">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-low">Hủy</button>
                <button type="button" disabled={formLoading} onClick={(e) => handleCreate(e as unknown as React.FormEvent, true)} className="px-5 py-2.5 border border-primary text-primary rounded-lg text-sm hover:bg-primary/5 flex items-center gap-2 disabled:opacity-60">
                  {formLoading ? <><div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> Đang lưu...</> : <><span className="material-symbols-outlined text-[18px]">add_circle</span>Lưu &amp; Tạo tiếp</>}
                </button>
                <button type="submit" disabled={formLoading} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-container flex items-center gap-2 disabled:opacity-60">
                  {formLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang lưu...</> : <><span className="material-symbols-outlined text-[18px]">save</span>Tạo mã hàng</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== MODAL CHUẨN HÓA (Kế toán) ====== */}
      {showStdModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ animation: "fadeIn 0.2s ease-out" }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowStdModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-[720px] max-w-[95vw] max-h-[90vh] overflow-y-auto" style={{ animation: "scaleIn 0.2s ease-out" }}>
            <div className="sticky top-0 bg-white border-b border-surface-low px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="headline-sm text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined">verified</span>
                  {selectedItem.status === "pending" ? "Chuẩn hóa mã hàng" : "Chi tiết mã hàng"}
                </h2>
                <p className="text-xs text-on-surface-variant mt-1">Mã: <span className="font-mono font-bold">{selectedItem.code}</span> · Tạo: {formatDate(selectedItem.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                {selectedItem.status === "pending" ? <Badge variant="warning">CHỜ XỬ LÝ</Badge> : <Badge variant="success">ĐÃ CHUẨN HÓA</Badge>}
                <button onClick={() => setShowStdModal(false)} className="p-1 hover:bg-surface-low rounded-lg"><span className="material-symbols-outlined">close</span></button>
              </div>
            </div>
            <form onSubmit={selectedItem.status === "pending" ? handleStandardize : handleUpdate} className="p-6 space-y-5">
              {formError && (
                <div className="text-error text-sm font-medium bg-error/5 p-3 rounded-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>{formError}
                </div>
              )}

              {/* Section 1: Thông tin Thủ kho nhập */}
              <div className="bg-surface-low/50 p-4 rounded-lg">
                <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">smartphone</span> Thông tin từ Thủ kho
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-caps text-on-surface-variant block mb-1">Mã hàng NCC <span className="text-error">*</span></label>
                    <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono" />
                  </div>
                  <div>
                    <label className="label-caps text-on-surface-variant block mb-1">Mã vạch (Barcode)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.barcode}
                        onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                        className="flex-1 px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono font-semibold"
                        placeholder="Quét hoặc nhập mã vạch..."
                      />
                      <button
                        type="button"
                        onClick={() => setScanModalOpen(true)}
                        className="px-3 bg-surface-low border border-outline-variant rounded-lg flex items-center justify-center hover:bg-surface-mid transition-colors"
                        title="Quét mã vạch"
                      >
                        <span className="material-symbols-outlined text-[20px] text-primary">qr_code_scanner</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label-caps text-on-surface-variant block mb-1">Tên rút gọn <span className="text-error">*</span></label>
                    <input type="text" value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                  <div>
                    <label className="label-caps text-on-surface-variant block mb-1">ĐVT</label>
                    <select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary">
                      <option value="">— Chọn —</option>
                      {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-caps text-on-surface-variant block mb-1">Quy cách</label>
                    <input type="text" value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                </div>
              </div>

              {/* Section 2: Kế toán chuẩn hóa */}
              <div className="border-2 border-dashed border-primary/30 p-4 rounded-lg">
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">desktop_windows</span> Kế toán chuẩn hóa
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="label-caps text-on-surface-variant block mb-1">Tên đầy đủ {selectedItem.status === "pending" && <span className="text-error">*</span>}</label>
                    <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Nhập tên đầy đủ sản phẩm..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-caps text-on-surface-variant block mb-1">Nhóm hàng</label>
                      <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        <option value="">— Chọn nhóm —</option>
                        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label-caps text-on-surface-variant block mb-1">Liên kết SKU chuẩn</label>
                      <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        <option value="">— Để trống: tự tạo SKU mới —</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                      </select>
                      {selectedItem.status === "pending" && !form.product_id && (
                        <p className="text-[11px] text-on-surface-variant mt-1 flex items-start gap-1">
                          <span className="material-symbols-outlined text-[14px] text-primary mt-px">auto_awesome</span>
                          <span>Khi <strong>Chuẩn hóa</strong>, hệ thống sẽ tự tạo SKU mới ở <strong>Danh mục Sản phẩm</strong> với mã <span className="font-mono">{form.code || "(mã hàng)"}</span>.</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Gợi ý gộp trùng */}
                  <div>
                    <label className="label-caps text-on-surface-variant block mb-1">🔍 Tìm mã tương tự (gộp trùng)</label>
                    <input type="text" value={suggestQuery} onChange={(e) => handleSuggestSearch(e.target.value)} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Nhập mã hoặc tên để tìm..." />
                    {(suggestions.similarCodes.length > 0 || suggestions.matchingProducts.length > 0) && (
                      <div className="mt-2 border border-outline-variant rounded-lg max-h-40 overflow-y-auto">
                        {suggestions.similarCodes.length > 0 && (
                          <div className="p-2">
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Mã hàng tương tự</p>
                            {suggestions.similarCodes.map((s) => (
                              <div key={s.id} className="flex items-center justify-between py-1 px-2 hover:bg-surface-low rounded text-xs">
                                <span className="font-mono">{s.code}</span>
                                <span className="text-on-surface-variant">{s.short_name}</span>
                                {s.product && <span className="text-primary font-medium">→ {s.product.sku}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        {suggestions.matchingProducts.length > 0 && (
                          <div className="p-2 border-t border-surface-low">
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Sản phẩm phù hợp (click để liên kết)</p>
                            {suggestions.matchingProducts.map((p) => (
                              <button key={p.id} type="button" onClick={() => setForm({ ...form, product_id: p.id })} className="w-full flex items-center justify-between py-1 px-2 hover:bg-primary/5 rounded text-xs text-left">
                                <span className="font-mono text-primary">{p.sku}</span>
                                <span>{p.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="label-caps text-on-surface-variant block mb-1">Ghi chú</label>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-low">
                <button type="button" onClick={() => setShowStdModal(false)} className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-low">Hủy</button>
                {selectedItem.status === "standardized" && (
                  <button type="submit" disabled={formLoading} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-container flex items-center gap-2 disabled:opacity-60">
                    {formLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang lưu...</> : <><span className="material-symbols-outlined text-[18px]">save</span>Cập nhật</>}
                  </button>
                )}
                {selectedItem.status === "pending" && (
                  <>
                    <button type="button" disabled={formLoading} onClick={handleUpdate} className="px-5 py-2.5 border border-primary text-primary rounded-lg text-sm hover:bg-primary/5 flex items-center gap-2 disabled:opacity-60">
                      <span className="material-symbols-outlined text-[18px]">save</span>Lưu nháp
                    </button>
                    <button type="submit" disabled={formLoading} className="px-5 py-2.5 bg-success text-white rounded-lg text-sm hover:bg-success/90 flex items-center gap-2 disabled:opacity-60">
                      {formLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang lưu...</> : <><span className="material-symbols-outlined text-[18px]">verified</span>Chuẩn hóa</>}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== CONFIRM DELETE ====== */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 w-[420px] max-w-[90vw]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-error/10 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-error">delete_forever</span>
              </div>
              <div>
                <h3 className="font-semibold text-primary">Xác nhận xóa</h3>
                <p className="text-sm text-on-surface-variant">Hành động này không thể hoàn tác.</p>
              </div>
            </div>
            <p className="text-sm mb-5">Bạn có chắc chắn muốn xóa mã hàng <strong>{deleteConfirm.code}</strong> — <em>{deleteConfirm.short_name}</em>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-outline-variant rounded-lg text-sm hover:bg-surface-low">Hủy</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-error text-white rounded-lg text-sm hover:bg-error/90 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">delete</span> Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        onScan={(code) => {
          setForm((prev) => ({ ...prev, barcode: code }));
          setScanModalOpen(false);
          toast.success(`Đã quét được mã vạch: ${code}`);
        }}
        title="Quét mã vạch sản phẩm"
      />

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </AppLayout>
  );
}
