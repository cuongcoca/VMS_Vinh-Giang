"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";

// WVG-16 / Pha 4 — UI cấu hình ma trận quyền API (server RBAC).
const ROLE_LABELS: Record<string, string> = {
  QUAN_LY: "Quản lý", KE_TOAN: "Kế toán", THU_KHO: "Thủ kho", XE_NANG: "Xe nâng", KIEM_KE: "Kiểm kê",
};
const RESOURCE_LABELS: Record<string, string> = {
  pallet: "Pallet", item_code: "Mã hàng", supplier: "Nhà cung cấp", product_group: "Nhóm hàng",
  unit: "Đơn vị tính", location: "Vị trí kho", inbound: "Phiếu nhập", outbound: "Xuất kho",
  inventory: "Tồn kho", movement: "Luân chuyển", stock_count: "Kiểm kê", forklift: "Xe nâng",
  dashboard: "Bảng điều khiển", notification: "Thông báo", attachment: "Tệp đính kèm",
  scan: "Quét mã", user: "Người dùng", system: "Hệ thống", audit: "Nhật ký audit",
};
const LEVEL_LABELS: Record<string, string> = { none: "Không", read: "Đọc", full: "Đầy đủ", special: "Đặc biệt" };
const LEVEL_COLORS: Record<string, string> = {
  none: "bg-zinc-100 text-zinc-500", read: "bg-sky-50 text-sky-700",
  full: "bg-emerald-50 text-emerald-700", special: "bg-amber-50 text-amber-700",
};

type MatrixData = {
  roles: string[]; resources: string[]; levels: string[];
  matrix: Record<string, Record<string, string>>;
  defaults: Record<string, Record<string, string>>;
};

const clone = (m: Record<string, Record<string, string>>) => JSON.parse(JSON.stringify(m));

export default function PermissionsPage() {
  const [data, setData] = useState<MatrixData | null>(null);
  const [matrix, setMatrix] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false); // WVG-35: trạng thái 403 rõ ràng
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    apiFetch("/wms/api/system/permissions")
      .then(async (r) => {
        // WVG-35 / UC-AUTH-05: 401/403 → không có quyền (guard tại page, không chỉ ẩn menu).
        if (r.status === 401 || r.status === 403) { setDenied(true); return null; }
        return r.json();
      })
      .then((r) => {
        if (!r) return;
        if (r.success) { setData(r.data); setMatrix(clone(r.data.matrix)); }
        else setAlert({ type: "error", message: r.error || "Không tải được ma trận." });
      })
      .catch(() => setAlert({ type: "error", message: "Lỗi tải ma trận quyền." }))
      .finally(() => setLoading(false));
  }, []);

  const levelAt = (role: string, res: string) => matrix[role]?.[res] ?? "none";
  const setLevel = (role: string, res: string, lvl: string) =>
    setMatrix((prev) => ({ ...prev, [role]: { ...(prev[role] || {}), [res]: lvl } }));
  const resetDefaults = () => { if (data) setMatrix(clone(data.defaults)); };

  // WVG-35: đếm số ô đổi so với bản đã lưu (data.matrix) để confirm trước khi lưu.
  function countChanges(): number {
    if (!data) return 0;
    let n = 0;
    for (const role of data.roles) {
      for (const res of data.resources) {
        const now = matrix[role]?.[res] ?? "none";
        const saved = data.matrix[role]?.[res] ?? "none";
        if (now !== saved) n++;
      }
    }
    return n;
  }

  async function save() {
    // WVG-35 / AC #5: hộp xác nhận (confirm) trước khi áp thay đổi quyền.
    const changes = countChanges();
    if (changes === 0) {
      setAlert({ type: "error", message: "Chưa có thay đổi nào để lưu." });
      return;
    }
    if (!window.confirm(`Xác nhận cập nhật ma trận quyền: ${changes} ô thay đổi.\nThay đổi áp dụng trên toàn hệ thống trong ~15 giây. Tiếp tục?`)) {
      return;
    }
    setSaving(true); setAlert(null);
    try {
      const res = await apiFetch("/wms/api/system/permissions", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrix }),
      });
      const r = await res.json();
      if (r.success) { setData(r.data); setMatrix(clone(r.data.matrix)); setAlert({ type: "success", message: r.message || "Đã lưu." }); }
      else {
        const detail = Array.isArray(r.errors) && r.errors.length ? ` (${r.errors[0]})` : "";
        setAlert({ type: "error", message: (r.error || "Lưu thất bại.") + detail });
      }
    } catch { setAlert({ type: "error", message: "Lỗi khi lưu." }); }
    finally { setSaving(false); }
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-primary mb-1">Ma trận quyền API (server)</h1>
        <p className="text-sm text-on-surface-variant mb-4">
          Cấu hình mức quyền mỗi vai trò trên từng tài nguyên. Server enforce <b>deny-by-default</b> theo bảng này.
          Thứ tự: <b>Không</b> &lt; <b>Đọc</b> &lt; <b>Đầy đủ</b> (đọc + ghi) &lt; <b>Đặc biệt</b>.
        </p>

        {alert && (
          <div className={`mb-3 p-3 rounded-lg text-sm ${alert.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {alert.message}
          </div>
        )}

        {loading ? (
          <div className="text-on-surface-variant">Đang tải…</div>
        ) : denied ? (
          <div className="p-8 text-center border rounded-xl bg-rose-50/40">
            <span className="material-symbols-outlined text-[48px] text-rose-300 block mb-2">block</span>
            <h2 className="text-lg font-bold text-on-surface mb-1">Không có quyền truy cập</h2>
            <p className="text-sm text-on-surface-variant">
              Chỉ vai trò <b>Quản lý</b> mới được cấu hình ma trận quyền. Backend đã từ chối yêu cầu (không chỉ ẩn menu).
            </p>
          </div>
        ) : data ? (
          <>
            <div className="overflow-x-auto border rounded-xl">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-surface-variant">
                    <th className="text-left p-2 sticky left-0 bg-surface-variant z-10">Tài nguyên</th>
                    {data.roles.map((role) => (
                      <th key={role} className="p-2 text-center whitespace-nowrap">{ROLE_LABELS[role] || role}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.resources.map((res) => (
                    <tr key={res} className="border-t">
                      <td className="p-2 font-medium sticky left-0 bg-white whitespace-nowrap">{RESOURCE_LABELS[res] || res}</td>
                      {data.roles.map((role) => {
                        const lvl = levelAt(role, res);
                        return (
                          <td key={role} className="p-1.5 text-center">
                            <select
                              value={lvl}
                              onChange={(e) => setLevel(role, res, e.target.value)}
                              className={`text-xs rounded px-1.5 py-1 border ${LEVEL_COLORS[lvl] || ""}`}
                            >
                              {data.levels.map((l) => (
                                <option key={l} value={l}>{LEVEL_LABELS[l] || l}</option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg font-semibold disabled:opacity-50">
                {saving ? "Đang lưu…" : "Lưu ma trận"}
              </button>
              <button onClick={resetDefaults} disabled={saving} className="px-4 py-2 bg-surface-variant rounded-lg">
                Khôi phục mặc định
              </button>
            </div>
            <p className="text-xs text-on-surface-variant mt-3">
              Lưu ý: vai trò legacy (ADMIN/MANAGER/STAFF) đã di trú sang <b>Quản lý</b> và
              <b> không còn quyền</b> (deny-by-default) — không hiển thị ở đây. Đây là ma trận
              <b> enforce thật</b> ở backend; thay đổi áp dụng trong ~15 giây trên toàn hệ thống.
            </p>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
