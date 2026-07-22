"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, AuthUser } from "@/lib/auth";
import { mobileHref } from "@/lib/mobile-href";
import { BackLink } from "@/components/mobile/BackLink";
import { MobileAccountSettings } from "@/components/mobile/MobileAccountSettings";

export default function KiemkeProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (auth.isAuthenticated()) setUser(auth.getUser()); }, []);

  const handleLogout = () => { setLoading(true); setTimeout(() => { auth.removeToken(); window.location.href = "/wms/auth"; }, 800); };

  if (!user) return <div className="flex items-center justify-center h-[60vh]"><span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span></div>;

  return (
    <div className="px-margin-mobile py-md w-full flex flex-col gap-sm">
      <div className="flex flex-col gap-xs">
        <BackLink href="/kiemke">Quay lại</BackLink>
        <h1 className="text-xl font-bold text-primary flex items-center gap-2"><span className="material-symbols-outlined text-[24px]">person</span> Hồ sơ cá nhân</h1>
      </div>

      {/* Identity Card */}
      <section className="bg-gradient-to-br from-primary to-primary-hover text-white rounded-2xl p-lg flex flex-col gap-md shadow-lg relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
        <div className="absolute right-4 top-4 opacity-15"><span className="material-symbols-outlined text-[72px]">fact_check</span></div>
        <div className="flex gap-md items-center z-10">
          <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/50 flex items-center justify-center overflow-hidden shrink-0">
            {user.avatarUrl || user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl || user.avatar_url || ""} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-white text-3xl">person</span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-body-lg font-bold">{user.fullName}</span>
            <span className="text-xs text-white/80 font-mono mt-0.5">ID: {user.id}</span>
            <span className="inline-flex max-w-max mt-1 bg-white/20 text-white font-mono text-[11px] md:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded">
              Nhân viên kiểm kê
            </span>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-3 gap-sm">
        <div className="bg-white rounded-xl border border-outline-variant/60 p-sm shadow-sm flex flex-col items-center text-center">
          <span className="text-[11px] md:text-xs font-bold text-on-surface-variant/80 uppercase">Vị trí đếm</span>
          <span className="text-2xl font-bold font-jetbrains text-primary mt-1">—</span>
        </div>
        <div className="bg-white rounded-xl border border-outline-variant/60 p-sm shadow-sm flex flex-col items-center text-center">
          <span className="text-[11px] md:text-xs font-bold text-on-surface-variant/80 uppercase">Phiên xong</span>
          <span className="text-2xl font-bold font-jetbrains text-success mt-1">—</span>
        </div>
        <div className="bg-white rounded-xl border border-outline-variant/60 p-sm shadow-sm flex flex-col items-center text-center">
          <span className="text-[11px] md:text-xs font-bold text-on-surface-variant/80 uppercase">Chính xác</span>
          <span className="text-2xl font-bold font-jetbrains text-secondary mt-1">—</span>
        </div>
      </section>

      {/* Thông tin cá nhân (xem/sửa) + Đổi mật khẩu — dùng chung mobile */}
      <MobileAccountSettings user={user} onUserChange={setUser} />

      {/* Settings */}
      <section className="bg-white rounded-xl border border-outline-variant/60 overflow-hidden shadow-sm flex flex-col">
        <div className="px-md py-sm border-b border-outline-variant/40 bg-surface-low/30">
          <span className="text-[11px] md:text-xs font-bold text-on-surface-variant uppercase tracking-wider">Cài đặt</span>
        </div>
        <div className="flex justify-between items-center px-md py-3 border-b border-outline-variant/30">
          <div className="flex items-center gap-sm text-xs">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">volume_up</span>
            <div className="flex flex-col"><span className="font-semibold text-primary">Cảnh báo âm thanh</span><span className="text-[11px] md:text-xs text-on-surface-variant/80">Phát âm khi có phiên mới</span></div>
          </div>
          <button onClick={() => setSoundAlerts(!soundAlerts)} className={`w-10 h-6 rounded-full p-0.5 transition-colors ${soundAlerts ? "bg-primary" : "bg-outline-variant"}`}>
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${soundAlerts ? "translate-x-4" : "translate-x-0"}`}></div>
          </button>
        </div>
        <div className="flex justify-between items-center px-md py-3">
          <div className="flex items-center gap-sm text-xs">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">vibration</span>
            <div className="flex flex-col"><span className="font-semibold text-primary">Rung phản hồi</span><span className="text-[11px] md:text-xs text-on-surface-variant/80">Rung khi quét mã thành công</span></div>
          </div>
          <button onClick={() => setHapticFeedback(!hapticFeedback)} className={`w-10 h-6 rounded-full p-0.5 transition-colors ${hapticFeedback ? "bg-primary" : "bg-outline-variant"}`}>
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${hapticFeedback ? "translate-x-4" : "translate-x-0"}`}></div>
          </button>
        </div>
      </section>

      {/* Logout */}
      <button onClick={handleLogout} disabled={loading} className="w-full mt-2 px-4 py-3 border-2 border-error text-error rounded-lg text-sm font-semibold hover:bg-error-container/10 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
        <span className="material-symbols-outlined text-[18px]">{loading ? "progress_activity" : "logout"}</span>
        ĐĂNG XUẤT TÀI KHOẢN
      </button>
    </div>
  );
}
