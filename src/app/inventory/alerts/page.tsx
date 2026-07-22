"use client";
import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import Link from "next/link";

type OldStockRow = {
  item_code_id: string;
  item_code: string;
  item_name: string;
  location_code: string;
  lot: string | null;
  manufactured_date: string | null;
  expiry_date: string;
  qty_box: number;
  days_later_than_oldest: number;
  days_in_stock: number | null;
};

type ExpiryRow = {
  id: string;
  item_code_id: string;
  item_code: string;
  item_name: string;
  lot: string | null;
  manufactured_date: string | null;
  expiry_date: string | null;
  days_until_expiry: number | null;
  qty_box: number;
  qty_unit: number;
  pallet_id: string;
  pallet_code: string;
  location_code: string | null;
  level: "urgent" | "warning" | "normal";
};

type AlertData = {
  expiry: { total: number };
  low_stock: { items: unknown[]; total: number };
  over_max: { items: unknown[]; total: number };
  old_stock_by_location: OldStockRow[];
  expiry_list: ExpiryRow[];
};

type Summary = {
  urgent_expiry: number;
  urgent_qty_unit: number;
  warning_expiry: number;
  warning_qty_unit: number;
  low_stock: number;
  over_max: number;
  old_stock_locations: number;
};

type MailConfig = {
  alert_type: string;
  label: string;
  frequency: string;        // DAILY_6AM | WEEKLY | MONTHLY
  recipients: string[];
  is_active: boolean;
};

// UC-INV-05-TC017: 5 loại cảnh báo (alert_type khớp model AlertSetting)
const ALERT_TYPE_DEFS: { alert_type: string; label: string }[] = [
  { alert_type: "HSD_7D", label: "HSD ≤ 7 ngày" },
  { alert_type: "HSD_30D", label: "HSD ≤ 30 ngày" },
  { alert_type: "STOCK_LOW", label: "Tồn dưới min" },
  { alert_type: "STOCK_OVER", label: "Tồn vượt max" },
  { alert_type: "OLD_STOCK", label: "Hàng tồn lâu (cận date xa nhất)" },
];
const FREQ_LABELS: Record<string, string> = { DAILY_6AM: "Hằng ngày 6:00", WEEKLY: "Thứ 2 hằng tuần", MONTHLY: "Đầu tháng" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fmtNum = (n: number) => n.toLocaleString("vi-VN");
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("vi-VN") : "—");

export default function AlertsPage() {
  const [data, setData] = useState<AlertData | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  // TC_INV04_004/005/006: lọc danh sách lô theo mức cảnh báo HSD
  const [expiryFilter, setExpiryFilter] = useState<"all" | "lt7" | "lt30" | "gt30">("all");

  // UC-INV-05-TC017: cấu hình nhận cảnh báo — load từ /api/inventory/alert-settings (model AlertSetting)
  const [mailConfigs, setMailConfigs] = useState<MailConfig[]>(
    ALERT_TYPE_DEFS.map((d) => ({ ...d, frequency: "DAILY_6AM", recipients: [], is_active: false }))
  );
  const [newEmail, setNewEmail] = useState<Record<string, string>>({});
  const [savingType, setSavingType] = useState<string | null>(null);
  const [mailMsg, setMailMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const showMailMsg = (type: "ok" | "err", text: string) => { setMailMsg({ type, text }); setTimeout(() => setMailMsg(null), 4000); };

  const addRecipient = (alert_type: string) => {
    const email = (newEmail[alert_type] || "").trim();
    if (!email) return;
    if (!EMAIL_RE.test(email)) { showMailMsg("err", `Email sai định dạng: ${email}`); return; }
    setMailConfigs((prev) => prev.map((c) => (c.alert_type === alert_type && !c.recipients.includes(email) ? { ...c, recipients: [...c.recipients, email] } : c)));
    setNewEmail((prev) => ({ ...prev, [alert_type]: "" }));
  };
  const removeRecipient = (alert_type: string, email: string) => {
    setMailConfigs((prev) => prev.map((c) => (c.alert_type === alert_type ? { ...c, recipients: c.recipients.filter((e) => e !== email) } : c)));
  };
  const toggleActive = (alert_type: string) => {
    setMailConfigs((prev) => prev.map((c) => (c.alert_type === alert_type ? { ...c, is_active: !c.is_active } : c)));
  };
  const saveConfig = async (c: MailConfig) => {
    if (c.is_active && c.recipients.length === 0) { showMailMsg("err", `"${c.label}" đang bật nhưng chưa có người nhận.`); return; }
    setSavingType(c.alert_type);
    try {
      const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const res = await fetch(`${bp}/api/inventory/alert-settings`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_type: c.alert_type, recipients: c.recipients, frequency: c.frequency, is_active: c.is_active }),
      });
      const j = await res.json();
      if (j.success) showMailMsg("ok", `Đã lưu cấu hình "${c.label}".`);
      else showMailMsg("err", j.error || "Lỗi lưu cấu hình.");
    } catch { showMailMsg("err", "Lỗi kết nối."); }
    finally { setSavingType(null); }
  };

  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    fetch(`${basePath}/api/inventory/alerts`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          setData(r.data);
          setSummary(r.summary);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    // UC-INV-05-TC017: nạp cấu hình người nhận đã lưu (AlertSetting)
    fetch(`${basePath}/api/inventory/alert-settings`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success && Array.isArray(r.data)) {
          setMailConfigs((prev) => prev.map((c) => {
            const found = r.data.find((s: { alert_type: string }) => s.alert_type === c.alert_type);
            return found ? { ...c, recipients: found.recipients || [], frequency: found.frequency || c.frequency, is_active: !!found.is_active } : c;
          }));
        }
      })
      .catch(console.error);
  }, []);

  // TC_INV04_004/005/006: lọc lô theo mức cảnh báo (số ngày còn lại đến HSD)
  const filteredExpiry = useMemo(() => {
    const list = data?.expiry_list ?? [];
    if (expiryFilter === "all") return list;
    return list.filter((r) => {
      const d = r.days_until_expiry;
      if (d === null || d === undefined) return false;
      if (expiryFilter === "lt7") return d < 7;
      if (expiryFilter === "lt30") return d < 30;
      if (expiryFilter === "gt30") return d > 30;
      return true;
    });
  }, [data, expiryFilter]);

  return (
    <AppLayout title="TRUNG TÂM CẢNH BÁO">
      <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
        <BackButton fallback="/inventory">Quay lại</BackButton>

        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[28px] text-rose-500">notifications_active</span>
          Trung tâm cảnh báo
        </h1>

        {/* 4 KPI Cards — 2x2 grid theo mockup */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* HẾT HẠN GẦN */}
          <div className="bg-rose-50 border border-rose-200 border-l-4 border-l-rose-500 rounded-xl p-4">
            <div className="flex items-baseline gap-2">
              <span className="material-symbols-outlined text-[18px] text-rose-600">circle</span>
              <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">HẾT HẠN GẦN</span>
              <span className="text-[10px] text-rose-600/70">— ≤ 7 ngày</span>
            </div>
            <p className="text-4xl font-bold text-rose-700 mt-2 data-mono">
              {summary?.urgent_expiry ?? "—"} <span className="text-base font-normal">lô</span>
            </p>
            <p className="text-xs text-rose-700/80 mt-1">
              SL: <strong>{summary ? fmtNum(summary.urgent_qty_unit) : "—"} đơn vị</strong>
            </p>
            <a href="#section-urgent" className="text-xs text-rose-700 font-semibold hover:underline mt-2 inline-block">
              Xem chi tiết →
            </a>
          </div>

          {/* CẬN HẠN */}
          <div className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-xl p-4">
            <div className="flex items-baseline gap-2">
              <span className="material-symbols-outlined text-[18px] text-amber-600">circle</span>
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">CẬN HẠN</span>
              <span className="text-[10px] text-amber-600/70">— ≤ 30 ngày</span>
            </div>
            <p className="text-4xl font-bold text-amber-700 mt-2 data-mono">
              {summary?.warning_expiry ?? "—"} <span className="text-base font-normal">lô</span>
            </p>
            <p className="text-xs text-amber-700/80 mt-1">
              SL: <strong>{summary ? fmtNum(summary.warning_qty_unit) : "—"} đơn vị</strong>
            </p>
            <a href="#section-warning" className="text-xs text-amber-700 font-semibold hover:underline mt-2 inline-block">
              Xem chi tiết →
            </a>
          </div>

          {/* TỒN DƯỚI MIN */}
          <div className="bg-yellow-50 border border-yellow-200 border-l-4 border-l-yellow-500 rounded-xl p-4">
            <div className="flex items-baseline gap-2">
              <span className="material-symbols-outlined text-[18px] text-yellow-700">trending_down</span>
              <span className="text-xs font-bold text-yellow-800 uppercase tracking-wider">TỒN DƯỚI MIN</span>
            </div>
            <p className="text-4xl font-bold text-yellow-800 mt-2 data-mono">
              {summary?.low_stock ?? "—"} <span className="text-base font-normal">SKU</span>
            </p>
            <p className="text-xs text-yellow-800/80 mt-1">Cần lập phiếu yêu cầu nhập</p>
            <Link href="/outbound/reorder" className="text-xs text-yellow-800 font-semibold hover:underline mt-2 inline-block">
              Tạo gợi ý nhập →
            </Link>
          </div>

          {/* TỒN VƯỢT MAX */}
          <div className="bg-orange-50 border border-orange-200 border-l-4 border-l-orange-500 rounded-xl p-4">
            <div className="flex items-baseline gap-2">
              <span className="material-symbols-outlined text-[18px] text-orange-700">trending_up</span>
              <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">TỒN VƯỢT MAX</span>
            </div>
            <p className="text-4xl font-bold text-orange-800 mt-2 data-mono">
              {summary?.over_max ?? "—"} <span className="text-base font-normal">SKU</span>
            </p>
            <p className="text-xs text-orange-800/80 mt-1">Có thể bán chậm</p>
            <a href="#section-overmax" className="text-xs text-orange-800 font-semibold hover:underline mt-2 inline-block">
              Xem chi tiết →
            </a>
          </div>
        </div>

        {/* HÀNG TỒN LÂU — highlight banner */}
        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="material-symbols-outlined text-cyan-700 text-[20px]">hourglass_bottom</span>
              <span className="text-sm font-bold text-cyan-900 uppercase tracking-wider">HÀNG TỒN LÂU</span>
              <span className="text-xs text-cyan-700">— Cận date xa nhất theo vị trí</span>
              <span className="px-1.5 py-0.5 bg-cyan-200 text-cyan-900 rounded-full text-[10px] font-bold">Mới</span>
            </div>
            <p className="text-3xl font-bold text-cyan-900 mt-1 data-mono">
              {summary?.old_stock_locations ?? "—"} <span className="text-base font-normal">vị trí</span>
            </p>
            <p className="text-xs text-cyan-800/80 mt-1 max-w-2xl">
              Các vị trí đang chứa lô hàng có Date xa nhất so với toàn kho cùng SKU — hàng tồn lâu, cần ưu tiên xuất.
            </p>
          </div>
          <a href="#section-old-stock" className="bg-cyan-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-cyan-700 flex items-center gap-1 whitespace-nowrap">
            <span className="material-symbols-outlined text-[16px]">analytics</span>
            Xem báo cáo →
          </a>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span>
          </div>
        ) : data ? (
          <>
            {/* TC_INV04_004/005/006: Danh sách lô cảnh báo HSD + bộ lọc theo mức */}
            <section id="section-urgent" className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">schedule</span>
                    Danh sách lô theo hạn sử dụng
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Lọc theo mức cảnh báo để xem nhanh các lô cần ưu tiên xử lý.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-on-surface-variant whitespace-nowrap">Mức cảnh báo:</span>
                  <select
                    value={expiryFilter}
                    onChange={(e) => setExpiryFilter(e.target.value as "all" | "lt7" | "lt30" | "gt30")}
                    className="px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white font-semibold min-w-[140px]"
                    aria-label="Lọc theo mức cảnh báo"
                  >
                    <option value="all">— Tất cả —</option>
                    <option value="lt7">&lt; 7 ngày</option>
                    <option value="lt30">&lt; 30 ngày</option>
                    <option value="gt30">&gt; 30 ngày</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                {filteredExpiry.length === 0 ? (
                  <p className="text-sm text-on-surface-variant text-center py-8">
                    Không có lô nào ở mức cảnh báo đã chọn.
                  </p>
                ) : (
                  <table className="w-full text-sm" style={{ minWidth: 880 }}>
                    <thead>
                      <tr className="bg-surface-low/50 border-b border-outline-variant text-[10px] uppercase tracking-wider text-on-surface-variant">
                        <th className="text-left px-4 py-2.5 font-semibold">Mã hàng</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Tên</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Lô</th>
                        <th className="text-left px-4 py-2.5 font-semibold">HSD</th>
                        <th className="text-right px-4 py-2.5 font-semibold">Còn lại</th>
                        <th className="text-right px-4 py-2.5 font-semibold">SL</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Vị trí</th>
                        <th className="text-center px-4 py-2.5 font-semibold">Mức</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpiry.map((r) => {
                        const d = r.days_until_expiry;
                        const badge =
                          r.level === "urgent"
                            ? "bg-rose-100 text-rose-700"
                            : r.level === "warning"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700";
                        const badgeLabel =
                          r.level === "urgent" ? "🔴 Khẩn" : r.level === "warning" ? "🟡 Cận" : "🟢 OK";
                        return (
                          <tr key={r.id} className="border-b border-outline-variant/40 hover:bg-surface-low/40">
                            <td className="px-4 py-2.5 font-mono font-bold text-primary text-xs">{r.item_code}</td>
                            <td className="px-4 py-2.5">{r.item_name}</td>
                            <td className="px-4 py-2.5 font-mono text-xs">{r.lot || "—"}</td>
                            <td className="px-4 py-2.5 text-xs font-semibold">{fmtDate(r.expiry_date)}</td>
                            <td className={`px-4 py-2.5 text-right font-bold text-xs ${d !== null && d < 7 ? "text-rose-600" : d !== null && d < 30 ? "text-amber-600" : "text-on-surface-variant"}`}>
                              {d !== null ? `${d} ngày` : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right data-mono">{fmtNum(r.qty_box)}</td>
                            <td className="px-4 py-2.5 text-xs">
                              {r.location_code ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold font-mono">
                                  {r.location_code}
                                </span>
                              ) : (
                                <span className="font-mono text-on-surface-variant">{r.pallet_code}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge}`}>{badgeLabel}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* Báo cáo hàng tồn lâu theo vị trí */}
            <section id="section-old-stock" className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-cyan-50/50 border-b border-outline-variant">
                <h3 className="text-sm font-bold text-cyan-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">analytics</span>
                  Báo cáo: Hàng cận date xa nhất theo vị trí
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Mỗi dòng = 1 vị trí có lô HSD <strong>xa nhất</strong> so với các lô khác cùng SKU trong kho.
                  Sắp xếp theo HSD giảm dần — lô có HSD muộn nhất ở trên cùng (cần ưu tiên đẩy hàng/giảm giá).
                </p>
              </div>
              <div className="overflow-x-auto">
                {data.old_stock_by_location.length === 0 ? (
                  <p className="text-sm text-on-surface-variant text-center py-8">
                    Không có vị trí nào tồn lâu — tốt!
                  </p>
                ) : (
                  <table className="w-full text-sm" style={{ minWidth: 900 }}>
                    <thead>
                      <tr className="bg-surface-low/50 border-b border-outline-variant text-[10px] uppercase tracking-wider text-on-surface-variant">
                        <th className="text-left px-4 py-2.5 font-semibold">Vị trí</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Mã hàng</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Tên</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Lô</th>
                        <th className="text-left px-4 py-2.5 font-semibold">NSX</th>
                        <th className="text-left px-4 py-2.5 font-semibold">HSD ↓</th>
                        <th className="text-right px-4 py-2.5 font-semibold">SL</th>
                        <th
                          className="text-right px-4 py-2.5 font-semibold"
                          title="Số ngày HSD vị trí này muộn hơn so với lô sớm nhất cùng SKU. Càng cao → càng tồn lâu nếu cứ xuất FEFO."
                        >
                          Tồn lâu hơn
                        </th>
                        <th className="text-center px-4 py-2.5 font-semibold">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.old_stock_by_location.map((r, i) => {
                        // "Đề xuất xuất" khi HSD muộn hơn lô sớm nhất ≥ 30 ngày
                        const daysLater = r.days_later_than_oldest;
                        const isOld = daysLater >= 30;
                        return (
                          <tr key={i} className="border-b border-outline-variant/40 hover:bg-cyan-50/30">
                            <td className="px-4 py-2.5 font-mono font-bold text-primary text-xs">{r.location_code}</td>
                            <td className="px-4 py-2.5 font-mono text-xs">{r.item_code}</td>
                            <td className="px-4 py-2.5">{r.item_name}</td>
                            <td className="px-4 py-2.5 font-mono text-xs">{r.lot || "—"}</td>
                            <td className="px-4 py-2.5 text-xs">{fmtDate(r.manufactured_date)}</td>
                            <td className="px-4 py-2.5 text-xs font-semibold">{fmtDate(r.expiry_date)}</td>
                            <td className="px-4 py-2.5 text-right data-mono">{fmtNum(r.qty_box)}</td>
                            <td className={`px-4 py-2.5 text-right font-bold ${isOld ? "text-rose-600" : "text-amber-600"}`}>
                              +{daysLater} ngày
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {isOld ? (
                                <Link href={`/inventory/by-lot?q=${encodeURIComponent(r.item_code)}`} className="inline-block px-2.5 py-1 bg-orange-500 text-white rounded text-xs font-semibold hover:bg-orange-600">
                                  Đề xuất xuất
                                </Link>
                              ) : (
                                <button className="px-2.5 py-1 border border-outline-variant rounded text-xs font-semibold text-on-surface-variant hover:bg-surface-low">
                                  Theo dõi
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        ) : null}

        {/* Cấu hình gửi mail tự động — theo mockup */}
        <section className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">mail</span>
              Cấu hình gửi mail tự động
            </h3>
            <Link href="/system/mail" className="text-xs text-primary hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">settings</span> Cấu hình SMTP →
            </Link>
          </div>
          {mailMsg && (
            <div className={`mb-2 px-3 py-2 rounded-lg text-xs font-semibold ${mailMsg.type === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>{mailMsg.text}</div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead>
                <tr className="bg-surface-low/50 border-b border-outline-variant text-[10px] uppercase text-on-surface-variant tracking-wider">
                  <th className="text-left px-4 py-2.5 font-semibold">Loại cảnh báo</th>
                  <th className="text-left px-4 py-2.5 font-semibold w-[160px]">Tần suất</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Người nhận</th>
                  <th className="text-center px-4 py-2.5 font-semibold w-[90px]">Bật</th>
                  <th className="text-center px-4 py-2.5 font-semibold w-[80px]">Lưu</th>
                </tr>
              </thead>
              <tbody>
                {mailConfigs.map((c) => (
                  <tr key={c.alert_type} className={`border-b border-outline-variant/40 align-top ${!c.is_active ? "opacity-70" : ""}`}>
                    <td className="px-4 py-3 font-semibold text-on-surface">{c.label}</td>
                    <td className="px-4 py-3">
                      <select value={c.frequency} onChange={(e) => setMailConfigs((prev) => prev.map((x) => x.alert_type === c.alert_type ? { ...x, frequency: e.target.value } : x))} className="px-2 py-1 text-xs border border-outline-variant rounded-lg bg-white">
                        {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {/* UC-INV-05-TC017: thêm/xóa email người nhận + validate */}
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {c.recipients.length === 0 && <span className="text-[11px] text-rose-500 italic">Chưa có người nhận</span>}
                        {c.recipients.map((em) => (
                          <span key={em} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-surface-low text-on-surface border border-outline-variant">
                            {em}
                            <button onClick={() => removeRecipient(c.alert_type, em)} className="material-symbols-outlined text-[14px] text-on-surface-variant hover:text-rose-600" title="Xóa">close</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <input
                          type="email"
                          value={newEmail[c.alert_type] || ""}
                          onChange={(e) => setNewEmail((prev) => ({ ...prev, [c.alert_type]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRecipient(c.alert_type); } }}
                          placeholder="them-email@vinhgiang.com"
                          className="flex-1 px-2 py-1 text-xs border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[140px]"
                        />
                        <button onClick={() => addRecipient(c.alert_type)} className="px-2 py-1 text-xs font-semibold border border-primary text-primary rounded-lg hover:bg-primary/5 whitespace-nowrap">Thêm</button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleActive(c.alert_type)} className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${c.is_active ? "bg-emerald-100 text-emerald-700" : "bg-surface-mid text-on-surface-variant"}`}>
                        {c.is_active ? "Đang bật" : "Tắt"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => saveConfig(c)} disabled={savingType === c.alert_type} className="px-3 py-1 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/95 disabled:opacity-50">
                        {savingType === c.alert_type ? "..." : "Lưu"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
