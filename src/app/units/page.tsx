"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";

interface UnitOfMeasure {
  id: string;
  name: string;
  symbol?: string;
  is_active: boolean;
  created_at: string;
  _count?: { products: number; itemCodes: number };
}

const EMPTY_FORM = { name: "", symbol: "" };

export default function UnitsPage() {
  // Data
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Form state
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitOfMeasure | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<UnitOfMeasure | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warn" } | null>(null);

  // Refs
  const nameInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Toast helper ──
  const showToast = useCallback((message: string, type: "success" | "error" | "warn" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Fetch units ──
  const fetchUnits = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/wms/api/units${params}`);
      const data = await res.json();
      if (data.success) {
        setUnits(data.data);
      }
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, [search]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  // ── Debounced search ──
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      // triggers fetchUnits via useEffect
    }, 300);
  };

  // ── Auto-focus ──
  useEffect(() => {
    if (showModal) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [showModal]);

  // ── Open modals ──
  const openAddModal = () => {
    setEditingUnit(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (u: UnitOfMeasure) => {
    setEditingUnit(u);
    setForm({ name: u.name, symbol: u.symbol || "" });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUnit(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  // ── Submit (create/update) ──
  const handleSubmit = async (e?: React.FormEvent, saveAndNew = false) => {
    e?.preventDefault();
    if (formLoading) return;
    setFormError("");

    if (!form.name.trim()) {
      setFormError("Tên đơn vị tính là bắt buộc.");
      return;
    }

    setFormLoading(true);
    try {
      const url = editingUnit
        ? `/wms/api/units/${editingUnit.id}`
        : "/wms/api/units";
      const method = editingUnit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          symbol: form.symbol.trim() || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Thao tác thất bại.");
        setFormLoading(false);
        return;
      }

      showToast(
        editingUnit
          ? `Cập nhật đơn vị "${form.name}" thành công`
          : `Thêm đơn vị "${form.name}" thành công`
      );

      if (saveAndNew && !editingUnit) {
        setForm(EMPTY_FORM);
        setFormError("");
        fetchUnits();
        setTimeout(() => nameInputRef.current?.focus(), 50);
      } else {
        closeModal();
        fetchUnits();
      }
    } catch {
      setFormError("Lỗi kết nối mạng.");
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(`/wms/api/units/${deleteConfirm.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Xóa thất bại.", "error");
        setDeleteConfirm(null);
        return;
      }
      showToast(`Đã xóa đơn vị "${deleteConfirm.name}"`, "success");
      setDeleteConfirm(null);
      fetchUnits();
    } catch {
      showToast("Lỗi kết nối mạng.", "error");
    }
  };

  // ── Batch delete ──
  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const res = await fetch(`/wms/api/units/${id}`, { method: "DELETE" });
        if (res.ok) successCount++;
        else failCount++;
      } catch { failCount++; }
    }

    if (failCount > 0) {
      showToast(`${successCount} xóa thành công, ${failCount} bị lỗi (đang sử dụng)`, "warn");
    } else {
      showToast(`Đã xóa ${successCount} đơn vị tính`, "success");
    }

    setSelected(new Set());
    fetchUnits();
  };

  // ── Toggle select ──
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const allSelected = pagedUnits.length > 0 && pagedUnits.every((u) => prev.has(u.id));
      const next = new Set(prev);
      if (allSelected) pagedUnits.forEach((u) => next.delete(u.id));
      else pagedUnits.forEach((u) => next.add(u.id));
      return next;
    });
  };

  // ── Phân trang client-side (TC_PENDING_004) ──
  const pg = useClientPagination(units, { resetKey: search });
  const { paged: pagedUnits } = pg;

  return (
    <AppLayout title="ĐƠN VỊ TÍNH">
      <div className="p-6 space-y-5 max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="headline-md text-primary">Đơn vị tính</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              UC-MD-04 — Quản lý danh mục đơn vị đo lường sản phẩm
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                onClick={handleBatchDelete}
                className="px-4 py-2 bg-error text-white rounded-lg text-sm hover:bg-error/90 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                Xóa {selected.size} đơn vị
              </button>
            )}
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-container flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Thêm đơn vị
            </button>
          </div>
        </div>

        {/* Search */}
        <Card className="p-4 rounded-lg">
          <div className="relative max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
            <input
              type="text"
              placeholder="Tìm kiếm tên hoặc ký hiệu đơn vị..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-surface-low rounded-lg border-0 text-sm focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </Card>

        {/* Table */}
        <Card className="rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 500 }}>
              <thead className="bg-surface-low">
                <tr className="text-left label-caps text-on-surface-variant">
                  <th className="px-4 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={pagedUnits.length > 0 && pagedUnits.every((u) => selected.has(u.id))}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20"
                    />
                  </th>
                  <th className="px-4 py-3">TÊN ĐƠN VỊ TÍNH</th>
                  <th className="px-4 py-3">KÝ HIỆU (SYMBOL)</th>
                  <th className="px-4 py-3 text-center">SẢN PHẨM</th>
                  <th className="px-4 py-3 text-center">MÃ HÀNG</th>
                  <th className="px-4 py-3">TRẠNG THÁI</th>
                  <th className="px-4 py-3 text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-on-surface-variant">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        Đang tải dữ liệu...
                      </div>
                    </td>
                  </tr>
                ) : units.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-[32px] mb-2 block opacity-40">straighten</span>
                      {search ? "Không tìm thấy đơn vị tính nào" : "Chưa có đơn vị tính. Nhấn \"Thêm đơn vị\" để bắt đầu."}
                    </td>
                  </tr>
                ) : (
                  pagedUnits.map((u) => (
                    <tr
                      key={u.id}
                      className={`border-t border-surface-low hover:bg-surface-low/50 ${selected.has(u.id) ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(u.id)}
                          onChange={() => toggleSelect(u.id)}
                          className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3">
                        <span className="data-mono bg-surface-mid px-2 py-0.5 rounded text-xs border border-outline-variant text-primary font-semibold">
                          {u.symbol || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`data-mono font-medium ${(u._count?.products ?? 0) > 0 ? "text-primary" : "text-on-surface-variant"}`}
                        >
                          {u._count?.products ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`data-mono font-medium ${(u._count?.itemCodes ?? 0) > 0 ? "text-primary" : "text-on-surface-variant"}`}
                        >
                          {u._count?.itemCodes ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_active ? (
                          <Badge variant="success">HOẠT ĐỘNG</Badge>
                        ) : (
                          <Badge variant="error">ĐÃ XÓA</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1 hover:bg-surface-mid rounded transition-colors mr-1"
                          title="Sửa"
                        >
                          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(u)}
                          className="p-1 hover:bg-error/10 rounded transition-colors"
                          title="Xóa"
                        >
                          <span className="material-symbols-outlined text-[18px] text-error">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang — TC_PENDING_004: mọi trang danh sách phải có phân trang */}
          <ListPageFooter {...pg} unit="đơn vị tính" />
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 rounded-lg">
            <p className="label-caps text-on-surface-variant mb-1">TỔNG ĐƠN VỊ</p>
            <p className="text-2xl font-bold text-primary" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {units.length}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">Đơn vị đang hoạt động</p>
          </Card>
          <Card className="p-5 rounded-lg">
            <p className="label-caps text-on-surface-variant mb-1">CÓ SẢN PHẨM</p>
            <p className="text-2xl font-bold text-success" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {units.filter((u) => (u._count?.products ?? 0) > 0).length}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">Đơn vị đang sử dụng</p>
          </Card>
          <Card className="p-5 rounded-lg">
            <p className="label-caps text-on-surface-variant mb-1">CHƯA SỬ DỤNG</p>
            <p className="text-2xl font-bold text-warning" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {units.filter((u) => (u._count?.products ?? 0) === 0 && (u._count?.itemCodes ?? 0) === 0).length}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">Có thể xóa</p>
          </Card>
        </div>
      </div>

      {/* ====== MODAL THÊM/SỬA ====== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ animation: "fadeIn 0.2s ease-out" }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-2xl w-[520px] max-w-[95vw]" style={{ animation: "scaleIn 0.2s ease-out" }}>
            <div className="px-6 py-4 border-b border-surface-low flex items-center justify-between">
              <h2 className="headline-sm text-primary">
                {editingUnit ? "Sửa đơn vị tính" : "Thêm đơn vị tính mới"}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-surface-low rounded-lg">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="text-error text-sm font-medium bg-error/5 p-3 rounded-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {formError}
                </div>
              )}
              <div>
                <label className="label-caps text-on-surface-variant block mb-1">
                  Tên đơn vị tính <span className="text-error">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); setFormError(""); }}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="VD: Mét, Kilogam, Cái, Cuộn..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
              </div>
              <div>
                <label className="label-caps text-on-surface-variant block mb-1">Ký hiệu (Symbol)</label>
                <input
                  type="text"
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="VD: m, kg, cái, cuộn (tuỳ chọn)"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-surface-low">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-low"
                >
                  Hủy
                </button>
                {!editingUnit && (
                  <button
                    type="button"
                    disabled={formLoading}
                    onClick={(e) => handleSubmit(e as unknown as React.FormEvent, true)}
                    className="px-5 py-2.5 border border-primary text-primary rounded-lg text-sm hover:bg-primary/5 flex items-center gap-2 disabled:opacity-60"
                  >
                    {formLoading ? (
                      <><div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> Đang lưu...</>
                    ) : (
                      <><span className="material-symbols-outlined text-[18px]">add_circle</span>Lưu &amp; Thêm tiếp</>
                    )}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-container flex items-center gap-2 disabled:opacity-60"
                >
                  {formLoading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang lưu...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[18px]">save</span>{editingUnit ? "Cập nhật" : "Lưu"}</>
                  )}
                </button>
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
            <p className="text-sm mb-2">
              Bạn có chắc chắn muốn xóa đơn vị tính <strong>{deleteConfirm.name}</strong>?
            </p>
            {((deleteConfirm._count?.products ?? 0) > 0 || (deleteConfirm._count?.itemCodes ?? 0) > 0) && (
              <div className="text-xs text-warning bg-warning/5 p-2 rounded-lg mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                Đơn vị này đang có {deleteConfirm._count?.products ?? 0} sản phẩm và {deleteConfirm._count?.itemCodes ?? 0} mã hàng — có thể không xóa được.
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-outline-variant rounded-lg text-sm hover:bg-surface-low"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-error text-white rounded-lg text-sm hover:bg-error/90 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span> Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== TOAST ====== */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[999] animate-slide-up">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
              toast.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : toast.type === "error"
                ? "bg-red-50 text-red-800 border border-red-200"
                : "bg-yellow-50 text-yellow-800 border border-yellow-200"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {toast.type === "success" ? "check_circle" : toast.type === "error" ? "error" : "warning"}
            </span>
            {toast.message}
            <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </AppLayout>
  );
}
