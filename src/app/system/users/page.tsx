"use client";
import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast, useClientPagination, ListPageFooter } from "@/components/ui";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type UserData = { id: string; full_name: string; email: string | null; phone: string | null; role: string; is_locked: boolean; last_login_at: string | null; created_at: string };
// UC-SYS-04: vai trò người dùng ĐƯỢC PHÉP chọn — chỉ 5 vai trò nghiệp vụ
// (bỏ ADMIN/MANAGER/STAFF dư thừa; QUAN_LY = "Quản lý"). ROLE_LABELS/ROLE_COLORS
// vẫn giữ đủ để hiển thị đúng người dùng cũ (admin…) trong bảng.
const FORM_ROLES = ["QUAN_LY", "KE_TOAN", "THU_KHO", "XE_NANG", "KIEM_KE"];
const ROLE_LABELS: Record<string, string> = { ADMIN: "Quản trị viên", MANAGER: "Quản lý", STAFF: "Nhân viên", QUAN_LY: "Quản lý", KE_TOAN: "Kế toán", THU_KHO: "Thủ kho", XE_NANG: "Xe nâng", KIEM_KE: "Kiểm kê" };
const ROLE_COLORS: Record<string, string> = { ADMIN: "bg-rose-50 text-rose-700", MANAGER: "bg-purple-50 text-purple-700", QUAN_LY: "bg-blue-50 text-blue-700", KE_TOAN: "bg-emerald-50 text-emerald-700", THU_KHO: "bg-amber-50 text-amber-700", XE_NANG: "bg-indigo-50 text-indigo-700", KIEM_KE: "bg-cyan-50 text-cyan-700", STAFF: "bg-surface-low text-on-surface-variant" };

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", role: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ user: UserData; confirmText: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "locked">("");
  const { toast: toastApi } = useToast();

  const fetchUsers = useCallback(() => { fetch("/wms/api/users").then(r => { if (r.status === 401) { window.location.href = "/wms/auth"; return null; } return r.json(); }).then(r => { if (r?.success) setUsers(r.data); }).catch(console.error).finally(() => setLoading(false)); }, []);
  useEffect(fetchUsers, [fetchUsers]);

  // UC_SYS_04_TC34: session hết hạn -> chuyển về đăng nhập
  const checkAuth = (res: Response) => { if (res.status === 401) { window.location.href = "/wms/auth"; return true; } return false; };

  const resetForm = () => setForm({ full_name: "", email: "", phone: "", password: "", role: "" });
  const openCreate = () => { resetForm(); setEditingId(null); setShowModal(true); };
  const openEdit = (u: UserData) => { setForm({ full_name: u.full_name, email: u.email || "", phone: u.phone || "", password: "", role: u.role }); setEditingId(u.id); setShowModal(true); };

  const handleSave = async () => {
    if (!form.full_name.trim()) { toastApi.warning("Nhập họ và tên."); return; }
    if (!form.role) { toastApi.warning("Vui lòng chọn vai trò."); return; }
    // Bắt buộc có ÍT NHẤT email hoặc số điện thoại (cả khi tạo lẫn khi sửa)
    if (!form.email.trim() && !form.phone.trim()) { toastApi.warning("Cần nhập email hoặc số điện thoại."); return; }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { toastApi.warning("Email không đúng định dạng."); return; } // UC_SYS_04_TC25
    if (form.phone.trim() && !/^[0-9+\-\s]{7,15}$/.test(form.phone.trim())) { toastApi.warning("Số điện thoại không hợp lệ."); return; } // UC_SYS_04_TC26
    // Mật khẩu: bắt buộc khi TẠO mới; khi SỬA để trống = giữ nguyên
    if (!editingId && !form.password.trim()) { toastApi.warning("Nhập mật khẩu."); return; }
    if (form.password.trim() && form.password.length < 6) { toastApi.warning("Mật khẩu phải có ít nhất 6 ký tự."); return; } // UC_SYS_04_TC29
    setSaving(true);
    try {
      const isEdit = !!editingId;
      const payload: Record<string, unknown> = { full_name: form.full_name, email: form.email, phone: form.phone, role: form.role };
      if (form.password.trim()) payload.password = form.password;
      const res = await fetch(isEdit ? `/wms/api/users/${editingId}` : "/wms/api/users", { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (checkAuth(res)) return;
      const result = await res.json();
      if (result.success) { toastApi.success(isEdit ? "Cập nhật thành công!" : "Tạo thành công!"); setShowModal(false); resetForm(); setEditingId(null); fetchUsers(); }
      else toastApi.error(result.error || "Có lỗi xảy ra.");
    } catch { toastApi.error("Có lỗi xảy ra."); } finally { setSaving(false); }
  };

  const toggleLock = async (id: string, locked: boolean) => {
    const ok = window.confirm(locked ? "Bạn có chắc chắn muốn mở khóa tài khoản này?" : "Bạn có chắc chắn muốn khóa tài khoản này?");
    if (!ok) return;
    await fetch(`/wms/api/users/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_locked: !locked }) });
    fetchUsers();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/wms/api/users/${deleteConfirm.user.id}`, { method: "DELETE" });
      if (checkAuth(res)) return;
      const result = await res.json();
      if (result.success) {
        toastApi.success(`Đã xóa người dùng "${deleteConfirm.user.full_name}".`);
        setDeleteConfirm(null);
        fetchUsers();
      } else {
        toastApi.error(result.error || "Lỗi khi xóa.");
      }
    } catch { toastApi.error("Lỗi kết nối."); } finally { setDeleting(false); }
  };

  // UC_SYS_04_TC03/04/06/07: tìm kiếm theo tên/email/SĐT + lọc vai trò + trạng thái
  const q = search.trim().toLowerCase();
  const filteredUsers = users.filter(u =>
    (q === "" || u.full_name.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q) || (u.phone || "").toLowerCase().includes(q)) &&
    (roleFilter === "" || u.role === roleFilter) &&
    (statusFilter === "" || (statusFilter === "locked" ? u.is_locked : !u.is_locked))
  );

  // Phân trang client-side cho danh sách người dùng đã lọc
  // Hoãn từ khoá tìm kiếm trước khi đưa vào resetKey: nếu dùng giá trị thô thì
  // mỗi ký tự gõ là một lần nhảy về trang 1.
  const debouncedSearch = useDebouncedValue(search);
  const pg = useClientPagination(filteredUsers, { resetKey: `${debouncedSearch}|${roleFilter}|${statusFilter}` });
  const { paged: pagedUsers } = pg;

  return (
    <AppLayout title="NGƯỜI DÙNG">
      <div className="p-6 space-y-5">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-primary flex items-center gap-2"><span className="material-symbols-outlined text-[28px]">group</span> Quản lý người dùng</h1><p className="text-sm text-on-surface-variant mt-0.5">{users.length} người dùng</p></div>
          <button onClick={openCreate} className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">person_add</span> Thêm</button>
        </div>
        {/* UC_SYS_04_TC03/04/06/07: thanh tìm kiếm + lọc */}
        <div className="flex flex-wrap items-center gap-2">
          <input type="text" placeholder="Tìm theo tên, email hoặc SĐT..." value={search} onChange={e => setSearch(e.target.value)} className="px-3 py-2 text-sm border border-outline-variant rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary/20" />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white">
            <option value="">Tất cả vai trò</option>
            {FORM_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as "" | "active" | "locked")} className="px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white">
            <option value="">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="locked">Khóa</option>
          </select>
        </div>
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto scroll-container">
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead>
                <tr className="bg-surface-low/50 border-b border-outline-variant">
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant whitespace-nowrap">Tên</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden md:table-cell whitespace-nowrap">Email</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden md:table-cell whitespace-nowrap">SĐT</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant whitespace-nowrap">Vai trò</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant whitespace-nowrap">Trạng thái</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden lg:table-cell whitespace-nowrap">Đăng nhập cuối</th>
                  <th className="text-right px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span>
                    </td>
                  </tr>
                ) : (
                  pagedUsers.map(u => (
                    <tr key={u.id} className="border-b border-outline-variant/40 hover:bg-surface-low/50">
                      <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{u.full_name}</td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-xs text-on-surface-variant whitespace-nowrap">{u.email || "—"}</td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-xs whitespace-nowrap">{u.phone || "—"}</td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ROLE_COLORS[u.role] || "bg-surface-low"}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.is_locked ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                          {u.is_locked ? "🔒 Khóa" : "✅ Hoạt động"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-on-surface-variant whitespace-nowrap">{u.last_login_at ? new Date(u.last_login_at).toLocaleString("vi-VN") : "—"}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-surface-low text-on-surface-variant/70 hover:text-primary transition-colors" title="Sửa người dùng">
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button onClick={() => toggleLock(u.id, u.is_locked)} className="p-1.5 rounded-lg hover:bg-surface-low transition-colors" title={u.is_locked ? "Mở khóa" : "Khóa"}>
                            <span className="material-symbols-outlined text-[16px]">{u.is_locked ? "lock_open" : "lock"}</span>
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ user: u, confirmText: "" })}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-on-surface-variant/70 hover:text-rose-600 transition-colors"
                            title="Xóa người dùng"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <ListPageFooter {...pg} unit="người dùng" />
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-up">
              <div className="flex justify-between items-center pb-3 border-b border-outline-variant/50">
                <h3 className="text-lg font-bold text-on-surface">{editingId ? "Sửa người dùng" : "Thêm người dùng mới"}</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full bg-surface-low hover:bg-surface-low flex items-center justify-center text-on-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập họ và tên"
                    value={form.full_name}
                    onChange={e => setForm({ ...form, full_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Email</label>
                  <input
                    type="email"
                    placeholder="example@domain.com"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Số điện thoại</label>
                  <input
                    type="text"
                    placeholder="Nhập số điện thoại"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <p className="text-[11px] text-on-surface-variant mt-1.5">Cần nhập <strong>ít nhất</strong> email hoặc số điện thoại.</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">{editingId ? "Mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu *"}</label>
                  <input
                    type="password"
                    required={!editingId}
                    placeholder={editingId ? "Để trống nếu giữ nguyên mật khẩu" : "Nhập mật khẩu tài khoản"}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value.replace(/\s/g, "") })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Vai trò *</label>
                  <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                  >
                    <option value="">-- Chọn vai trò --</option>
                    {/* Giữ vai trò cũ (admin/manager/staff) khi sửa user cũ để không vô tình đổi role */}
                    {form.role && !FORM_ROLES.includes(form.role) && (
                      <option value={form.role}>{ROLE_LABELS[form.role] || form.role}</option>
                    )}
                    {FORM_ROLES.map(r => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r] || r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-low transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  {saving ? (
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">{editingId ? "save" : "person_add"}</span>
                  )}
                  {editingId ? "Lưu thay đổi" : "Tạo người dùng"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-scale-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-rose-600 text-[20px]">warning</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">Xóa người dùng</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">Hành động này không thể hoàn tác</p>
                </div>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                <p className="text-sm text-rose-800">
                  Bạn sắp xóa <strong>{deleteConfirm.user.full_name}</strong>
                  <span className="text-rose-500"> ({deleteConfirm.user.phone || deleteConfirm.user.email || "—"})</span>
                </p>
                <p className="text-xs text-rose-600 mt-1">Vai trò: {ROLE_LABELS[deleteConfirm.user.role] || deleteConfirm.user.role}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Nhập <strong className="text-rose-600">{deleteConfirm.user.full_name}</strong> để xác nhận</label>
                <input
                  type="text"
                  placeholder={deleteConfirm.user.full_name}
                  value={deleteConfirm.confirmText}
                  onChange={e => setDeleteConfirm({ ...deleteConfirm, confirmText: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 border border-outline-variant rounded-lg text-sm hover:bg-surface-low transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirm.confirmText !== deleteConfirm.user.full_name}
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {deleting ? (
                    <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                  )}
                  Xóa vĩnh viễn
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
