"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { auth, AuthUser } from "@/lib/auth";
import Link from "next/link";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (auth.isAuthenticated()) {
      const u = auth.getUser();
      setUser(u);
      setFullName(u?.fullName || "");
      setPhone(u?.phone || "");
    }
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = ""; // Reset file input
    if (!file) return;

    // UC_SYS_05_TC13: Giới hạn dung lượng file ảnh (tối đa 2MB)
    const MAX_SIZE_MB = 2;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setToast({ message: `Dung lượng ảnh không được vượt quá ${MAX_SIZE_MB}MB.`, type: "error" });
      setTimeout(() => setToast(null), 4000);
      return;
    }

    // UC_SYS_05_TC12: Kiểm tra định dạng file (.png, .jpg, .jpeg, .webp)
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      setToast({ message: "Chỉ chấp nhận file ảnh định dạng PNG, JPG, JPEG, hoặc WebP.", type: "error" });
      setTimeout(() => setToast(null), 4000);
      return;
    }

    setAvatarUploading(true);
    try {
      // 1) Upload qua /api/attachments
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity_type", "USER_AVATAR");
      fd.append("entity_id", user?.id || "anonymous");
      
      const upRes = await fetch(`${basePath}/api/attachments`, {
        method: "POST",
        body: fd,
      });
      const upResult = await upRes.json();
      if (!upResult.success) {
        setToast({ message: upResult.error || "Upload ảnh thất bại.", type: "error" });
        return;
      }

      // 2) Lưu URL ảnh vào profile
      const fullUrl = `${basePath}${upResult.data.file_url}`;
      const token = auth.getToken();
      const saveRes = await fetch(`${basePath}/api/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar_url: fullUrl }),
      });
      const saveResult = await saveRes.json();
      if (saveResult.success) {
        const updated = { ...user!, avatarUrl: fullUrl, avatar_url: fullUrl };
        auth.saveUser(updated);
        setUser(updated);
        setToast({ message: "Cập nhật ảnh đại diện thành công!", type: "success" });
      } else {
        setToast({ message: saveResult.error || "Lưu ảnh đại diện thất bại.", type: "error" });
      }
    } catch {
      setToast({ message: "Lỗi kết nối khi upload ảnh.", type: "error" });
    } finally {
      setAvatarUploading(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleSave = async () => {
    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    // UC_SYS_05_TC18: không thay đổi gì thì báo rõ thay vì gửi request
    if (
      trimmedName === (user?.fullName || "").trim() &&
      trimmedPhone === (user?.phone || "").trim()
    ) {
      setEditing(false);
      setToast({ message: "Không có thay đổi nào.", type: "success" });
      setTimeout(() => setToast(null), 4000);
      return;
    }
    setSaving(true);
    try {
      const token = auth.getToken();
      const res = await fetch(`${basePath}/api/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        // UC_SYS_05_TC02/TC18: API đọc snake_case (full_name)
        body: JSON.stringify({ full_name: trimmedName, phone: trimmedPhone }),
      });
      const result = await res.json();
      if (result.success) {
        // UC_SYS_05_TC21: lưu cả vào localStorage (auth.saveUser)
        const updated = { ...user!, fullName: trimmedName, phone: trimmedPhone };
        auth.saveUser(updated);
        setUser(updated);
        setFullName(trimmedName);
        setPhone(trimmedPhone);
        setEditing(false);
        setToast({ message: "Cập nhật thông tin thành công!", type: "success" });
      } else {
        setToast({ message: result.error || "Cập nhật thất bại.", type: "error" });
      }
    } catch {
      setToast({ message: "Lỗi kết nối.", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleLogout = () => {
    auth.removeToken();
    window.location.href = "/wms/auth";
  };

  if (!user) {
    return (
      <AppLayout title="HỒ SƠ">
        <div className="flex justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
        </div>
      </AppLayout>
    );
  }

  const roleLabels: Record<string, string> = {
    ADMIN: "Quản lý",
    KE_TOAN: "Kế toán kho",
    THU_KHO: "Thủ kho",
    XE_NANG: "Tài xế xe nâng",
    KIEM_KE: "Người kiểm kê",
    SUPER_USER: "Quản trị tối cao",
  };

  return (
    <AppLayout title="HỒ SƠ CÁ NHÂN">
      <div className="p-6">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
            <span className="material-symbols-outlined text-[18px]">{toast.type === "success" ? "check_circle" : "error"}</span>{toast.message}
          </div>
        )}

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-6">
          <span className="text-on-surface-variant">Hệ thống</span>
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">chevron_right</span>
          <span className="font-semibold text-primary">Hồ sơ cá nhân</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: User Card */}
          <div className="space-y-6">
            {/* Identity Card */}
            <div className="bg-gradient-to-br from-primary to-primary-hover text-white rounded-2xl p-6 relative overflow-hidden shadow-lg">
              <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
              <div className="absolute right-4 top-4 opacity-15">
                <span className="material-symbols-outlined text-[56px]">badge</span>
              </div>
              <div className="flex gap-4 items-center z-10 relative">
                <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/50 overflow-hidden flex items-center justify-center flex-shrink-0 relative group">
                  {user.avatarUrl || user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl || user.avatar_url || ""} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-white text-3xl">person</span>
                  )}
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"
                    title="Đổi ảnh đại diện"
                  >
                    {avatarUploading ? (
                      <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                    )}
                  </button>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <div className="flex flex-col">
                  <span className="text-lg font-bold leading-tight">{user.fullName}</span>
                  <span className="text-sm text-white/80">{user.email}</span>
                  <span className="text-xs text-white/60 mt-1 bg-white/15 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 w-fit">
                    <span className="material-symbols-outlined text-[12px]">verified</span>
                    {roleLabels[user.role] || user.role}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-outline-variant p-5 space-y-3">
              <h3 className="text-sm font-semibold mb-3">Thao tác nhanh</h3>
              <Link href="/system/change-password" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-surface-low transition-colors border border-outline-variant/50">
                <span className="material-symbols-outlined text-[20px] text-secondary">lock</span>
                <div>
                  <p className="text-sm font-medium">Đổi mật khẩu</p>
                  <p className="text-xs text-on-surface-variant">Cập nhật mật khẩu đăng nhập</p>
                </div>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant ml-auto">chevron_right</span>
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-rose-50 transition-colors border border-outline-variant/50 w-full text-left">
                <span className="material-symbols-outlined text-[20px] text-error">logout</span>
                <div>
                  <p className="text-sm font-medium text-error">Đăng xuất</p>
                  <p className="text-xs text-on-surface-variant">Thoát khỏi hệ thống</p>
                </div>
              </button>
            </div>
          </div>

          {/* RIGHT: Profile Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-outline-variant p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold">Thông tin cá nhân</h2>
                  <p className="text-sm text-on-surface-variant">Xem và cập nhật thông tin tài khoản của bạn.</p>
                </div>
                {!editing && (
                  <button onClick={() => setEditing(true)} className="px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-semibold hover:bg-primary/20 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">edit</span> Chỉnh sửa
                  </button>
                )}
              </div>

              <div className="space-y-5">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">Họ và tên</label>
                  {editing ? (
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                      className="w-full px-4 py-3 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  ) : (
                    <p className="text-sm font-medium py-3">{user.fullName}</p>
                  )}
                </div>

                {/* Email (read-only) */}
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">Email</label>
                  <p className="text-sm font-medium py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-secondary">mail</span>
                    {user.email}
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">ĐÃ XÁC THỰC</span>
                  </p>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">Số điện thoại</label>
                  {editing ? (
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      className="w-full px-4 py-3 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="0901 234 567" />
                  ) : (
                    <p className="text-sm font-medium py-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-secondary">call</span>
                      {user.phone || "Chưa cập nhật"}
                    </p>
                  )}
                </div>

                {/* Role (read-only) */}
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">Vai trò</label>
                  <p className="text-sm font-medium py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-secondary">shield_person</span>
                    {roleLabels[user.role] || user.role}
                  </p>
                </div>

                {/* Actions */}
                {editing && (
                  <div className="flex items-center gap-3 pt-3 border-t border-outline-variant">
                    <button onClick={handleSave} disabled={saving}
                      className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover flex items-center gap-2 disabled:opacity-50">
                      <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "save"}</span>
                      {saving ? "Đang lưu..." : "Lưu thay đổi"}
                    </button>
                    <button onClick={() => { setEditing(false); setFullName(user.fullName); setPhone(user.phone || ""); }}
                      className="px-6 py-2.5 bg-surface-low text-on-surface rounded-lg text-sm font-semibold hover:bg-surface-mid">
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Account Info */}
            <div className="bg-white rounded-xl border border-outline-variant p-6">
              <h3 className="text-sm font-semibold mb-4">Thông tin tài khoản</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3.5 bg-surface-low rounded-lg">
                  <span className="material-symbols-outlined text-[20px] text-secondary">warehouse</span>
                  <div>
                    <p className="text-xs text-on-surface-variant">Kho phụ trách</p>
                    <p className="text-sm font-semibold">Kho A</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3.5 bg-surface-low rounded-lg">
                  <span className="material-symbols-outlined text-[20px] text-secondary">fingerprint</span>
                  <div>
                    <p className="text-xs text-on-surface-variant">Mã người dùng</p>
                    <p className="text-sm font-mono font-semibold">{user.id?.slice(0, 8) || "—"}...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
