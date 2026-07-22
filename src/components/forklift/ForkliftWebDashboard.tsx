"use client";
import { useToast } from "@/components/ui";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";

type WebKPIs = {
  pendingTasks: number;
  completedPallets: number;
  overdueTasks: number;
  pendingChange: string;
  completedAccuracy: string;
};

type WebTask = {
  id: string;
  code: string;
  sku: string;
  productName: string;
  qty: string;
  expiry: string;
  isFefoPriority: boolean;
  source: string;
  status: string;
  statusChipClass: string;
};

type Operator = {
  id: string;
  name: string;
  phone: string;
  status: "WORKING" | "IDLE";
  tasksToday: number;
  lastLocation: string | null;
  lastActiveText: string;
  lastActiveAt: string | null;
};

type TeamSummary = {
  working: number;
  idle: number;
  total: number;
};

export default function ForkliftWebDashboard() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  const { toast } = useToast();

  const [kpis, setKpis] = useState<WebKPIs>({
    pendingTasks: 0,
    completedPallets: 0,
    overdueTasks: 0,
    pendingChange: "—",
    completedAccuracy: "—",
  });

  const [tasks, setTasks] = useState<WebTask[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<WebTask[]>([]);
  const [team, setTeam] = useState<Operator[]>([]);
  const [teamSummary, setTeamSummary] = useState<TeamSummary>({
    working: 0,
    idle: 0,
    total: 0,
  });

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<WebTask | null>(null);
  const [manualPalletId, setManualPalletId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [allDrivers, setAllDrivers] = useState<{ id: string; full_name: string; phone?: string }[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const router = useRouter();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [kpiRes, tasksRes, driversRes] = await Promise.all([
        fetch(`${basePath}/api/forklift/web/kpi`),
        fetch(`${basePath}/api/forklift/web/tasks`),
        fetch(`${basePath}/api/forklift/web/drivers`),
      ]);

      const kpiJson = await kpiRes.json();
      const tasksJson = await tasksRes.json();
      const driversJson = await driversRes.json();

      if (kpiJson.success) setKpis(kpiJson.data);
      if (tasksJson.success) {
        setTasks(tasksJson.data);
        setFilteredTasks(tasksJson.data);
      }
      if (driversJson.success) {
        setTeam(driversJson.data.team || []);
        setAllDrivers(driversJson.data.drivers || []);
        setTeamSummary(driversJson.data.summary || { working: 0, idle: 0, total: 0 });
      }
    } catch (error) {
      console.error("Error loading web forklift dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter tasks when searchQuery or statusFilter changes
  useEffect(() => {
    let result = tasks;

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.code.toLowerCase().includes(q) ||
          t.sku.toLowerCase().includes(q) ||
          t.productName.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "ALL") {
      result = result.filter((t) => t.status === statusFilter);
    }

    setFilteredTasks(result);
  }, [searchQuery, statusFilter, tasks]);

  const handleActionClick = (task: WebTask) => {
    if (task.status === "Chờ nhập") {
      setSelectedTask(task);
      setManualPalletId(task.id);
      setSelectedDriverId("");
      setIsAssignModalOpen(true);
    } else {
      // Fix: trước đây "Chi tiết"/"Điều hướng" KHÔNG có handler → bấm không ra gì.
      // Mọi trạng thái khác "Chờ nhập" → mở trang chi tiết pallet (task.id = pallet.id).
      router.push(`/pallets/${task.id}`);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const palletIdToAssign = selectedTask ? selectedTask.id : manualPalletId;
    if (!palletIdToAssign || !selectedDriverId) return;

    try {
      setAssigning(true);
      const res = await fetch(`${basePath}/api/forklift/web/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pallet_id: palletIdToAssign,
          driver_id: selectedDriverId,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.error(json.message || "Giao việc thành công!");
        setIsAssignModalOpen(false);
        setSelectedTask(null);
        setManualPalletId("");
        setSelectedDriverId("");
        fetchData();
      } else {
        toast.error(json.error || "Giao việc thất bại.");
      }
    } catch (error) {
      console.error("Error in assign action:", error);
      toast.error("Lỗi kết nối hệ thống.");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <AppLayout title="Điều phối Xe nâng">
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans">
        
        {/* Header Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface p-4 rounded-xl shadow-sm border border-outline-variant/30">
          <div>
            <h1 className="text-xl font-bold text-on-surface">Bảng điều phối vận hành</h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Theo dõi và quản lý vận hành xe nâng trong thời gian thực
            </p>
          </div>
          <div className="flex gap-2 self-start sm:self-center">
            <button
              onClick={fetchData}
              className="px-3.5 py-2 border border-outline-variant rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-surface-low active:scale-95 transition-all text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span> Làm mới
            </button>
            <Link
              href="/movements"
              className="px-3.5 py-2 border border-outline-variant rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-surface-low active:scale-95 transition-all text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px]">history</span> Lịch sử di chuyển
            </Link>
          </div>
        </div>

        {/* KPIs Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* KPI 1 */}
          <div className="industrial-card p-5 rounded-xl bg-surface shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                CÔNG VIỆC CHỜ XỬ LÝ
              </span>
              <span className="material-symbols-outlined text-amber-500 bg-amber-50 p-1.5 rounded-lg">
                pending_actions
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-3xl font-extrabold font-mono text-primary">
                {kpis.pendingTasks}
              </p>
              <span className="text-xs font-bold text-on-surface-variant/70 uppercase">Nhiệm vụ</span>
            </div>
            <p className="text-[11px] md:text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-0.5">
              <span className="material-symbols-outlined text-xs">trending_up</span>
              {kpis.pendingChange}
            </p>
          </div>

          {/* KPI 2 */}
          <div className="industrial-card p-5 rounded-xl bg-surface shadow-sm border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                HOÀN THÀNH HÔM NAY
              </span>
              <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1.5 rounded-lg">
                check_circle
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-3xl font-extrabold font-mono text-primary">
                {kpis.completedPallets}
              </p>
              <span className="text-xs font-bold text-on-surface-variant/70 uppercase">Pallets</span>
            </div>
            <p className="text-[11px] md:text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-0.5">
              <span className="material-symbols-outlined text-xs">check</span>
              {kpis.completedAccuracy}
            </p>
          </div>

          {/* KPI 3 */}
          <div className="industrial-card p-5 rounded-xl bg-surface shadow-sm border-l-4 border-l-rose-500 border border-outline-variant/30 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                NHIỆM VỤ QUÁ HẠN (&gt; 2H)
              </span>
              <span className="material-symbols-outlined text-rose-500 bg-rose-50 p-1.5 rounded-lg">
                alarm
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-3xl font-extrabold font-mono text-rose-600">
                {String(kpis.overdueTasks).padStart(2, "0")}
              </p>
              <span className="text-xs font-bold text-on-surface-variant/70 uppercase">Cảnh báo</span>
            </div>
            <p className="text-[11px] md:text-xs text-rose-500 font-semibold mt-2 flex items-center gap-0.5">
              <span className="material-symbols-outlined text-xs">priority_high</span>
              Ưu tiên xử lý ngay
            </p>
          </div>
        </div>

        {/* Real-time Task List Section */}
        <div className="industrial-card bg-surface rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface-low/50">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-on-surface text-sm">Danh sách nhiệm vụ trực tiếp</h3>
              <span className="px-2 py-0.5 bg-rose-500 text-white rounded text-[10px] md:text-xs font-extrabold tracking-wider animate-pulse uppercase">
                ● Trực tiếp
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Search input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tra cứu mã pallet, SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white rounded-lg border border-outline-variant text-xs w-48 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
                />
                <span className="material-symbols-outlined text-on-surface-variant/70 text-xs absolute left-2.5 top-2.5">
                  search
                </span>
              </div>
              {/* Filter selection */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white rounded-lg border border-outline-variant text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="Chờ nhập">Chờ nhập</option>
                <option value="Đang di chuyển">Đang di chuyển</option>
                <option value="Chờ xuất">Chờ xuất</option>
                <option value="Đã xếp">Đã xếp</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-low border-b border-outline-variant/20 text-on-surface-variant font-bold uppercase tracking-wider">
                  <th className="px-5 py-3.5 font-bold">Mã Pallet</th>
                  <th className="px-5 py-3.5 font-bold">SKU / Tên sản phẩm</th>
                  <th className="px-5 py-3.5 font-bold text-right">SL</th>
                  <th className="px-5 py-3.5 font-bold">HSD (FEFO)</th>
                  <th className="px-5 py-3.5 font-bold">Khu vực nguồn</th>
                  <th className="px-5 py-3.5 font-bold">Trạng thái</th>
                  <th className="px-5 py-3.5 font-bold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <span className="text-xs text-on-surface-variant/70">Đang đồng bộ dữ liệu kho...</span>
                    </td>
                  </tr>
                ) : filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-on-surface-variant/70">
                      <span className="material-symbols-outlined text-[40px] block mb-2 opacity-30">
                        inventory_2
                      </span>
                      Không tìm thấy nhiệm vụ xe nâng nào.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-outline-variant/10 hover:bg-surface-low/50 transition-colors"
                    >
                      <td className="px-5 py-4 font-mono font-bold text-on-surface">
                        {t.code}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-on-surface">{t.sku}</p>
                        <p className="text-on-surface-variant mt-0.5">{t.productName}</p>
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-semibold text-on-surface">
                        {t.qty}
                      </td>
                      <td className="px-5 py-4">
                        <p className={`font-mono text-xs ${t.isFefoPriority ? "text-rose-600 font-bold" : "text-on-surface-variant"}`}>
                          {t.expiry}
                        </p>
                        {t.isFefoPriority && (
                          <span className="inline-block text-[11px] md:text-xs font-extrabold text-rose-600 bg-rose-50 px-1 rounded mt-0.5 tracking-wide uppercase">
                            Ưu tiên FEFO
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-on-surface-variant">
                        {t.source}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`chip text-[11px] md:text-xs font-semibold py-1 px-2.5 rounded-full ${t.statusChipClass}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleActionClick(t)}
                          className="text-xs text-primary font-bold hover:underline active:scale-95 transition-all"
                        >
                          {t.status === "Chờ nhập" ? "Giao việc" : t.status === "Chờ xuất" ? "Điều hướng" : "Chi tiết"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-outline-variant/30 bg-surface-low/30 text-xs text-on-surface-variant">
            <p>Đang hiển thị 1-{filteredTasks.length} của {tasks.length} bản ghi</p>
            <div className="flex items-center gap-1">
              <button className="p-1 hover:bg-surface-mid/50 rounded transition-colors">
                <span className="material-symbols-outlined text-[16px] block">chevron_left</span>
              </button>
              <button className="px-2.5 py-1 bg-primary text-white rounded font-mono text-xs font-bold shadow-sm">
                1
              </button>
              <button className="p-1 hover:bg-surface-mid/50 rounded transition-colors">
                <span className="material-symbols-outlined text-[16px] block">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Đội ngũ tài xế & QR Grid Section */}
        <div className="grid grid-cols-12 gap-6">
          {/* Driver team status card — dữ liệu thật từ /api/forklift/web/drivers */}
          <div className="col-span-12 bg-surface p-5 rounded-xl shadow-sm border border-outline-variant/30 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="font-bold text-on-surface text-sm flex items-center gap-2">
                Đội ngũ tài xế xe nâng
              </h3>
              <div className="flex items-center gap-4 text-xs font-medium text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                  Đang làm việc ({teamSummary.working})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-on-surface-variant/40 rounded-full"></span>
                  Rảnh ({teamSummary.idle})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 flex-1">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="border border-outline-variant/50 rounded-lg p-4 animate-pulse flex flex-col justify-between h-28 bg-surface-low/50">
                    <div className="w-20 h-4 bg-surface-mid rounded"></div>
                    <div className="w-16 h-3 bg-surface-mid rounded mt-3"></div>
                  </div>
                ))
              ) : team.length === 0 ? (
                <div className="col-span-full text-center py-10 text-on-surface-variant/70">
                  <span className="material-symbols-outlined text-[40px] block mb-2 opacity-30">
                    engineering
                  </span>
                  Chưa có tài xế xe nâng nào. Thêm người dùng vai trò Xe nâng để theo dõi.
                </div>
              ) : (
                team.map((op) => {
                  const working = op.status === "WORKING";
                  return (
                    <div
                      key={op.id}
                      className={`border rounded-lg p-3.5 flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md ${
                        working ? "border-emerald-200 bg-emerald-50/40" : "border-surface-variant"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm text-on-surface truncate" title={op.name}>
                          {op.name}
                        </p>
                        <span
                          className={`shrink-0 w-2.5 h-2.5 rounded-full ${working ? "bg-emerald-500" : "bg-on-surface-variant/40"}`}
                          title={working ? "Đang làm việc" : "Rảnh"}
                        ></span>
                      </div>

                      <div className="mt-3 space-y-1">
                        <p className="text-[11px] md:text-xs font-semibold text-on-surface flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-on-surface-variant">checklist</span>
                          {op.tasksToday} việc hôm nay
                        </p>
                        <p className="text-[10px] md:text-xs text-on-surface-variant font-mono flex items-center gap-1 truncate" title={op.lastLocation || ""}>
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          {op.lastLocation || "—"}
                        </p>
                        <p className="text-[10px] md:text-xs text-on-surface-variant/80 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          {op.lastActiveText}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Assign Driver Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-outline-variant w-full max-w-md overflow-hidden transform transition-all duration-300 scale-100">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-orange-600 to-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined">assignment_ind</span>
                <h3 className="font-bold text-sm uppercase tracking-wide">Phân công Tài xế Xe nâng</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors text-white"
              >
                <span className="material-symbols-outlined text-[20px] block">close</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAssign} className="p-6 space-y-4">
              {/* Pallet Selection / Details Summary */}
              {selectedTask ? (
                <div className="bg-surface-low p-4 rounded-xl border border-outline-variant/50 space-y-2">
                  <p className="text-[10px] md:text-xs uppercase font-bold text-on-surface-variant/70 tracking-wider">Thông tin Pallet</p>
                  <div className="grid grid-cols-2 gap-y-2 text-xs">
                    <div>
                      <span className="text-on-surface-variant block">Mã Pallet:</span>
                      <strong className="font-mono text-on-surface">{selectedTask.code}</strong>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block">Sản phẩm:</span>
                      <strong className="text-on-surface truncate block" title={selectedTask.productName}>
                        {selectedTask.sku}
                      </strong>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block">Số lượng:</span>
                      <strong className="font-mono text-on-surface">{selectedTask.qty}</strong>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block">Vị trí nguồn:</span>
                      <strong className="font-mono text-on-surface">{selectedTask.source}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-on-surface-variant">Chọn Pallet cần giao:</label>
                  {tasks.filter((t) => t.status === "Chờ nhập").length === 0 ? (
                    <p className="text-xs text-rose-500 font-bold bg-rose-50 p-3 rounded-lg border border-rose-100">
                      Không có pallet nào đang chờ nhập.
                    </p>
                  ) : (
                    <select
                      required
                      value={manualPalletId}
                      onChange={(e) => setManualPalletId(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-outline-variant text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    >
                      <option value="">-- Chọn pallet chờ nhập --</option>
                      {tasks
                        .filter((t) => t.status === "Chờ nhập")
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.code} - {t.sku} ({t.qty})
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              )}

              {/* Driver Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-on-surface-variant">Chọn Tài xế Xe nâng:</label>
                <select
                  required
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-outline-variant text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                >
                  <option value="">-- Chọn tài xế khả dụng --</option>
                  {allDrivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.full_name} {driver.phone ? `(${driver.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Footer Buttons */}
              <div className="flex gap-3 justify-end pt-2 border-t border-outline-variant/50">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 border border-outline-variant hover:bg-surface-low rounded-lg text-xs font-semibold text-on-surface-variant transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedDriverId || (!selectedTask && !manualPalletId)}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:bg-surface-mid disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                >
                  {assigning ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Đang phân công...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                      Giao việc
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AppLayout>
  );
}
