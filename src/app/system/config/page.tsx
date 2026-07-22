"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { refreshSystemConfig } from "@/lib/use-system-config";

type ConfigItem = { id: string; key: string; value: string; label: string | null };
const DEFAULT_CONFIGS = [
  { key: "company_name", label: "Tên công ty", default: "Vinh Giang" },
  { key: "app_name", label: "Tên ứng dụng", default: "WMS Vĩnh Giang" },
  { key: "app_short_name", label: "Tên rút gọn", default: "WMS" },
  { key: "hotline", label: "Hotline hỗ trợ", default: "0900 000 000" },
  { key: "support_email", label: "Email hỗ trợ", default: "support@vinhgiang.com" },
  { key: "footer_text", label: "Footer (chân trang)", default: "© 2026 Vĩnh Giang · WMS v3.0" },
  { key: "hsd_warning_7d", label: "Cảnh báo HSD ≤ N ngày (khẩn)", default: "7" },
  { key: "hsd_warning_30d", label: "Cảnh báo HSD ≤ N ngày (cận)", default: "30" },
  { key: "default_min_stock", label: "Tồn tối thiểu mặc định", default: "10" },
  { key: "timezone", label: "Múi giờ", default: "Asia/Ho_Chi_Minh" },
  { key: "date_format", label: "Định dạng ngày", default: "dd/MM/yyyy" },
];

const TIMEZONES = [
  { value: "Asia/Ho_Chi_Minh", label: "Asia/Ho_Chi_Minh (GMT+7)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (GMT+8)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (GMT+9)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
];

const DATE_FORMATS = [
  { value: "dd/MM/yyyy", label: "Ngày/Tháng/Năm (dd/MM/yyyy)" },
  { value: "MM/dd/yyyy", label: "Tháng/Ngày/Năm (MM/dd/yyyy)" },
  { value: "yyyy-MM-dd", label: "Năm-Tháng-Ngày (yyyy-MM-dd)" },
];

const MAX_LOGO_MB = 2;

// UUID constants cho upload logo/favicon (vì DB column entity_id là @db.Uuid)
const SYSTEM_LOGO_UUID = "00000000-0000-0000-0000-000000000001";
const SYSTEM_FAVICON_UUID = "00000000-0000-0000-0000-000000000002";

export default function SystemConfigPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const router = useRouter();
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [logoUploading, setLogoUploading] = useState<"logo" | "favicon" | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const fetchConfigs = () => {
    fetch(`${basePath}/api/system/config`)
      .then(r => r.json())
      .then(r => { if (r.success) setConfigs(r.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(fetchConfigs, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editKey !== null) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editKey]);

  const getValue = (key: string) => configs.find(c => c.key === key)?.value || DEFAULT_CONFIGS.find(d => d.key === key)?.default || "";

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (key: string, label: string) => {
    const value = editValue.trim(); // UC_SYS_01_TC31/32: tự trim khoảng trắng đầu/cuối
    // UC_SYS_01_TC17/29/31: Tên ứng dụng bắt buộc + giới hạn độ dài
    if (key === "app_name") {
      if (!value) { showToast("Tên ứng dụng là bắt buộc", "error"); return; }
      if (value.length > 100) { showToast("Tên ứng dụng không được vượt quá 100 ký tự", "error"); return; }
    }
    // UC_SYS_01_TC18/19: Hotline chỉ gồm số và + - . ( ) dấu cách, tối đa 20 ký tự
    if (key === "hotline" && value) {
      if (!/^[0-9\s+\-.()]+$/.test(value)) { showToast("Hotline không hợp lệ (chỉ gồm số và + - . ( ) dấu cách)", "error"); return; }
      if (value.length > 20) { showToast("Hotline không được vượt quá 20 ký tự", "error"); return; }
    }
    // UC_SYS_01_TC20: Email hỗ trợ đúng định dạng
    if (key === "support_email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      showToast("Email hỗ trợ không đúng định dạng", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${basePath}/api/system/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, label }),
      });
      // UC_SYS_01_TC26: session hết hạn -> chuyển về đăng nhập
      if (res.status === 401) { router.push("/auth"); return; }
      const result = await res.json();
      if (result.success) {
        showToast("Đã lưu!");
        setEditKey(null);
        fetchConfigs();
        refreshSystemConfig(); // header/sidebar reload
      } else {
        showToast(result.error, "error");
      }
    } catch {
      showToast("Lỗi.", "error");
    } finally {
      setSaving(false);
    }
  };

  // UC-SYS-01: upload logo / favicon thật qua /api/attachments + set vào /api/system/config
  const handleLogoUpload = async (kind: "logo" | "favicon", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;

    if (file.size > MAX_LOGO_MB * 1024 * 1024) {
      showToast(`File quá ${MAX_LOGO_MB}MB`, "error");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"].includes(file.type)) {
      showToast("Chỉ nhận PNG/JPEG/WebP/ICO", "error");
      return;
    }

    setLogoUploading(kind);
    try {
      const entityId = kind === "logo" ? SYSTEM_LOGO_UUID : SYSTEM_FAVICON_UUID;

      // 0) Xóa các attachment cũ cùng entity (tránh đụng limit 10 file)
      try {
        const oldRes = await fetch(`${basePath}/api/attachments?entity_type=SYSTEM_CONFIG&entity_id=${entityId}`);
        const oldJson = await oldRes.json();
        if (oldJson.success && Array.isArray(oldJson.data)) {
          await Promise.all(
            oldJson.data.map((a: { id: string }) =>
              fetch(`${basePath}/api/attachments/${a.id}`, { method: "DELETE" })
            )
          );
        }
      } catch {
        // ignore — vẫn tiếp tục upload mới
      }

      // 1) Upload file qua /api/attachments
      // entity_id phải là UUID format theo schema → dùng UUID nil sentinel
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity_type", "SYSTEM_CONFIG");
      fd.append("entity_id", entityId);
      const upRes = await fetch(`${basePath}/api/attachments`, { method: "POST", body: fd });
      const upJson = await upRes.json();
      if (!upJson.success) {
        showToast(upJson.error || "Upload thất bại", "error");
        return;
      }

      // 2) Set vào system_config
      const cfgKey = kind === "logo" ? "logo_url" : "favicon_url";
      const cfgLabel = kind === "logo" ? "Logo" : "Favicon";
      const fullUrl = `${basePath}${upJson.data.file_url}`;
      const putRes = await fetch(`${basePath}/api/system/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: cfgKey, value: fullUrl, label: cfgLabel }),
      });
      const putJson = await putRes.json();
      if (!putJson.success) {
        showToast(putJson.error || "Lưu cấu hình thất bại", "error");
        return;
      }
      showToast(`Đã cập nhật ${cfgLabel}`);
      fetchConfigs();
      refreshSystemConfig();
    } catch (err) {
      console.error(err);
      showToast("Lỗi mạng", "error");
    } finally {
      setLogoUploading(null);
    }
  };

  const logoUrl = getValue("logo_url");
  const faviconUrl = getValue("favicon_url");

  return (
    <AppLayout title="CẤU HÌNH">
      <div className="p-6 max-w-3xl space-y-5">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
            <span className="material-symbols-outlined text-[18px]">{toast.type === "success" ? "check_circle" : "error"}</span>
            {toast.message}
          </div>
        )}

        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[28px]">settings</span> Cấu hình hệ thống
        </h1>

        {/* UC-SYS-01: Logo + Favicon upload section */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-5">
          <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">image</span> Thương hiệu
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Logo */}
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-2">Logo (PNG/SVG/WebP — tối đa {MAX_LOGO_MB}MB)</label>
              <div className="border-2 border-dashed border-outline-variant rounded-lg p-5 text-center bg-surface-low">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Logo" className="w-20 h-20 mx-auto object-contain bg-white rounded-lg p-1 shadow-sm" />
                ) : (
                  <div className="w-20 h-20 mx-auto bg-primary rounded-xl flex items-center justify-center text-white text-3xl font-bold">VG</div>
                )}
                <p className="mt-2 text-xs text-on-surface-variant truncate">
                  {logoUrl ? logoUrl.split("/").pop() : "Chưa có logo"}
                </p>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading === "logo"}
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">{logoUploading === "logo" ? "progress_activity" : "upload"}</span>
                  {logoUploading === "logo" ? "Đang tải..." : "Đổi logo"}
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => handleLogoUpload("logo", e)}
                />
              </div>
            </div>

            {/* Favicon */}
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-2">Favicon (ICO/PNG nhỏ)</label>
              <div className="border-2 border-dashed border-outline-variant rounded-lg p-5 text-center bg-surface-low">
                {faviconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={faviconUrl} alt="Favicon" className="w-12 h-12 mx-auto object-contain bg-white rounded p-0.5 shadow-sm" />
                ) : (
                  <div className="w-12 h-12 mx-auto bg-primary rounded flex items-center justify-center text-white text-lg font-bold">VG</div>
                )}
                <p className="mt-2 text-xs text-on-surface-variant truncate">
                  {faviconUrl ? faviconUrl.split("/").pop() : "Chưa có favicon"}
                </p>
                <button
                  type="button"
                  onClick={() => faviconInputRef.current?.click()}
                  disabled={logoUploading === "favicon"}
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">{logoUploading === "favicon" ? "progress_activity" : "upload"}</span>
                  {logoUploading === "favicon" ? "Đang tải..." : "Đổi favicon"}
                </button>
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/png,image/x-icon,image/vnd.microsoft.icon"
                  className="hidden"
                  onChange={(e) => handleLogoUpload("favicon", e)}
                />
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">info</span>
            Logo sẽ hiện ở sidebar và màn hình đăng nhập. Sau khi upload, các trang khác sẽ tự cập nhật trong vòng 30s.
          </p>
        </div>

        {/* Các key text khác */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm divide-y divide-outline-variant">
          {loading ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span>
            </div>
          ) : (
            DEFAULT_CONFIGS.map(dc => {
              const isEditing = editKey === dc.key;
              const currentValue = getValue(dc.key);
              return (
                <div key={dc.key} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{dc.label}</p>
                    <p className="text-[10px] text-on-surface-variant/70 font-mono">{dc.key}</p>
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      {dc.key === "timezone" ? (
                        <div className="flex items-center gap-1">
                          <select value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus className="px-3 py-1.5 border border-primary rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
                            {TIMEZONES.map(tz => (
                              <option key={tz.value} value={tz.value}>{tz.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                                if (systemTz) setEditValue(systemTz);
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="p-1.5 bg-surface-mid rounded border border-outline-variant hover:bg-primary/10 flex items-center justify-center"
                            title="Tự động phát hiện"
                          >
                            <span className="material-symbols-outlined text-[16px] text-primary">my_location</span>
                          </button>
                        </div>
                      ) : dc.key === "date_format" ? (
                        <select value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus className="px-3 py-1.5 border border-primary rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
                          {DATE_FORMATS.map(df => (
                            <option key={df.value} value={df.value}>{df.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus className="px-3 py-1.5 border border-primary rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      )}
                      <button onClick={() => handleSave(dc.key, dc.label || "")} disabled={saving} className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold">Lưu</button>
                      <button onClick={() => setEditKey(null)} className="px-3 py-1.5 bg-surface-mid rounded-lg text-xs">Hủy</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-primary">{currentValue}</span>
                      <button onClick={() => { setEditKey(dc.key); setEditValue(currentValue); }} className="p-1 rounded hover:bg-primary/10">
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">edit</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
