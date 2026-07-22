"use client";
import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";

type Provider = "smtp" | "mailgun" | "sendgrid" | "brevo";

interface MailForm {
  mail_provider: Provider;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  smtp_secure: string;
  smtp_from: string;
  smtp_from_name: string;
  smtp_reply_to: string;
  mailgun_api_key: string;
  mailgun_domain: string;
  mailgun_region: string;
  sendgrid_api_key: string;
  brevo_api_key: string;
}

const EMPTY: MailForm = {
  mail_provider: "smtp",
  smtp_host: "",
  smtp_port: "587",
  smtp_user: "",
  smtp_password: "",
  smtp_secure: "TLS",
  smtp_from: "",
  smtp_from_name: "",
  smtp_reply_to: "",
  mailgun_api_key: "",
  mailgun_domain: "",
  mailgun_region: "us",
  sendgrid_api_key: "",
  brevo_api_key: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function MailConfigPage() {
  const [form, setForm] = useState<MailForm>(EMPTY);
  const [savedForm, setSavedForm] = useState<MailForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetch("/wms/api/system/mail")
      .then((r) => r.json())
      .then((r) => {
        if (r.success && r.data) {
          const mapped = { ...r.data };
          if (mapped.smtp_secure === "true") mapped.smtp_secure = "SSL";
          else if (mapped.smtp_secure === "false") mapped.smtp_secure = "TLS";
          else if (!mapped.smtp_secure) mapped.smtp_secure = "TLS";
          setForm((prev) => ({ ...prev, ...mapped }));
          setSavedForm((prev) => ({ ...prev, ...mapped }));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const set = <K extends keyof MailForm>(key: K, value: MailForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    // UC_SYS_02_TC17/18/21/22: các trường SMTP là bắt buộc
    if (form.mail_provider === "smtp") {
      if (!form.smtp_host.trim()) { showToast("SMTP Host là bắt buộc.", "error"); return; }
      if (!form.smtp_port.trim()) { showToast("Port là bắt buộc.", "error"); return; }
      // UC_SYS_02_TC19/20: Port phải là số nguyên 1..65535
      const portNum = Number(form.smtp_port);
      if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        showToast("Port phải là số nguyên từ 1 đến 65535.", "error");
        return;
      }
      if (!form.smtp_user.trim()) { showToast("Username là bắt buộc.", "error"); return; }
      if (!form.smtp_password.trim()) { showToast("Password là bắt buộc.", "error"); return; }
    }
    // UC_SYS_02_TC23: định dạng email người gửi
    if (form.smtp_from.trim() && !EMAIL_RE.test(form.smtp_from.trim())) {
      showToast("Địa chỉ email gửi không đúng định dạng.", "error");
      return;
    }
    // UC_SYS_02_TC24: định dạng email nhận phản hồi
    if (form.smtp_reply_to.trim() && !EMAIL_RE.test(form.smtp_reply_to.trim())) {
      showToast("Địa chỉ email nhận phản hồi không đúng định dạng.", "error");
      return;
    }
    // UC_SYS_02_TC33/34: trim khoảng trắng đầu/cuối trước khi lưu
    const payload: MailForm = {
      ...form,
      smtp_host: form.smtp_host.trim(),
      smtp_from: form.smtp_from.trim(),
      smtp_from_name: form.smtp_from_name.trim(),
      smtp_reply_to: form.smtp_reply_to.trim(),
      smtp_user: form.smtp_user.trim(),
    };
    setSaving(true);
    try {
      const res = await fetch("/wms/api/system/mail", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // UC_SYS_02_TC29: session hết hạn -> chuyển về đăng nhập
      if (res.status === 401) { window.location.href = "/wms/auth"; return; }
      const result = await res.json();
      if (result.success) {
        setForm(payload);
        setSavedForm(payload);
        showToast("Đã lưu cấu hình.", "success");
      } else showToast(result.error, "error");
    } catch {
      showToast("Lỗi kết nối.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/wms/api/system/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
      if (res.status === 401) { window.location.href = "/wms/auth"; return; }
      const result = await res.json();
      if (result.success) showToast(result.message, "success");
      else showToast(result.error, "error");
    } catch {
      showToast("Lỗi.", "error");
    } finally {
      setVerifying(false);
    }
  };

  const handleSendTest = async () => {
    if (!testTo.trim()) {
      showToast("Nhập email nhận test.", "error");
      return;
    }
    // UC_SYS_02_TC25: kiểm tra định dạng email trước khi gửi
    if (!EMAIL_RE.test(testTo.trim())) {
      showToast("Email nhận test không đúng định dạng.", "error");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/wms/api/system/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", to: testTo.trim() }),
      });
      if (res.status === 401) { window.location.href = "/wms/auth"; return; }
      const result = await res.json();
      if (result.success) showToast(result.message, "success");
      else showToast(result.error, "error");
    } catch {
      showToast("Lỗi.", "error");
    } finally {
      setSending(false);
    }
  };

  const provider = form.mail_provider;

  return (
    <AppLayout title="CẤU HÌNH MAIL">
      <div className="p-6 max-w-2xl space-y-5">
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 max-w-md ${
              toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[18px] flex-shrink-0">
              {toast.type === "success" ? "check_circle" : "error"}
            </span>
            <span className="break-all">{toast.message}</span>
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-[28px]">mail</span> Cấu hình Email
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Hỗ trợ SMTP (nodemailer), Mailgun API, và SendGrid API.
          </p>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <span className="material-symbols-outlined animate-spin text-[24px] text-primary">
              progress_activity
            </span>
          </div>
        ) : (
          <>
            {/* Provider selector */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-6">
              <label className="text-xs font-bold text-on-surface-variant uppercase block mb-2">
                Provider
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { value: "brevo", label: "Brevo", desc: "HTTPS API (free)" },
                    { value: "sendgrid", label: "SendGrid", desc: "HTTPS API" },
                    { value: "mailgun", label: "Mailgun", desc: "HTTPS API" },
                    { value: "smtp", label: "SMTP", desc: "Gmail / Postfix / SES" },
                  ] as { value: Provider; label: string; desc: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => set("mail_provider", opt.value)}
                    className={`p-3 border-2 rounded-lg text-center transition-colors ${
                      provider === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-outline-variant hover:border-primary/30"
                    }`}
                  >
                    <div className="font-semibold text-sm">{opt.label}</div>
                    <div className="text-[11px] text-on-surface-variant mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Common: from address */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">person</span>
                Địa chỉ gửi (chung cho mọi provider)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Từ địa chỉ"
                  value={form.smtp_from}
                  onChange={(v) => set("smtp_from", v)}
                  placeholder="noreply@vinhgiang.com"
                  type="email"
                />
                <Field
                  label="Tên hiển thị (From Name)"
                  value={form.smtp_from_name}
                  onChange={(v) => set("smtp_from_name", v)}
                  placeholder="WMS Vĩnh Giang"
                />
              </div>
              <Field
                label="Email nhận phản hồi (Reply-to Email)"
                value={form.smtp_reply_to}
                onChange={(v) => set("smtp_reply_to", v)}
                placeholder="support@vinhgiang.com"
                type="email"
              />
            </div>

            {/* Provider-specific */}
            {provider === "smtp" && (
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-6 space-y-4">
                <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">dns</span>
                  SMTP Server
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label="Host"
                    value={form.smtp_host}
                    onChange={(v) => set("smtp_host", v)}
                    placeholder="smtp.gmail.com"
                  />
                  <Field
                    label="Port"
                    value={form.smtp_port}
                    onChange={(v) => set("smtp_port", v)}
                    placeholder="587"
                    type="number"
                  />
                  <div>
                    <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">
                      Bảo mật
                    </label>
                    <select
                      value={form.smtp_secure}
                      onChange={(e) => set("smtp_secure", e.target.value)}
                      className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="TLS">TLS</option>
                      <option value="SSL">SSL</option>
                      <option value="NONE">None</option>
                    </select>
                  </div>
                  <Field
                    label="User"
                    value={form.smtp_user}
                    onChange={(v) => set("smtp_user", v)}
                    placeholder="email@domain.com"
                  />
                  <Field
                    label="Mật khẩu"
                    value={form.smtp_password}
                    onChange={(v) => set("smtp_password", v)}
                    placeholder="••••••"
                    type="password"
                  />
                </div>
              </div>
            )}

            {provider === "mailgun" && (
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-6 space-y-4">
                <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">key</span>
                  Mailgun API
                </h3>
                <Field
                  label="API Key"
                  value={form.mailgun_api_key}
                  onChange={(v) => set("mailgun_api_key", v)}
                  placeholder="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  type="password"
                />
                <Field
                  label="Domain"
                  value={form.mailgun_domain}
                  onChange={(v) => set("mailgun_domain", v)}
                  placeholder="mg.vinhgiang.com"
                />
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">
                    Region
                  </label>
                  <select
                    value={form.mailgun_region}
                    onChange={(e) => set("mailgun_region", e.target.value)}
                    className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm"
                  >
                    <option value="us">US (api.mailgun.net)</option>
                    <option value="eu">EU (api.eu.mailgun.net)</option>
                  </select>
                </div>
                <p className="text-[11px] text-on-surface-variant italic">
                  Lấy API key tại Mailgun Dashboard → Settings → API Keys.
                </p>
              </div>
            )}

            {provider === "sendgrid" && (
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-6 space-y-4">
                <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">key</span>
                  SendGrid API
                </h3>
                <Field
                  label="API Key"
                  value={form.sendgrid_api_key}
                  onChange={(v) => set("sendgrid_api_key", v)}
                  placeholder="SG.xxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  type="password"
                />
                <p className="text-[11px] text-on-surface-variant italic">
                  Lấy API key tại app.sendgrid.com → Settings → API Keys. Cần quyền `Mail Send`.
                </p>
              </div>
            )}

            {provider === "brevo" && (
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-6 space-y-4">
                <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">key</span>
                  Brevo API
                </h3>
                <Field
                  label="API Key"
                  value={form.brevo_api_key}
                  onChange={(v) => set("brevo_api_key", v)}
                  placeholder="xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  type="password"
                />
                <p className="text-[11px] text-on-surface-variant italic">
                  Lấy API key tại app.brevo.com → SMTP &amp; API → API Keys. Gửi qua HTTPS (port 443) —
                  hợp với VPS chặn SMTP. Cần xác thực email người gửi ở mục Senders &amp; IP.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-5 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {saving ? "progress_activity" : "save"}
                  </span>
                  Lưu cấu hình
                </button>
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="px-5 py-3 bg-primary-hover text-white rounded-lg text-sm font-semibold hover:bg-primary disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {verifying ? "progress_activity" : "verified"}
                  </span>
                  Verify
                </button>
                <button
                  onClick={() => setForm(savedForm)}
                  disabled={saving}
                  className="px-5 py-3 border border-outline-variant text-on-surface rounded-lg text-sm font-semibold hover:bg-surface-variant disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                  Hủy
                </button>
              </div>

              <div className="pt-4 border-t border-outline-variant">
                <label className="text-xs font-bold text-on-surface-variant uppercase block mb-1.5">
                  Gửi mail test đến
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder="your-email@gmail.com"
                    className="flex-1 px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <button
                    onClick={handleSendTest}
                    disabled={sending || !testTo.trim()}
                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {sending ? "progress_activity" : "send"}
                    </span>
                    Gửi test
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  const isSaved = value === "********";
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-bold text-on-surface-variant uppercase block">{label}</label>
        {isSaved && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[12px]">check_circle</span>
            Đã lưu cấu hình
          </span>
        )}
      </div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
    </div>
  );
}
