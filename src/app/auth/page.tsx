"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { useSystemConfig } from "@/lib/use-system-config";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [redirectMsg, setRedirectMsg] = useState("");
  const router = useRouter();
  // UC_SYS_01_TC13: logo màn đăng nhập đọc từ cấu hình (logo_url) thay vì cố định /logo.png.
  const { config } = useSystemConfig();

  useEffect(() => {
    // TC_T01_020: Tự động điền tài khoản nếu đã nhớ
    const savedUser = localStorage.getItem("remembered_username");
    if (savedUser) {
      const usernameInput = document.getElementById("username") as HTMLInputElement;
      if (usernameInput) usernameInput.value = savedUser;
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    if (!username || !password) {
      setErrorMsg("Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    setIsLoading(true);

    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const res = await fetch(`${basePath}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Sprint A · A1-002: gửi `remember_me` để backend cấp token thời hạn dài (30d) thay vì 7d mặc định.
        body: JSON.stringify({ identifier: username, password, remember_me: rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Đăng nhập thất bại.");
        setIsLoading(false);
        return;
      }

      // Đăng nhập thành công
      setIsSuccess(true);
      auth.saveToken(data.token);
      auth.saveUser(data.user);

      if (rememberMe) {
        localStorage.setItem("remembered_username", username);
      } else {
        localStorage.removeItem("remembered_username");
      }

      // === ROLE-BASED REDIRECT ===
      const role = data.user.role;

      // Bảng chuyển hướng theo vai trò (cross-app)
      const ROLE_REDIRECTS: Record<string, { url: string; label: string }> = {
        XE_NANG: { url: "/xenang/forklift", label: "Xe nâng" },
        THU_KHO: { url: "/thukho", label: "Thủ kho" },
        KIEM_KE: { url: "/kiemke", label: "Kiểm kê" },
      };

      // Bảng label cho Desktop roles (WVG-16: legacy ADMIN/MANAGER/STAFF đã di trú QUAN_LY).
      const DESKTOP_LABELS: Record<string, string> = {
        QUAN_LY: "Quản lý kho",
        KE_TOAN: "Kế toán kho",
      };

      // Đang ở /wms → phân biệt theo role → redirect NGAY
      const mobileTarget = ROLE_REDIRECTS[role];
      if (mobileTarget && basePath !== "/xenang" && basePath !== "/thukho" && basePath !== "/kiemke") {
        // Cross-app redirect: dùng window.location NGAY — không delay
        setRedirectMsg(`Đang chuyển đến giao diện ${mobileTarget.label}...`);
        window.location.href = mobileTarget.url;
        return; // QUAN TRỌNG: không cho code chạy tiếp
      }

      setTimeout(() => {
        // Nếu đang ở app standalone mobile → giữ nguyên behavior
        if (basePath === "/xenang") {
          router.push("/forklift");
          return;
        }
        if (basePath === "/thukho" || basePath === "/kiemke") {
          router.push("/");
          return;
        }

        // Desktop users (ADMIN, KE_TOAN, QUAN_LY, etc.)
        setRedirectMsg(`Đang chuyển đến ${DESKTOP_LABELS[role] || "Dashboard"}...`);
        router.push("/");
      }, 500);
    } catch (error) {
      console.error(error);
      setErrorMsg("Lỗi kết nối mạng. Vui lòng kiểm tra lại.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center warehouse-bg p-margin-mobile">
      <div className="w-full max-w-[440px] bg-white rounded-xl border border-outline-variant shadow-[0_8px_32px_rgba(2,36,72,0.1)] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Brand Header Area */}
        <div className="px-xl pt-xl pb-lg text-center border-b border-surface-variant bg-surface-bright">
          <div className="flex flex-col items-center gap-xs">
            <div className="w-24 h-24 bg-transparent flex items-center justify-center mb-sm">
              <img
                src={config.logo_url || `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logo.png`}
                alt="Vĩnh Giang Logo"
                className="w-24 h-24 object-contain"
              />
            </div>
            <p className="label-caps" style={{ color: "rgb(0, 30, 113)" }}>
              Warehouse Management System
            </p>
          </div>
        </div>

        <div className="p-xl space-y-lg">
          <form className="space-y-md" onSubmit={handleLogin}>
            {/* Username Field */}
            <div className="space-y-xs">
              <label
                className="label-caps text-on-surface-variant flex justify-between"
                htmlFor="username"
              >
                TÊN ĐĂNG NHẬP
                <span className="text-error">*</span>
              </label>
              <div className="relative scanner-focus transition-all duration-200 border border-outline rounded-lg bg-white overflow-hidden">
                <div className="absolute inset-y-0 left-0 pl-md flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                    person
                  </span>
                </div>
                <input
                  className="block w-full pl-[44px] pr-xl py-[14px] bg-transparent border-none focus:ring-0 text-body-md text-on-surface placeholder:text-outline"
                  id="username"
                  name="username"
                  placeholder="Nhập tên đăng nhập hoặc mã NV"
                  type="text"
                  maxLength={50}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-xs">
              <label
                className="label-caps text-on-surface-variant flex justify-between"
                htmlFor="password"
              >
                MẬT KHẨU
                <span className="text-error">*</span>
              </label>
              <div className="relative scanner-focus transition-all duration-200 border border-outline rounded-lg bg-white overflow-hidden">
                <div className="absolute inset-y-0 left-0 pl-md flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                    lock
                  </span>
                </div>
                <input
                  className="block w-full pl-[44px] pr-[44px] py-[14px] bg-transparent border-none focus:ring-0 text-body-md text-on-surface placeholder:text-outline"
                  id="password"
                  name="password"
                  placeholder="Nhập mật khẩu truy cập"
                  type={showPassword ? "text" : "password"}
                  maxLength={20}
                  onKeyDown={(e) => {
                    if (e.key === " " && e.currentTarget.value.length === 0) {
                      e.preventDefault();
                    }
                  }}
                />
                <button
                  className="absolute inset-y-0 right-0 pr-md flex items-center"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-on-surface-variant hover:text-primary-container transition-colors">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="text-error text-body-sm font-medium bg-error-container/20 p-2 rounded-md">
                {errorMsg}
              </div>
            )}

            {/* Utilities Row */}
            <div className="flex items-center justify-between pt-xs">
              <label className="flex items-center gap-sm cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    className="peer h-5 w-5 rounded border-outline text-primary-container focus:ring-primary-container/20 transition-all"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                </div>
                <span className="text-body-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
                  Ghi nhớ đăng nhập
                </span>
              </label>
              <Link
                className="text-body-sm text-secondary font-semibold hover:underline underline-offset-4"
                href="/auth/forgot-password"
              >
                Quên mật khẩu?
              </Link>
            </div>

            {/* Login Button */}
            <button
              className="w-full h-[52px] bg-primary-container text-white text-headline-sm rounded-xl flex items-center justify-center gap-sm hover:bg-primary transition-all active:scale-[0.98] shadow-sm relative overflow-hidden group disabled:opacity-80"
              disabled={isLoading || isSuccess}
              type="submit"
            >
              <span className={isLoading || isSuccess ? "opacity-0" : ""}>
                Đăng nhập
              </span>
              <span
                className={`material-symbols-outlined group-hover:translate-x-1 transition-transform ${
                  isLoading || isSuccess ? "opacity-0" : ""
                }`}
              >
                arrow_forward
              </span>

              {/* Loading/Success state */}
              {(isLoading || isSuccess) && (
                <div className="absolute inset-0 bg-primary-container flex items-center justify-center">
                  {isSuccess ? (
                    <span
                      className="material-symbols-outlined text-white animate-bounce"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                  ) : (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  )}
                </div>
              )}
            </button>

            {/* Redirect feedback message */}
            {isSuccess && redirectMsg && (
              <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium animate-pulse">
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                {redirectMsg}
              </div>
            )}
          </form>


        </div>
      </div>
    </div>
  );
}
