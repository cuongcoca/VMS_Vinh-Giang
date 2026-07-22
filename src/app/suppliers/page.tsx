"use client";
import { useToast, useClientPagination, ListPageFooter } from "@/components/ui";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";

type Supplier = {
  id: string;
  code: string;
  name: string;
  tax_code: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
  _count?: { inboundRequests: number };
};

const EMPTY_FORM = {
  code: "",
  name: "",
  tax_code: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  note: "",
};

export default function SuppliersPage() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Fetch danh sách
  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      const res = await fetch(`/wms/api/suppliers?${params.toString()}`);
      const result = await res.json();
      if (result.success) setSuppliers(result.data);
    } catch (err) {
      console.error("Fetch suppliers error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [searchQuery]);

  // KPIs
  const totalActive = suppliers.filter((s) => s.is_active).length;

  // Mở modal thêm mới
  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  // Mở modal sửa
  const handleOpenEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setForm({
      code: supplier.code,
      name: supplier.name,
      tax_code: supplier.tax_code || "",
      contact_person: supplier.contact_person || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      note: supplier.note || "",
    });
    setShowModal(true);
  };

  // Lưu (thêm/sửa)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingSupplier
        ? `/wms/api/suppliers/${editingSupplier.id}`
        : "/wms/api/suppliers";
      const method = editingSupplier ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (result.success) {
        setShowModal(false);
        fetchSuppliers();
      } else {
        toast.error(result.error || "Lỗi khi lưu.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối.");
    } finally {
      setSaving(false);
    }
  };

  // Xóa
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa nhà cung cấp "${name}"?`)) return;
    try {
      const res = await fetch(`/wms/api/suppliers/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        fetchSuppliers();
      } else {
        toast.error(result.error || "Lỗi khi xóa.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối.");
    }
  };

  // ── Phân trang client-side (TC_PENDING_004) ──
  const pg = useClientPagination(suppliers, { resetKey: searchQuery });
  const { paged: pagedSuppliers } = pg;

  return (
    <AppLayout title="NHÀ CUNG CẤP">
      <div className="p-6 space-y-5 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              Quản lý Nhà cung cấp
            </h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Danh sách đối tác cung ứng hàng hóa cho kho Vĩnh Giang.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Thêm NCC
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Tổng NCC
            </span>
            <span className="text-2xl font-bold text-on-surface mt-2 block">
              {totalActive}
            </span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Đang hoạt động
            </span>
            <span className="text-2xl font-bold text-emerald-600 mt-2 block">
              {totalActive}
            </span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Có liên hệ
            </span>
            <span className="text-2xl font-bold text-blue-600 mt-2 block">
              {suppliers.filter((s) => s.phone || s.email).length}
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Tìm kiếm theo mã, tên, MST..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead>
                <tr className="bg-surface-low border-b border-outline-variant">
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">
                    Mã NCC
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">
                    Tên NCC
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">
                    Người liên hệ
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">
                    SĐT
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden lg:table-cell">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden lg:table-cell">
                    Số phiếu nhập
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">
                    Trạng thái
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-on-surface-variant">
                      <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
                      <p className="mt-2 text-sm">Đang tải...</p>
                    </td>
                  </tr>
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[40px] opacity-30">local_shipping</span>
                      <p className="mt-2 text-sm">Chưa có nhà cung cấp nào.</p>
                    </td>
                  </tr>
                ) : (
                  pagedSuppliers.map((sup) => (
                    <tr
                      key={sup.id}
                      className="border-b border-outline-variant/50 hover:bg-surface-low/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-primary">
                        {sup.code}
                      </td>
                      <td className="px-4 py-3 font-medium">{sup.name}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-on-surface-variant">
                        {sup.contact_person || "—"}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {sup.phone ? (
                          <span className="text-blue-600">{sup.phone}</span>
                        ) : (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-on-surface-variant text-xs">
                        {sup.email || "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs text-on-surface-variant">
                        {sup._count?.inboundRequests ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            sup.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-600"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              sup.is_active ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          {sup.is_active ? "Hoạt động" : "Ngừng"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(sup)}
                            className="p-1.5 rounded-lg hover:bg-surface-low text-on-surface-variant hover:text-primary transition-colors"
                            title="Sửa"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(sup.id, sup.name)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-on-surface-variant hover:text-rose-600 transition-colors"
                            title="Xóa"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Phân trang — TC_PENDING_004: mọi trang danh sách phải có phân trang */}
          <ListPageFooter {...pg} unit="nhà cung cấp" />
        </div>
      </div>

      {/* Modal Thêm/Sửa NCC */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-[580px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-surface-low flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <span className="text-xs font-semibold text-on-surface-variant/70 uppercase tracking-wider">
                  {editingSupplier ? "Cập nhật NCC" : "Thêm mới NCC"}
                </span>
                <h3 className="text-lg font-bold text-primary mt-0.5">
                  {editingSupplier ? editingSupplier.code : "Nhà cung cấp mới"}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-surface-low rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                    Mã NCC <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="VD: NCC001"
                    required
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                    Mã số thuế
                  </label>
                  <input
                    type="text"
                    value={form.tax_code}
                    onChange={(e) => setForm({ ...form, tax_code: e.target.value })}
                    placeholder="VD: 0312345678"
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Tên NCC <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Tên nhà cung cấp"
                  required
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                    Người liên hệ
                  </label>
                  <input
                    type="text"
                    value={form.contact_person}
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                    placeholder="Họ tên người liên hệ"
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="VD: 0912345678"
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@congty.vn"
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Địa chỉ nhà cung cấp"
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                  Ghi chú
                </label>
                <textarea
                  rows={2}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Ghi chú thêm..."
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-surface-low">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-low"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-container flex items-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {saving ? "progress_activity" : "save"}
                  </span>
                  {editingSupplier ? "Lưu thay đổi" : "Thêm NCC"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
