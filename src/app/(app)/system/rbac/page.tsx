"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";

const ROLES = ["QUAN_LY", "KE_TOAN", "THU_KHO", "XE_NANG", "KIEM_KE"];
const ROLE_LABELS: Record<string, string> = { 
  QUAN_LY: "Quản lý", 
  KE_TOAN: "Kế toán", 
  THU_KHO: "Thủ kho", 
  XE_NANG: "Xe nâng", 
  KIEM_KE: "Kiểm kê" 
};

export default function RBACPage() {
  const [roleFeatures, setRoleFeatures] = useState<Record<string, string[]>>({});
  const [featureMap, setFeatureMap] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    apiFetch("/wms/api/system/rbac")
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setRoleFeatures(res.data.roleFeatures);
          setFeatureMap(res.data.featureMap);
        } else {
          setAlert({ type: "error", message: res.error || "Không thể tải cấu hình phân quyền." });
        }
      })
      .catch(err => {
        console.error("Lỗi fetch RBAC:", err);
        setAlert({ type: "error", message: "Lỗi kết nối API phân quyền." });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (role: string, featureId: string) => {
    const currentFeatures = roleFeatures[role] || [];
    let updated: string[];
    if (currentFeatures.includes(featureId)) {
      updated = currentFeatures.filter(id => id !== featureId);
    } else {
      updated = [...currentFeatures, featureId];
    }
    setRoleFeatures({
      ...roleFeatures,
      [role]: updated
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setAlert(null);
    try {
      const res = await apiFetch("/wms/api/system/rbac", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleFeatures }),
      });
      const data = await res.json();
      if (data.success) {
        setAlert({ type: "success", message: "Đã lưu ma trận phân quyền mới và áp dụng lập tức!" });
        if (data.data && data.data.roleRoutes) {
          localStorage.setItem("vinhgiang_wms_role_routes", JSON.stringify(data.data.roleRoutes));
        }
      } else {
        setAlert({ type: "error", message: data.error || "Không thể lưu cấu hình phân quyền." });
      }
    } catch (err) {
      console.error("Lỗi lưu RBAC:", err);
      setAlert({ type: "error", message: "Lỗi kết nối API khi lưu cấu hình." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="PHÂN QUYỀN">
      <div className="p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[28px]">visibility</span>
              Hiển thị menu theo vai trò
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Bật/tắt các mục menu hiển thị cho từng vai trò (trải nghiệm giao diện).
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const headers = ["Chức năng", ...ROLES.map(r => ROLE_LABELS[r])];
                const rows = featureMap.map(f => [f.name, ...ROLES.map(r => (roleFeatures[r] || []).includes(f.id) ? "✓" : "")]);
                const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `ma-tran-phan-quyen-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>Xuất Excel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("Khôi phục về cấu hình mặc định? Mọi thay đổi chưa lưu sẽ bị mất.")) return;
                apiFetch("/wms/api/system/rbac/reset", { method: "POST" }).then(r => r.json()).then(r => {
                  if (r.success) { setRoleFeatures(r.data.roleFeatures); setAlert({ type: "success", message: "Đã khôi phục cấu hình mặc định." }); }
                  else setAlert({ type: "error", message: "Không thể reset: " + (r.error || "lỗi không xác định") });
                }).catch(() => setAlert({ type: "error", message: "Lỗi kết nối khi khôi phục cấu hình." }));
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-lg hover:bg-amber-100 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>Khôi phục
            </button>
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary/95 transition-all disabled:opacity-60"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Đang lưu...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">save</span>
                  Lưu thay đổi
                </>
              )}
            </button>
          </div>
        </div>

        {/* WVG-35 / UC-AUTH-05: nói rõ trang này KHÔNG phải hàng rào bảo mật. */}
        <div className="p-4 rounded-lg flex items-start gap-3 border bg-amber-50 border-amber-200 text-amber-900">
          <span className="material-symbols-outlined text-[22px]">info</span>
          <p className="text-sm">
            Trang này chỉ điều khiển <b>hiển thị menu</b> (trải nghiệm giao diện), <b>KHÔNG phải hàng rào bảo mật</b>.
            Quyền thực thi thật do <b>ma trận quyền API</b> quyết định và được backend enforce (deny-by-default).{" "}
            <a href="/wms/system/permissions" className="font-semibold underline hover:no-underline">
              Mở Ma trận quyền API →
            </a>
          </p>
        </div>

        {alert && (
          <div className={`p-4 rounded-lg flex items-start gap-3 border ${
            alert.type === "success" 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}>
            <span className="material-symbols-outlined text-[22px]">
              {alert.type === "success" ? "check_circle" : "error"}
            </span>
            <p className="text-sm font-medium">{alert.message}</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-on-surface-variant">Đang tải ma trận phân quyền...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-low/50 border-b border-outline-variant">
                    <th className="text-left px-5 py-4 font-semibold text-xs uppercase text-on-surface-variant tracking-wider w-[240px]">
                      Chức năng
                    </th>
                    {ROLES.map(r => (
                      <th key={r} className="text-center px-4 py-4 font-semibold text-xs uppercase text-on-surface-variant tracking-wider">
                        {ROLE_LABELS[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {featureMap.map(f => {
                    return (
                      <tr key={f.id} className="hover:bg-surface-low/50 transition-colors">
                        <td className="px-5 py-4 flex items-center gap-2">
                          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                            {f.icon}
                          </span>
                          <span className="font-semibold text-on-surface">{f.name}</span>
                        </td>
                        {ROLES.map(r => {
                          const isChecked = (roleFeatures[r] || []).includes(f.id);
                          return (
                            <td key={r} className="px-4 py-4 text-center">
                              <label className="inline-flex items-center justify-center cursor-pointer p-2 rounded-md hover:bg-surface-low/80 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggle(r, f.id)}
                                  className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                                />
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
