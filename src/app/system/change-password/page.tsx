"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { auth } from "@/lib/auth";

interface SessionInfo {
  id: string;
  device_info: string;
  ip_address: string | null;
  location: string | null;
  last_active: string;
  created_at: string;
  is_current: boolean;
}

function getPasswordStrength(password: string) {
  let score = 0;
  const checks = {
    length: password.length >= 8,
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    unique: true, // Will be checked on submit
    upperLower: /[A-Z]/.test(password) && /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  if (checks.length) score++;
  if (checks.special) score++;
  if (checks.upperLower) score++;
  if (checks.number) score++;

  let label = "Yếu";
  let color = "bg-error";
  let barWidth = "w-1/4";

  if (score >= 4) {
    label = "Mạnh";
    color = "bg-success";
    barWidth = "w-full";
  } else if (score >= 3) {
    label = "Trung bình";
    color = "bg-warning";
    barWidth = "w-3/4";
  } else if (score >= 2) {
    label = "Trung bình";
    color = "bg-warning";
    barWidth = "w-1/2";
  }

  return { score, checks, label, color, barWidth };
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Vừa xong";
  if (diffMins < 60) return `hoạt động ${diffMins} phút trước`;
  if (diffHours < 24) return `hoạt động ${diffHours} giờ trước`;
  return `hoạt động ${diffDays} ngày trước`;
}

function getDeviceIcon(deviceInfo: string): string {
  if (/iPhone|Android/i.test(deviceInfo)) return "smartphone";
  if (/iPad/i.test(deviceInfo)) return "tablet";
  return "computer";
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const strength = getPasswordStrength(newPassword);

  // Mật khẩu KHÔNG được chứa khoảng trắng — loại bỏ mọi ký tự trắng ngay khi gõ/dán
  const noSpace = (v: string) => v.replace(/\s/g, "");

  const fetchSessions = useCallback(async () => {
    const token = auth.getToken();
    if (!token) return;
    try {
      const res = await fetch("/wms/api/auth/sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error("Failed to fetch sessions", err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // TC_T03_16: Prevent double submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setErrorMsg("");
    setSuccessMsg("");

    // TC_T03_02, TC_T03_03, TC_T03_04, TC_T03_05: Client-side required validation
    if (!currentPassword) {
      setErrorMsg("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }
    if (!newPassword) {
      setErrorMsg("Vui lòng nhập mật khẩu mới.");
      return;
    }
    if (!confirmPassword) {
      setErrorMsg("Vui lòng nhập xác nhận mật khẩu.");
      return;
    }

    // Mật khẩu không được chứa khoảng trắng
    if (/\s/.test(newPassword)) {
      setErrorMsg("Mật khẩu không được chứa khoảng trắng.");
      return;
    }

    // TC_T03_07: Confirm match
    if (newPassword !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp.");
      return;
    }

    // TC_T03_09, TC_T03_11: Client-side rule check
    if (strength.score < 3) {
      setErrorMsg("Mật khẩu mới chưa đạt yêu cầu bảo mật.");
      return;
    }

    setIsLoading(true);

    try {
      const token = auth.getToken();
      const res = await fetch("/wms/api/auth/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Đổi mật khẩu thất bại.");
        setIsLoading(false);
        return;
      }

      // TC_T03_01, TC_T03_18: Thành công -> Logout và redirect
      setSuccessMsg("Đổi mật khẩu thành công! Đang chuyển về trang đăng nhập...");
      setTimeout(() => {
        auth.removeToken();
        window.location.href = "/wms/auth";
      }, 2000);
    } catch (error) {
      // TC_T03_26: Network error
      setErrorMsg("Lỗi kết nối mạng. Vui lòng kiểm tra lại.");
      setIsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    const token = auth.getToken();
    if (!token) return;
    try {
      const res = await fetch(`/wms/api/auth/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } catch (err) {
      console.error("Failed to revoke session", err);
    }
  };

  const handleRevokeAll = async () => {
    const token = auth.getToken();
    if (!token) return;
    try {
      const res = await fetch("/wms/api/auth/sessions", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSessions((prev) => prev.filter((s) => s.is_current));
      }
    } catch (err) {
      console.error("Failed to revoke all sessions", err);
    }
  };

  return (
    <AppLayout title="ĐỔI MẬT KHẨU">
      <div className="p-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-6">
          <span className="text-on-surface-variant">Hệ thống</span>
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">chevron_right</span>
          <span className="font-semibold text-primary">Đổi mật khẩu</span>
        </div>

        <h1 className="text-xl font-semibold mb-6">Hệ thống › Đổi mật khẩu</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT PANEL: Form đổi mật khẩu */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-outline-variant p-6">
              <h2 className="text-lg font-semibold mb-1">Cập nhật mật khẩu</h2>
              <p className="text-sm text-on-surface-variant mb-6">
                Sử dụng mật khẩu mạnh để bảo vệ quyền truy cập kho hàng của bạn.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Mật khẩu hiện tại */}
                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="currentPassword">
                    Mật khẩu hiện tại
                  </label>
                  <div className="relative">
                    <input
                      id="currentPassword"
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(noSpace(e.target.value))}
                      className="w-full px-4 py-3 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary pr-12"
                      placeholder="••••••••"
                      maxLength={20}
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showCurrent ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Mật khẩu mới */}
                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="newPassword">
                    Mật khẩu mới
                  </label>
                  <div className="relative">
                    <input
                      id="newPassword"
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(noSpace(e.target.value))}
                      className="w-full px-4 py-3 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary pr-12"
                      placeholder="••••••••"
                      maxLength={20}
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showNew ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>

                  {/* Thanh đo sức mạnh mật khẩu */}
                  {newPassword && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="label-caps text-on-surface-variant">ĐỘ MẠNH MẬT KHẨU</span>
                        <span className={`text-xs font-semibold ${
                          strength.label === "Mạnh" ? "text-success" :
                          strength.label === "Trung bình" ? "text-warning" : "text-error"
                        }`}>
                          {strength.label}
                        </span>
                      </div>
                      <div className="h-1.5 bg-surface-variant rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${strength.color} ${strength.barWidth}`} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Xác nhận mật khẩu mới */}
                <div>
                  <label className="block text-sm font-medium mb-1.5" htmlFor="confirmPassword">
                    Xác nhận mật khẩu mới
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(noSpace(e.target.value))}
                      className="w-full px-4 py-3 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary pr-12"
                      placeholder="••••••••"
                      maxLength={20}
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showConfirm ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                  {/* Mismatch warning */}
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-error text-xs mt-1.5">Mật khẩu xác nhận không khớp.</p>
                  )}
                </div>

                {/* Error / Success Messages */}
                {errorMsg && (
                  <div className="text-error text-sm font-medium bg-error-container/20 p-3 rounded-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="text-success text-sm font-medium bg-success-container/20 p-3 rounded-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    {successMsg}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <a href="#" className="text-sm text-secondary font-medium hover:underline">
                    Quên mật khẩu?
                  </a>
                  <button
                    type="submit"
                    disabled={isLoading || !!successMsg}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-container transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        Lưu thay đổi
                        <span className="material-symbols-outlined text-[18px]">save</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Yêu cầu bảo mật */}
            <div className="bg-white rounded-xl border border-outline-variant p-6">
              <h3 className="text-sm font-semibold mb-4">Yêu cầu bảo mật</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                  strength.checks.length ? "border-success/30 bg-success-container/10" : "border-outline-variant bg-surface-low"
                }`}>
                  <span className={`material-symbols-outlined text-[20px] ${strength.checks.length ? "text-success" : "text-outline"}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}>
                    {strength.checks.length ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <div>
                    <p className="text-sm font-medium">Độ dài tối thiểu</p>
                    <p className="text-xs text-on-surface-variant">Sử dụng ít nhất 8 ký tự.</p>
                  </div>
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                  strength.checks.special ? "border-success/30 bg-success-container/10" : "border-outline-variant bg-surface-low"
                }`}>
                  <span className={`material-symbols-outlined text-[20px] ${strength.checks.special ? "text-success" : "text-outline"}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}>
                    {strength.checks.special ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <div>
                    <p className="text-sm font-medium">Ký tự đặc biệt</p>
                    <p className="text-xs text-on-surface-variant">Bao gồm @, #, $, hoặc %.</p>
                  </div>
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                  newPassword && currentPassword && newPassword !== currentPassword
                    ? "border-success/30 bg-success-container/10"
                    : "border-outline-variant bg-surface-low"
                }`}>
                  <span className={`material-symbols-outlined text-[20px] ${
                    newPassword && currentPassword && newPassword !== currentPassword ? "text-success" : "text-outline"
                  }`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    {newPassword && currentPassword && newPassword !== currentPassword ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <div>
                    <p className="text-sm font-medium">Tính duy nhất</p>
                    <p className="text-xs text-on-surface-variant">Không trùng mật khẩu cũ.</p>
                  </div>
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                  strength.checks.upperLower ? "border-success/30 bg-success-container/10" : "border-outline-variant bg-surface-low"
                }`}>
                  <span className={`material-symbols-outlined text-[20px] ${strength.checks.upperLower ? "text-success" : "text-outline"}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}>
                    {strength.checks.upperLower ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <div>
                    <p className="text-sm font-medium">Chữ hoa & Thường</p>
                    <p className="text-xs text-on-surface-variant">Cần cả chữ hoa và chữ thường.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Phiên đăng nhập */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-outline-variant p-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-semibold">Phiên đăng nhập</h3>
                {sessions.length > 1 && (
                  <button
                    onClick={handleRevokeAll}
                    className="text-xs font-semibold text-error hover:text-error/80 bg-error-container/20 px-3 py-1 rounded-full transition-colors"
                  >
                    Đăng xuất tất cả
                  </button>
                )}
              </div>
              <p className="text-xs text-on-surface-variant mb-4">Quản lý các thiết bị đang truy cập</p>

              {sessionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-4">Không có phiên đăng nhập nào.</p>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        session.is_current
                          ? "border-primary/20 bg-primary/5"
                          : "border-outline-variant hover:bg-surface-low"
                      }`}
                    >
                      <div className="w-10 h-10 bg-surface-low rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-on-surface-variant">
                          {getDeviceIcon(session.device_info)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{session.device_info}</p>
                          {session.is_current && (
                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase whitespace-nowrap">
                              HIỆN TẠI
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-on-surface-variant truncate">
                          IP: {session.ip_address || "N/A"}
                          {session.location && ` · ${session.location}`}
                        </p>
                        <p className="text-xs text-outline">{formatTimeAgo(session.last_active)}</p>
                      </div>
                      {!session.is_current && (
                        <button
                          onClick={() => handleRevokeSession(session.id)}
                          className="flex-shrink-0 p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition-colors"
                          title="Đăng xuất phiên này"
                        >
                          <span className="material-symbols-outlined text-[20px]">logout</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cần hỗ trợ */}
            <div className="bg-warning/10 rounded-xl border border-warning/30 p-5">
              <h4 className="text-sm font-semibold mb-2">Cần hỗ trợ?</h4>
              <p className="text-xs text-on-surface-variant mb-3">
                Nếu bạn không nhận được mã reset hoặc gặp lỗi bảo mật, hãy liên hệ ngay đội IT.
              </p>
              <div className="space-y-1.5">
                <p className="text-xs font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-secondary">mail</span>
                  support@vinhgiang.vn
                </p>
                <p className="text-xs font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-secondary">call</span>
                  Hotline: 1900 6789 (Ext: 102)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
