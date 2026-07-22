"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

function getPasswordStrength(password: string) {
  let score = 0;
  const checks = {
    length: password.length >= 8,
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
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
  if (score >= 4) { label = "Mạnh"; color = "bg-success"; barWidth = "w-full"; }
  else if (score >= 3) { label = "Trung bình"; color = "bg-warning"; barWidth = "w-3/4"; }
  else if (score >= 2) { label = "Trung bình"; color = "bg-warning"; barWidth = "w-1/2"; }
  return { score, checks, label, color, barWidth };
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1
  const [identifier, setIdentifier] = useState("");
  // Step 2
  const [otp, setOtp] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const resendRef = useRef<NodeJS.Timeout | null>(null);
  // Step 3
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // Shared
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  // Mock OTP notification
  const [mockOtp, setMockOtp] = useState("");
  const [showMockOtp, setShowMockOtp] = useState(false);
  const mockOtpTimerRef = useRef<NodeJS.Timeout | null>(null);

  const strength = getPasswordStrength(newPassword);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (resendRef.current) clearInterval(resendRef.current);
      if (mockOtpTimerRef.current) clearTimeout(mockOtpTimerRef.current);
    };
  }, []);

  const startOtpCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setOtpCountdown(300);
    countdownRef.current = setInterval(() => {
      setOtpCountdown((prev) => { if (prev <= 1) { if (countdownRef.current) clearInterval(countdownRef.current); return 0; } return prev - 1; });
    }, 1000);
  }, []);

  const startResendCooldown = useCallback(() => {
    if (resendRef.current) clearInterval(resendRef.current);
    setResendCooldown(60);
    resendRef.current = setInterval(() => {
      setResendCooldown((prev) => { if (prev <= 1) { if (resendRef.current) clearInterval(resendRef.current); return 0; } return prev - 1; });
    }, 1000);
  }, []);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // ===== STEP 1: GỬI OTP =====
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading) return;
    setErrorMsg(""); setSuccessMsg("");
    const trimmed = identifier.trim();
    if (!trimmed) { setErrorMsg("Vui lòng nhập Email hoặc Số điện thoại."); return; }
    // Detect email vs SĐT chính xác: có chữ cái HOẶC '@' → là email; toàn số → là SĐT
    const looksLikeEmail = /[a-zA-Z@]/.test(trimmed);
    if (looksLikeEmail) {
      // Strict ASCII email — chặn Unicode/emoji (TC_T04_42)
      if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(trimmed)) {
        setErrorMsg("Địa chỉ Email không hợp lệ."); return;
      }
    } else {
      if (!/^0[0-9]{9}$/.test(trimmed)) {
        setErrorMsg("Số điện thoại không hợp lệ (bắt đầu bằng 0, gồm 10 chữ số)."); return;
      }
    }

    setIsLoading(true);
    try {
      const res = await fetch("/wms/api/auth/forgot-password/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || "Gửi OTP thất bại."); setIsLoading(false); return; }
      setSuccessMsg(`Mã OTP đã được gửi tới ${trimmed}.`);
      setAttemptsLeft(5); setOtp("");
      startOtpCountdown(); startResendCooldown();
      // MOCK: Hiển thị OTP như thông báo message trên màn hình
      if (data.mock_otp) {
        setMockOtp(data.mock_otp);
        setShowMockOtp(true);
        if (mockOtpTimerRef.current) clearTimeout(mockOtpTimerRef.current);
        mockOtpTimerRef.current = setTimeout(() => setShowMockOtp(false), 30000); // Tự ẩn sau 30s
      }
      setStep(2);
    } catch { setErrorMsg("Lỗi kết nối mạng. Vui lòng kiểm tra lại."); }
    finally { setIsLoading(false); }
  };

  // ===== STEP 2: VERIFY OTP =====
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setErrorMsg(""); setSuccessMsg("");
    if (!otp) { setErrorMsg("Vui lòng nhập mã OTP."); return; }
    if (otp.length !== 6) { setErrorMsg("Mã OTP phải gồm 6 chữ số."); return; }

    setIsLoading(true);
    try {
      const res = await fetch("/wms/api/auth/forgot-password/verify-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), otp }),
      });
      const data = await res.json();
      if (!res.ok) { if (data.attemptsLeft !== undefined) setAttemptsLeft(data.attemptsLeft); setErrorMsg(data.error || "Xác thực OTP thất bại."); setIsLoading(false); return; }
      setResetToken(data.resetToken);
      setStep(3);
    } catch { setErrorMsg("Lỗi kết nối mạng. Vui lòng kiểm tra lại."); }
    finally { setIsLoading(false); }
  };

  // ===== STEP 3: RESET PASSWORD =====
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setErrorMsg(""); setSuccessMsg("");
    if (!newPassword) { setErrorMsg("Vui lòng nhập mật khẩu mới."); return; }
    if (!confirmPassword) { setErrorMsg("Vui lòng nhập xác nhận mật khẩu."); return; }
    if (newPassword !== confirmPassword) { setErrorMsg("Mật khẩu xác nhận không khớp."); return; }
    if (strength.score < 3) { setErrorMsg("Mật khẩu mới chưa đạt yêu cầu bảo mật."); return; }

    setIsLoading(true);
    try {
      const res = await fetch("/wms/api/auth/forgot-password/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || "Đặt lại mật khẩu thất bại."); setIsLoading(false); return; }
      setStep(4);
    } catch { setErrorMsg("Lỗi kết nối mạng. Vui lòng kiểm tra lại."); }
    finally { setIsLoading(false); }
  };

  const steps = [
    { num: 1, label: "Xác minh", icon: "person_search" },
    { num: 2, label: "Nhập OTP", icon: "sms" },
    { num: 3, label: "Mật khẩu mới", icon: "lock_reset" },
    { num: 4, label: "Hoàn tất", icon: "check_circle" },
  ];

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* ====== MOCK OTP NOTIFICATION — Popup lớn giữa màn hình ====== */}
      {showMockOtp && mockOtp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ animation: "fadeIn 0.3s ease-out" }}>
          {/* Backdrop mờ */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMockOtp(false)} />
          {/* Card OTP */}
          <div className="relative bg-primary-container text-white rounded-2xl shadow-2xl p-8 w-[480px] max-w-[90vw] border border-secondary/30" style={{ animation: "scaleIn 0.3s ease-out" }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-secondary-container/30 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px] text-on-primary-container">sms</span>
                </div>
                <div>
                  <p className="text-sm font-bold tracking-wider uppercase text-on-primary-container" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>HỆ THỐNG WMS</p>
                  <p className="text-xs text-white/60">Tin nhắn xác thực OTP</p>
                </div>
              </div>
              <button onClick={() => setShowMockOtp(false)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {/* OTP Display */}
            <div className="bg-white/10 rounded-xl p-6 text-center mb-4">
              <p className="text-sm text-white/70 mb-3">Mã OTP của bạn là:</p>
              <p className="text-5xl font-bold tracking-[0.4em] text-white" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "48px", lineHeight: "56px" }}>{mockOtp}</p>
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/50 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">timer</span>
                Mã có hiệu lực 5 phút
              </p>
              <p className="text-xs text-white/50 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                Không chia sẻ mã này
              </p>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      {/* Header Bar — giống WMS nhưng nhẹ hơn */}
      <header className="h-16 bg-white border-b border-surface-variant flex items-center px-6 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[24px]">warehouse</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-primary leading-tight">Vĩnh Giang WMS</h1>
            <p className="text-[10px] font-bold tracking-widest uppercase text-secondary">KHÔI PHỤC MẬT KHẨU</p>
          </div>
        </div>
        <div className="flex-1" />
        <a href="/wms/auth" className="text-sm text-secondary font-medium hover:underline flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">login</span>
          Đăng nhập
        </a>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[900px] mx-auto space-y-6">

          {/* Step Indicator */}
          <div className="bg-white rounded-lg border border-outline-variant p-5">
            <div className="flex items-center justify-between max-w-[600px] mx-auto">
              {steps.map((s, i) => (
                <React.Fragment key={s.num}>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      step > s.num ? "bg-success text-white" :
                      step === s.num ? "bg-primary text-white" :
                      "bg-surface-low text-outline"
                    }`}>
                      {step > s.num ? (
                        <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                      ) : (
                        <span className="material-symbols-outlined text-[20px]">{s.icon}</span>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold tracking-wider uppercase whitespace-nowrap ${
                      step >= s.num ? "text-primary" : "text-outline"
                    }`} style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>{s.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-3 rounded-full transition-all ${
                      step > s.num ? "bg-success" : "bg-surface-variant"
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* MAIN PANEL */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg border border-outline-variant p-6">
                {errorMsg && (
                  <div className="text-error text-sm font-medium bg-error-container/30 p-3 rounded-lg flex items-center gap-2 mb-5">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    {errorMsg}
                  </div>
                )}
                {successMsg && step === 2 && (
                  <div className="text-success text-sm font-medium bg-success-container/20 p-3 rounded-lg flex items-center gap-2 mb-5">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    {successMsg}
                  </div>
                )}

                {/* STEP 1 */}
                {step === 1 && (
                  <>
                    <h2 className="text-lg font-semibold text-primary mb-1">Bước 1 — Xác minh tài khoản</h2>
                    <p className="text-sm text-on-surface-variant mb-6">Nhập Email hoặc Số điện thoại đã đăng ký. Mã OTP gồm 6 chữ số sẽ được gửi tới thiết bị của bạn.</p>
                    <form onSubmit={handleSendOtp} className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-on-surface mb-1.5" htmlFor="fp-id">Email hoặc Số điện thoại</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">contact_mail</span>
                          </div>
                          <input id="fp-id" className="w-full pl-11 pr-4 py-3 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary-container bg-white" placeholder="admin@vinhgiang.vn hoặc 0987654321" value={identifier} onChange={(e) => setIdentifier(e.target.value)} type="text" maxLength={50} />
                        </div>
                      </div>
                      <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-container text-white text-sm font-semibold rounded-lg hover:bg-primary transition-all disabled:opacity-60">
                        {isLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang gửi...</> : <>Gửi mã OTP <span className="material-symbols-outlined text-[18px]">send</span></>}
                      </button>
                    </form>
                  </>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                  <>
                    <h2 className="text-lg font-semibold text-primary mb-1">Bước 2 — Xác thực mã OTP</h2>
                    <p className="text-sm text-on-surface-variant mb-6">Mã xác thực 6 chữ số đã được gửi tới <strong className="text-on-surface">{identifier.trim()}</strong>.</p>
                    <form onSubmit={handleVerifyOtp} className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-on-surface mb-1.5" htmlFor="fp-otp">Mã OTP</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">sms</span>
                          </div>
                          <input id="fp-otp" className="w-full pl-11 pr-4 py-3 border border-outline-variant rounded-lg text-lg text-center tracking-[0.3em] focus:ring-2 focus:ring-primary/20 focus:border-primary-container bg-white" style={{ fontFamily: "'IBM Plex Mono', monospace" }} placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} type="text" maxLength={6} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div>{otpCountdown > 0 ? (
                          <span className="flex items-center gap-1.5 text-on-surface-variant"><span className="material-symbols-outlined text-[16px]">timer</span>Hiệu lực: <span className="font-semibold text-primary" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtTime(otpCountdown)}</span></span>
                        ) : (
                          <span className="text-error font-medium flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">timer_off</span>OTP đã hết hạn</span>
                        )}</div>
                        <div className="text-on-surface-variant">Lượt thử: <span className="font-semibold text-primary" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{attemptsLeft}/5</span></div>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-3 border-t border-surface-variant">
                        <span className="text-on-surface-variant">Không nhận được mã?</span>
                        <button type="button" disabled={resendCooldown > 0 || isLoading} onClick={() => handleSendOtp()} className="text-secondary font-semibold hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
                          {resendCooldown > 0 ? `Gửi lại sau ${resendCooldown}s` : "Gửi lại mã OTP"}
                        </button>
                      </div>
                      <button type="submit" disabled={isLoading || otpCountdown === 0} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-container text-white text-sm font-semibold rounded-lg hover:bg-primary transition-all disabled:opacity-60">
                        {isLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang xác thực...</> : <>Xác nhận OTP <span className="material-symbols-outlined text-[18px]">verified</span></>}
                      </button>
                    </form>
                  </>
                )}

                {/* STEP 3 */}
                {step === 3 && (
                  <>
                    <h2 className="text-lg font-semibold text-primary mb-1">Bước 3 — Thiết lập mật khẩu mới</h2>
                    <p className="text-sm text-on-surface-variant mb-6">Đặt mật khẩu mới có độ bảo mật cao cho tài khoản <strong className="text-on-surface">{identifier.trim()}</strong>.</p>
                    <form onSubmit={handleResetPassword} className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-on-surface mb-1.5" htmlFor="fp-pw">Mật khẩu mới</label>
                        <div className="relative">
                          <input id="fp-pw" type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value.replace(/\s/g, ""))} className="w-full px-4 py-3 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary-container pr-12 bg-white" placeholder="••••••••" maxLength={20} />
                          {/* Phase 8 — TC_T04_39: tabIndex=-1 để Enter không kích hoạt nhầm
                              nút toggle mắt mà submit form như mong đợi. */}
                          <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary-container transition-colors">
                            <span className="material-symbols-outlined text-[20px]">{showNew ? "visibility_off" : "visibility"}</span>
                          </button>
                        </div>
                        {newPassword && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>ĐỘ MẠNH MẬT KHẨU</span>
                              <span className={`text-xs font-semibold ${strength.label === "Mạnh" ? "text-success" : strength.label === "Trung bình" ? "text-warning" : "text-error"}`}>{strength.label}</span>
                            </div>
                            <div className="h-1.5 bg-surface-variant rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${strength.color} ${strength.barWidth}`} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-on-surface mb-1.5" htmlFor="fp-cpw">Xác nhận mật khẩu mới</label>
                        <div className="relative">
                          <input id="fp-cpw" type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value.replace(/\s/g, ""))} className="w-full px-4 py-3 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary-container pr-12 bg-white" placeholder="••••••••" maxLength={20} />
                          <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary-container transition-colors">
                            <span className="material-symbols-outlined text-[20px]">{showConfirm ? "visibility_off" : "visibility"}</span>
                          </button>
                        </div>
                        {confirmPassword && newPassword !== confirmPassword && (
                          <p className="text-error text-xs mt-1.5">Mật khẩu xác nhận không khớp.</p>
                        )}
                      </div>
                      <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-container text-white text-sm font-semibold rounded-lg hover:bg-primary transition-all disabled:opacity-60">
                        {isLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang xử lý...</> : <>Đặt lại mật khẩu <span className="material-symbols-outlined text-[18px]">save</span></>}
                      </button>
                    </form>
                  </>
                )}

                {/* STEP 4 */}
                {step === 4 && (
                  <div className="text-center py-8 space-y-5">
                    <div className="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto">
                      <span className="material-symbols-outlined text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-success">Khôi phục thành công!</h3>
                      <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto">Mật khẩu mới đã được thiết lập. Tất cả phiên đăng nhập cũ đã thu hồi. Hãy đăng nhập lại.</p>
                    </div>
                    <button onClick={() => router.push("/auth")} className="inline-flex items-center gap-2 px-8 py-3 bg-primary-container text-white text-sm font-semibold rounded-lg hover:bg-primary transition-all">
                      Về trang đăng nhập <span className="material-symbols-outlined text-[18px]">login</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="space-y-6">
              {/* Yêu cầu bảo mật — Step 3 */}
              {step === 3 && (
                <div className="bg-white rounded-lg border border-outline-variant p-5">
                  <h3 className="text-sm font-semibold text-primary mb-4">Yêu cầu bảo mật</h3>
                  <div className="space-y-2.5">
                    {[
                      { ok: strength.checks.length, t: "Tối thiểu 8 ký tự" },
                      { ok: strength.checks.special, t: "Chứa ký tự đặc biệt (@, #, $...)" },
                      { ok: strength.checks.upperLower, t: "Gồm chữ hoa & chữ thường" },
                      { ok: strength.checks.number, t: "Chứa ít nhất 1 chữ số" },
                    ].map((r, i) => (
                      <div key={i} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${r.ok ? "border-success/30 bg-success-container/10" : "border-outline-variant bg-surface-low"}`}>
                        <span className={`material-symbols-outlined text-[18px] ${r.ok ? "text-success" : "text-outline"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                          {r.ok ? "check_circle" : "radio_button_unchecked"}
                        </span>
                        <span className="text-sm">{r.t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hướng dẫn — Step 1, 2 */}
              {(step === 1 || step === 2) && (
                <div className="bg-white rounded-lg border border-outline-variant p-5">
                  <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-secondary">info</span>Hướng dẫn
                  </h3>
                  <div className="space-y-2.5 text-xs text-on-surface-variant">
                    {step === 1 && (
                      <>
                        <p className="flex items-start gap-2"><span className="material-symbols-outlined text-[14px] text-primary-container mt-0.5">looks_one</span>Nhập đúng Email hoặc SĐT bạn đã đăng ký với WMS.</p>
                        <p className="flex items-start gap-2"><span className="material-symbols-outlined text-[14px] text-primary-container mt-0.5">looks_two</span>Hệ thống gửi mã OTP 6 chữ số tới thiết bị của bạn.</p>
                        <p className="flex items-start gap-2"><span className="material-symbols-outlined text-[14px] text-primary-container mt-0.5">looks_3</span>Mã OTP có hiệu lực 5 phút. Tối đa 5 lượt nhập sai.</p>
                      </>
                    )}
                    {step === 2 && (
                      <>
                        <p className="flex items-start gap-2"><span className="material-symbols-outlined text-[14px] text-warning mt-0.5">warning</span>Mã OTP có hiệu lực <strong className="text-on-surface">5 phút</strong>.</p>
                        <p className="flex items-start gap-2"><span className="material-symbols-outlined text-[14px] text-warning mt-0.5">warning</span>Bạn có tối đa <strong className="text-on-surface">5 lượt</strong> nhập sai.</p>
                        <p className="flex items-start gap-2"><span className="material-symbols-outlined text-[14px] text-primary-container mt-0.5">help</span>Kiểm tra hộp thư Spam nếu không nhận được mã.</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Hỗ trợ */}
              <div className="bg-warning/10 rounded-lg border border-warning/30 p-5">
                <h4 className="text-sm font-semibold mb-2">Cần hỗ trợ?</h4>
                <p className="text-xs text-on-surface-variant mb-3">Nếu bạn không thể khôi phục tài khoản, hãy liên hệ đội IT.</p>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-secondary">mail</span>support@vinhgiang.vn</p>
                  <p className="text-xs font-medium flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-secondary">call</span>Hotline: 1900 6789 (Ext: 102)</p>
                </div>
              </div>

              {/* Quay lại */}
              {step !== 4 && (
                <button type="button" onClick={() => { if (step === 1) router.push("/auth"); else { setErrorMsg(""); setStep(step - 1); } }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-outline-variant text-sm font-medium rounded-lg text-on-surface-variant hover:bg-surface-low transition-colors">
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  {step === 1 ? "Quay lại trang Đăng nhập" : "Quay lại bước trước"}
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <footer className="text-center text-[10px] font-bold tracking-widest uppercase text-outline py-4" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            © 2026 VĨNH GIANG LOGISTICS SYSTEMS • PROPRIETARY TECHNOLOGY
          </footer>
        </div>
      </main>
    </div>
  );
}
