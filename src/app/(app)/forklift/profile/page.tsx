"use client";

import React, { useState, useEffect } from "react";
import { BackLink } from "@/components/mobile/BackLink";
import { MobileAccountSettings } from "@/components/mobile/MobileAccountSettings";
import { auth, AuthUser } from "@/lib/auth";

export default function ForkliftProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.isAuthenticated()) {
      setUser(auth.getUser());
    }
  }, []);

  const handleLogout = () => {
    setLoading(true);
    setTimeout(() => {
      auth.removeToken();
      window.location.href = "/wms/auth";
    }, 800);
  };

  // Mock performance KPIs for driver validation
  const driverKpis = {
    movesToday: 14,
    fefoPicks: 5,
    accuracy: "99.2%",
    shiftHours: "7.5h",
  };

  // Mock License info
  const licenseInfo = {
    certNo: "FL-2026.0592-VG",
    classType: "Xe nâng điện ngồi lái (Class 1 & 4)",
    issuedBy: "Sở LĐ-TB&XH Long An",
    expiryDate: "30/12/2028",
    status: "ACTIVE",
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="px-margin-mobile py-md w-full flex flex-col gap-sm">
      
      {/* Header */}
      <div className="flex flex-col gap-xs">
        <BackLink href="/forklift">Quay lại</BackLink>
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[24px]">person</span> Hồ sơ cá nhân
        </h1>
      </div>

      {/* Driver Identity Card */}
      <section className="bg-gradient-to-br from-primary to-primary-hover text-white rounded-2xl p-lg flex flex-col gap-md shadow-lg relative overflow-hidden">
        {/* Glow Decorator */}
        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
        <div className="absolute right-4 top-4 opacity-15">
          <span className="material-symbols-outlined text-[72px]">forklift</span>
        </div>

        <div className="flex gap-md items-center z-10">
          <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/50 flex items-center justify-center overflow-hidden shrink-0">
            {user.avatarUrl || user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl || user.avatar_url || ""} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-white text-3xl font-bold">person</span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-body-lg font-bold leading-tight">{user.fullName}</span>
            <span className="text-xs text-white/80 font-mono mt-0.5">ID: {user.id}</span>
            <span className="inline-flex max-w-max mt-1 bg-white/20 text-white font-mono text-[11px] md:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded">
              Tài xế vận hành
            </span>
          </div>
        </div>
      </section>

      {/* Driver License Badge */}
      <section className="bg-white rounded-xl border border-outline-variant/60 p-md shadow-sm flex flex-col gap-xs">
        <span className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          Chứng chỉ vận hành xe nâng
        </span>
        <div className="flex gap-md items-center mt-1 p-sm bg-surface-low rounded-lg border border-outline-variant/30">
          <div className="w-12 h-12 bg-white rounded border border-outline-variant/50 flex items-center justify-center shrink-0">
            {/* Mock Certificate QR code */}
            <span className="material-symbols-outlined text-primary text-[36px]">qr_code_2</span>
          </div>
          <div className="flex-1 flex flex-col text-[11px] md:text-xs text-on-surface-variant/80 gap-0.5">
            <div className="font-semibold text-primary">Số hiệu: <span className="font-mono font-bold text-secondary">{licenseInfo.certNo}</span></div>
            <div className="text-[11px] md:text-xs truncate">{licenseInfo.classType}</div>
            <div>Hạn dùng: <strong className="text-success">{licenseInfo.expiryDate}</strong></div>
          </div>
          <div className="flex flex-col items-center">
            <span className="material-symbols-outlined text-success text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            <span className="text-[11px] md:text-xs text-success font-bold uppercase tracking-tight">Hợp lệ</span>
          </div>
        </div>
      </section>

      {/* Performance KPIs Gauge */}
      <section className="grid grid-cols-2 gap-sm">
        <div className="bg-white rounded-xl border border-outline-variant/60 p-sm shadow-sm flex flex-col items-center text-center">
          <span className="text-[11px] md:text-xs font-bold text-on-surface-variant/80 uppercase">Pallet dời hôm nay</span>
          <span className="text-2xl font-bold font-jetbrains text-primary mt-1">{driverKpis.movesToday}</span>
          <span className="text-[11px] md:text-xs text-on-surface-variant mt-0.5">Mục tiêu ca: 20</span>
        </div>
        <div className="bg-white rounded-xl border border-outline-variant/60 p-sm shadow-sm flex flex-col items-center text-center">
          <span className="text-[11px] md:text-xs font-bold text-on-surface-variant/80 uppercase">Độ chính xác quét</span>
          <span className="text-2xl font-bold font-jetbrains text-success mt-1">{driverKpis.accuracy}</span>
          <span className="text-[11px] md:text-xs text-on-surface-variant mt-0.5">Mục tiêu: &gt;99%</span>
        </div>
      </section>

      {/* Thông tin cá nhân (xem/sửa) + Đổi mật khẩu — dùng chung mobile */}
      <MobileAccountSettings user={user} onUserChange={setUser} />

      {/* Settings list */}
      <section className="bg-white rounded-xl border border-outline-variant/60 overflow-hidden shadow-sm flex flex-col">
        <div className="px-md py-sm border-b border-outline-variant/40 bg-surface-low/30">
          <span className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">Cấu hình vận hành</span>
        </div>

        {/* Setting 1: sound alert */}
        <div className="flex justify-between items-center px-md py-3 border-b border-outline-variant/30">
          <div className="flex items-center gap-sm text-xs">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">volume_up</span>
            <div className="flex flex-col">
              <span className="font-semibold text-primary">Cảnh báo bằng âm thanh</span>
              <span className="text-[11px] md:text-xs text-on-surface-variant/80">Phát âm khi có pallet FEFO khẩn cấp</span>
            </div>
          </div>
          <button
            onClick={() => setSoundAlerts(!soundAlerts)}
            className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 ${soundAlerts ? "bg-primary" : "bg-outline-variant"}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${soundAlerts ? "translate-x-4" : "translate-x-0"}`}></div>
          </button>
        </div>

        {/* Setting 2: haptic feedback */}
        <div className="flex justify-between items-center px-md py-3">
          <div className="flex items-center gap-sm text-xs">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">vibration</span>
            <div className="flex flex-col">
              <span className="font-semibold text-primary">Rung phản hồi</span>
              <span className="text-[11px] md:text-xs text-on-surface-variant/80">Rung khi quét mã thành công</span>
            </div>
          </div>
          <button
            onClick={() => setHapticFeedback(!hapticFeedback)}
            className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 ${hapticFeedback ? "bg-primary" : "bg-outline-variant"}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${hapticFeedback ? "translate-x-4" : "translate-x-0"}`}></div>
          </button>
        </div>
      </section>

      {/* Logout button */}
      <button
        onClick={handleLogout}
        disabled={loading}
        className="w-full mt-2 px-4 py-3 border-2 border-error text-error rounded-lg text-sm font-semibold hover:bg-error-container/10 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[18px]">{loading ? "progress_activity" : "logout"}</span>
        ĐĂNG XUẤT TÀI KHOẢN
      </button>

    </div>
  );
}
