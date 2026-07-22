"use client";

/**
 * MobileAccountSettings — khối "Thông tin cá nhân" (xem + sửa tên/SĐT) và
 * "Bảo mật / Đổi mật khẩu" dùng chung cho các app mobile (thủ kho / xe nâng / kiểm kê).
 *
 * Lý do tách component:
 *  - Trước đây 3 trang profile mobile chỉ HIỂN THỊ tên + vai trò, KHÔNG có form sửa
 *    tên/SĐT (UC_SYS_05 TC01–04, 08–11, 19, 21, 23 fail trên mobile).
 *  - Nút "Đổi mật khẩu" trỏ tới đường dẫn cứng `/wms/system/change-password` (thủ kho,
 *    kiểm kê) hoặc `/auth/change-password` không tồn tại (xe nâng) → trên các build
 *    standalone (basePath = /thukho, /kiemke, /xenang) bấm vào KHÔNG chuyển màn
 *    (TC06, 07, 14, 15, 16, 17 fail).
 *
 * Cách xử lý: đặt cả 2 chức năng INLINE ngay trong trang profile, không điều hướng
 * chéo instance → tránh hoàn toàn lỗi basePath. API gọi theo basePath của chính build
 * hiện tại nên mỗi PM2 instance tự gọi API của mình (cùng 1 DB).
 */

import React, { useState, useRef } from "react";
import { auth, AuthUser } from "@/lib/auth";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const roleLabels: Record<string, string> = {
  ADMIN: "Quản lý",
  MANAGER: "Quản lý",
  STAFF: "Nhân viên",
  QUAN_LY: "Quản lý",
  KE_TOAN: "Kế toán kho",
  THU_KHO: "Thủ kho",
  XE_NANG: "Tài xế xe nâng",
  KIEM_KE: "Người kiểm kê",
  SUPER_USER: "Quản trị tối cao",
};

// Mật khẩu KHÔNG được chứa khoảng trắng — loại bỏ ngay khi gõ/dán (đồng bộ desktop).
const noSpace = (v: string) => v.replace(/\s/g, "");

type Props = {
  user: AuthUser;
  onUserChange?: (u: AuthUser) => void;
};

export function MobileAccountSettings({ user, onUserChange }: Props) {
  // ---- Thông tin cá nhân ----
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user.fullName || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoError, setInfoError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = ""; // Reset file input
    if (!file) return;

    // UC_SYS_05_TC13: Giới hạn dung lượng file ảnh (tối đa 5MB)
    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showToast(`Dung lượng ảnh không được vượt quá ${MAX_SIZE_MB}MB.`, "error");
      return;
    }

    // UC_SYS_05_TC12: Kiểm tra định dạng file (.png, .jpg, .jpeg, .webp)
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      showToast("Chỉ chấp nhận file ảnh định dạng PNG, JPG, JPEG, hoặc WebP.", "error");
      return;
    }

    setAvatarUploading(true);
    try {
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
        showToast(upResult.error || "Upload ảnh thất bại.", "error");
        return;
      }

      const fullUrl = `${basePath}${upResult.data.file_url}`;
      const token = auth.getToken();
      const saveRes = await fetch(`${basePath}/api/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar_url: fullUrl }),
      });
      const saveResult = await saveRes.json();
      if (saveResult.success) {
        const updated = { ...user, avatarUrl: fullUrl, avatar_url: fullUrl };
        auth.saveUser(updated);
        onUserChange?.(updated);
        showToast("Cập nhật ảnh đại diện thành công!", "success");
      } else {
        showToast(saveResult.error || "Lưu ảnh đại diện thất bại.", "error");
      }
    } catch {
      showToast("Lỗi kết nối khi upload ảnh.", "error");
    } finally {
      setAvatarUploading(false);
    }
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const startEdit = () => {
    setFullName(user.fullName || "");
    setPhone(user.phone || "");
    setInfoError("");
    setEditing(true);
  };

  const handleSaveInfo = async () => {
    const name = fullName.trim();
    const tel = phone.trim();
    setInfoError("");

    // TC08: tên không được để trống
    if (!name) {
      setInfoError("Tên không được để trống.");
      return;
    }
    // TC23: tên cực dài → chặn theo giới hạn server (100 ký tự)
    if (name.length > 100) {
      setInfoError("Họ tên không được vượt quá 100 ký tự.");
      return;
    }
    // TC09 (chứa chữ), TC10 (quá ngắn), TC11 (quá dài): SĐT phải đúng 10 số, bắt đầu bằng 0
    if (tel && !/^0\d{9}$/.test(tel)) {
      setInfoError("Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0).");
      return;
    }

    // Không thay đổi gì → báo rõ, không gửi request thừa
    if (name === (user.fullName || "").trim() && tel === (user.phone || "").trim()) {
      setEditing(false);
      showToast("Không có thay đổi nào.", "success");
      return;
    }

    setSavingInfo(true);
    try {
      const token = auth.getToken();
      const res = await fetch(`${basePath}/api/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        // API đọc snake_case (full_name). Gửi giá trị ĐÃ trim → TC20 (tự trim đầu/cuối).
        body: JSON.stringify({ full_name: name, phone: tel }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        // TC21: ghi cả vào localStorage để refresh vẫn giữ dữ liệu mới.
        const updated: AuthUser = { ...user, fullName: name, phone: tel };
        auth.saveUser(updated);
        onUserChange?.(updated);
        setFullName(name);
        setPhone(tel);
        setEditing(false);
        showToast("Cập nhật thông tin thành công!", "success");
      } else {
        setInfoError(result.error || "Cập nhật thất bại.");
      }
    } catch {
      setInfoError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setSavingInfo(false);
    }
  };

  // ---- Đổi mật khẩu ----
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwLoading) return;
    setPwError("");
    setPwSuccess("");

    if (!currentPassword) {
      setPwError("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }
    if (!newPassword) {
      setPwError("Vui lòng nhập mật khẩu mới.");
      return;
    }
    if (!confirmPassword) {
      setPwError("Vui lòng nhập xác nhận mật khẩu.");
      return;
    }
    // TC15: xác nhận không khớp
    if (newPassword !== confirmPassword) {
      setPwError("Mật khẩu xác nhận không khớp.");
      return;
    }
    // TC16: mật khẩu mới quá ngắn (server yêu cầu tối thiểu 8 ký tự)
    if (newPassword.length < 8) {
      setPwError("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }

    setPwLoading(true);
    try {
      const token = auth.getToken();
      const res = await fetch(`${basePath}/api/auth/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // TC14 (mật khẩu cũ sai), TC17 (trùng mật khẩu cũ), lỗi rule mật khẩu...
        setPwError(data.error || "Đổi mật khẩu thất bại.");
        setPwLoading(false);
        return;
      }
      // TC06: thành công → đăng xuất, chuyển về đăng nhập để TC07 đăng nhập lại bằng MK mới.
      setPwSuccess("Đổi mật khẩu thành công! Đang chuyển về trang đăng nhập...");
      setTimeout(() => {
        auth.removeToken();
        window.location.href = "/wms/auth";
      }, 1500);
    } catch {
      setPwError("Lỗi kết nối mạng. Vui lòng thử lại.");
      setPwLoading(false);
    }
  };

  const inputCls =
    "w-full px-4 py-3 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary";

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          data-testid="profile-toast"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${
            toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.message}
        </div>
      )}

      {/* ===== Thông tin cá nhân ===== */}
      <section className="bg-white rounded-xl border border-outline-variant/60 shadow-sm overflow-hidden">
        <div className="px-md py-sm border-b border-outline-variant/40 bg-surface-low/30 flex items-center justify-between">
          <span className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            Thông tin cá nhân
          </span>
          {!editing && (
            <button
              data-testid="profile-edit-btn"
              onClick={startEdit}
              className="flex items-center gap-1 text-xs font-semibold text-primary px-2.5 py-1 rounded-lg bg-primary/10 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">edit</span> Chỉnh sửa
            </button>
          )}
        </div>

        <div className="p-md flex flex-col gap-md">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center py-2 border-b border-outline-variant/30">
            <div className="relative w-20 h-20">
              <div className="w-20 h-20 rounded-full border-2 border-outline-variant overflow-hidden flex items-center justify-center bg-surface-low relative shadow-inner">
                {user.avatarUrl || user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl || user.avatar_url || ""} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-on-surface-variant text-[40px]">person</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center shadow-md border-2 border-white active:scale-90 transition-all cursor-pointer animate-fade-in"
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
            <span className="text-[11px] text-on-surface-variant/80 mt-2">Nhấn để thay đổi ảnh đại diện (Tối đa 5MB)</span>
          </div>
          {/* Họ và tên */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase">Họ và tên</label>
            {editing ? (
              <input
                data-testid="profile-name-input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputCls}
                placeholder="Nhập họ và tên"
              />
            ) : (
              <span className="text-sm font-semibold text-primary">{user.fullName || "—"}</span>
            )}
          </div>

          {/* Số điện thoại */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase">Số điện thoại</label>
            {editing ? (
              <input
                data-testid="profile-phone-input"
                type="tel"
                disabled
                value={phone}
                className={`${inputCls} bg-surface-low text-on-surface-variant/70 cursor-not-allowed`}
                placeholder="VD: 0901234567"
              />
            ) : (
              <span className="text-sm font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">call</span>
                {user.phone || "Chưa cập nhật"}
              </span>
            )}
          </div>

          {/* Email (chỉ xem) */}
          {user.email && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase">Email</label>
              <span className="text-sm font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">mail</span>
                {user.email}
              </span>
            </div>
          )}

          {/* Vai trò (chỉ xem) */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase">Vai trò</label>
            <span className="text-sm font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">shield_person</span>
              {roleLabels[user.role] || user.role}
            </span>
          </div>

          {/* Lỗi validate */}
          {infoError && (
            <p data-testid="profile-info-error" className="text-error text-xs font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {infoError}
            </p>
          )}

          {/* Nút lưu/hủy */}
          {editing && (
            <div className="flex items-center gap-2 pt-1">
              <button
                data-testid="profile-save-btn"
                onClick={handleSaveInfo}
                disabled={savingInfo}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">{savingInfo ? "progress_activity" : "save"}</span>
                {savingInfo ? "Đang lưu..." : "Lưu"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setInfoError("");
                  setFullName(user.fullName || "");
                  setPhone(user.phone || "");
                }}
                disabled={savingInfo}
                className="px-4 py-2.5 border border-outline-variant text-on-surface rounded-lg text-sm font-semibold active:scale-95 transition-all disabled:opacity-50"
              >
                Hủy
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ===== Bảo mật / Đổi mật khẩu ===== */}
      <section className="bg-white rounded-xl border border-outline-variant/60 shadow-sm overflow-hidden">
        <button
          data-testid="changepw-toggle"
          onClick={() => {
            setPwOpen((v) => !v);
            setPwError("");
            setPwSuccess("");
          }}
          className="w-full flex justify-between items-center px-md py-3 active:bg-surface-low transition-colors"
        >
          <div className="flex items-center gap-sm text-xs">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">lock_reset</span>
            <div className="flex flex-col text-left">
              <span className="font-semibold text-primary">Đổi mật khẩu</span>
              <span className="text-[11px] md:text-xs text-on-surface-variant/80">Thay đổi mật khẩu đăng nhập</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant/50 text-[18px]">
            {pwOpen ? "expand_less" : "chevron_right"}
          </span>
        </button>

        {pwOpen && (
          <form onSubmit={handleChangePassword} className="px-md pb-md flex flex-col gap-md border-t border-outline-variant/40 pt-md">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase">Mật khẩu hiện tại</label>
              <input
                data-testid="cp-current"
                type={showPw ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(noSpace(e.target.value))}
                className={inputCls}
                placeholder="••••••••"
                maxLength={50}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase">Mật khẩu mới</label>
              <input
                data-testid="cp-new"
                type={showPw ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(noSpace(e.target.value))}
                className={inputCls}
                placeholder="Tối thiểu 8 ký tự, có hoa/thường/số/ký tự đặc biệt"
                maxLength={50}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase">Xác nhận mật khẩu mới</label>
              <input
                data-testid="cp-confirm"
                type={showPw ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(noSpace(e.target.value))}
                className={inputCls}
                placeholder="••••••••"
                maxLength={50}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-error text-[11px] md:text-xs mt-0.5">Mật khẩu xác nhận không khớp.</p>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs text-on-surface-variant select-none">
              <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} className="accent-primary" />
              Hiện mật khẩu
            </label>

            {pwError && (
              <p data-testid="cp-error" className="text-error text-xs font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {pwError}
              </p>
            )}
            {pwSuccess && (
              <p data-testid="cp-success" className="text-success text-xs font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                {pwSuccess}
              </p>
            )}

            <button
              data-testid="cp-submit"
              type="submit"
              disabled={pwLoading || !!pwSuccess}
              className="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">{pwLoading ? "progress_activity" : "lock_reset"}</span>
              {pwLoading ? "Đang xử lý..." : "Đổi mật khẩu"}
            </button>
          </form>
        )}
      </section>
    </>
  );
}
