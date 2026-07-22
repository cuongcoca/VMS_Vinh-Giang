"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useToast, useConfirm, useClientPagination, ListPageFooter } from "@/components/ui";

// Định nghĩa Types
type LocationType = "STORAGE" | "INBOUND_STAGING" | "OUTBOUND_STAGING" | "STOCKTAKE";
type LocationStatus =
  | "EMPTY"
  | "USING"
  | "FULL"
  | "PARTIAL"
  | "MAINTENANCE"
  | "RESERVED"
  | "WAITING_OUTBOUND"
  | "NEEDS_CHECK"
  | "CHECK_AGAIN";

interface Location {
  id: string;
  code: string;
  zone: string;
  rack: string;
  level: string;
  type: LocationType;
  status: LocationStatus;
  max_weight_kg: number | null;
  max_pallets: number | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
  // TC_LOC_003: tồn pallet thực tế + trạng thái suy ra từ tồn (API trả về). Optional
  // để an toàn nếu response cũ chưa có → fallback về status lưu sẵn.
  pallet_count?: number;
  effective_status?: LocationStatus;
}

// TC_LOC_003: ưu tiên trạng thái suy ra từ pallet thực tế; tồn thực tế của vị trí.
function effStatus(loc: Location): LocationStatus {
  return loc.effective_status ?? loc.status;
}
function occCount(loc: Location): number {
  return loc.pallet_count ?? 0;
}

const TYPE_LABELS: Record<LocationType, string> = {
  STORAGE: "Vị trí chứa",
  INBOUND_STAGING: "Khu chờ nhập",
  OUTBOUND_STAGING: "Khu chờ xuất",
  STOCKTAKE: "Khu kiểm kê"
};

// Phase 5.1 (BUG_REPORT MD02 UC-MD-05): label + màu theo mockup khách hàng.
// TC_LOC_003 / _014→_019 / row 187 / row 207 — đảm bảo 7 trạng thái chính của
// mockup đều render đúng:
//   Trống / Đang dùng / Đầy / Còn một phần / Chờ kiểm kê / Khóa SD / Cần kiểm tra lại
const STATUS_DETAILS: Record<LocationStatus, { label: string; bgClass: string; textClass: string; icon: string; borderClass: string }> = {
  EMPTY: {
    label: "Trống",
    bgClass: "bg-surface-low hover:bg-surface-low",
    textClass: "text-on-surface-variant",
    borderClass: "border-outline-variant border-dashed",
    icon: "circle"
  },
  USING: {
    label: "Đang dùng",
    bgClass: "bg-blue-50 hover:bg-blue-100",
    textClass: "text-blue-700",
    borderClass: "border-blue-300",
    icon: "inventory"
  },
  FULL: {
    label: "Đầy",
    bgClass: "bg-rose-50 hover:bg-rose-100",
    textClass: "text-rose-700",
    borderClass: "border-rose-300",
    icon: "disabled_by_default"
  },
  PARTIAL: {
    label: "Còn một phần",
    bgClass: "bg-orange-50 hover:bg-orange-100",
    textClass: "text-orange-700",
    borderClass: "border-orange-300",
    icon: "donut_large"
  },
  NEEDS_CHECK: {
    label: "Chờ kiểm kê",
    bgClass: "bg-purple-50 hover:bg-purple-100",
    textClass: "text-purple-700",
    borderClass: "border-purple-300",
    icon: "fact_check"
  },
  MAINTENANCE: {
    label: "Khóa SD",
    bgClass: "bg-gray-100 hover:bg-gray-200",
    textClass: "text-gray-700",
    borderClass: "border-gray-400",
    icon: "lock"
  },
  CHECK_AGAIN: {
    label: "Cần kiểm tra lại",
    bgClass: "bg-amber-50 hover:bg-amber-100",
    textClass: "text-amber-700",
    borderClass: "border-amber-300",
    icon: "warning"
  },
  RESERVED: {
    label: "Đặt chỗ",
    bgClass: "bg-yellow-50 hover:bg-yellow-100",
    textClass: "text-yellow-700",
    borderClass: "border-yellow-300",
    icon: "bookmark"
  },
  WAITING_OUTBOUND: {
    label: "Chờ xuất",
    bgClass: "bg-violet-50 hover:bg-violet-100",
    textClass: "text-violet-700",
    borderClass: "border-violet-300",
    icon: "outbox"
  }
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Bộ lọc
  const [filterZone, setFilterZone] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals & Panels
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Import Excel (UC-MD-05 / TC_LOC_001) — modal 3 bước: tải file → xem trước → hoàn tất
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    rows: Array<{
      row_index: number;
      code: string;
      zone: string;
      rack: string;
      level: string;
      type: string;
      max_weight_kg: number | null;
      max_pallets: number | null;
      note: string;
      status: "NEW" | "WARNING" | "ERROR";
      status_message: string;
    }>;
    summary: { total: number; new: number; warning: number; error: number };
  } | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState("");

  // Form State đơn lẻ
  const [singleForm, setSingleForm] = useState({
    zone: "A",
    rack: "1",
    level: "1",
    type: "STORAGE" as LocationType,
    status: "EMPTY" as LocationStatus,
    max_weight_kg: "1500",
    max_pallets: "4",
    note: ""
  });

  // Form State tạo hàng loạt
  const [bulkForm, setBulkForm] = useState({
    zone: "A",
    rackFrom: "1",
    rackTo: "10",
    levelFrom: "1",
    levelTo: "4",
    type: "STORAGE" as LocationType,
    max_weight_kg: "1500",
    max_pallets: "4",
    note: ""
  });

  // Form state cho Panel chỉnh sửa chi tiết/trạng thái nhanh
  const [editStatus, setEditStatus] = useState<LocationStatus>("EMPTY");
  const [editNote, setEditNote] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editPallets, setEditPallets] = useState("");
  const [editType, setEditType] = useState<LocationType>("STORAGE");

  // Fetch data
  const fetchLocations = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const params = new URLSearchParams();
      if (filterZone) params.set("zone", filterZone);
      if (filterType) params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`/wms/api/locations?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setLocations(result.data);
      } else {
        setErrorMsg(result.error || "Không thể tải danh sách vị trí.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Lỗi kết nối máy chủ API.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [filterZone, filterType, filterStatus, searchQuery]);

  // Lấy các Zone duy nhất để làm bộ lọc
  const uniqueZones = useMemo(() => {
    const zones = new Set<string>();
    locations.forEach((loc) => {
      if (loc.zone) zones.add(loc.zone);
    });
    return Array.from(zones).sort();
  }, [locations]);

  // Thống kê KPIs — Phase 5.1: thêm PARTIAL/NEEDS_CHECK/CHECK_AGAIN
  const kpis = useMemo(() => {
    const counts: Record<LocationStatus | "TOTAL", number> = {
      TOTAL: locations.length,
      EMPTY: 0,
      USING: 0,
      FULL: 0,
      PARTIAL: 0,
      MAINTENANCE: 0,
      RESERVED: 0,
      WAITING_OUTBOUND: 0,
      NEEDS_CHECK: 0,
      CHECK_AGAIN: 0,
    };
    locations.forEach((loc) => {
      const st = effStatus(loc);
      if (counts[st] !== undefined) {
        counts[st]++;
      }
    });
    return counts;
  }, [locations]);

  // Nhóm vị trí theo Zone, tiếp tục theo Rack (hàng) và Level (cột) phục vụ Grid View
  const groupedGridData = useMemo(() => {
    // Chỉ lấy Zone hiện tại làm trọng tâm hiển thị grid, mặc định lấy Zone đầu tiên nếu không lọc
    const targetZone = filterZone || uniqueZones[0] || "";
    if (!targetZone) return null;

    const filtered = locations.filter((loc) => loc.zone === targetZone);

    // Lấy danh sách Rack và Level duy nhất để dựng trục tọa độ lưới
    const racks = Array.from(new Set(filtered.map((l) => l.rack))).sort((a, b) => b.localeCompare(a)); // Rack xếp từ cao xuống thấp
    const levels = Array.from(new Set(filtered.map((l) => l.level))).sort((a, b) => a.localeCompare(b)); // Level từ trái qua phải

    // Tạo bản đồ tra cứu nhanh ô vị trí: Rack_Level -> Location
    const gridMap: Record<string, Location> = {};
    filtered.forEach((loc) => {
      gridMap[`${loc.rack}_${loc.level}`] = loc;
    });

    return { targetZone, racks, levels, gridMap };
  }, [locations, filterZone, uniqueZones]);

  // Phase 3.5: replace alert/confirm browser-native
  const { toast } = useToast();
  const { confirm } = useConfirm();

  // Click vào ô vị trí kho
  const handleSelectLocation = (loc: Location) => {
    setSelectedLocation(loc);
    setEditStatus(loc.status);
    setEditNote(loc.note || "");
    setEditWeight(loc.max_weight_kg ? loc.max_weight_kg.toString() : "");
    setEditPallets(loc.max_pallets ? loc.max_pallets.toString() : "");
    setEditType(loc.type);
  };

  // Submit sửa vị trí
  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation) return;

    try {
      const res = await fetch(`/wms/api/locations/${selectedLocation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          note: editNote,
          max_weight_kg: editWeight ? parseFloat(editWeight) : null,
          max_pallets: editPallets ? parseInt(editPallets, 10) : null,
          type: editType
        })
      });
      const result = await res.json();
      if (result.success) {
        setLocations((prev) =>
          prev.map((loc) => (loc.id === selectedLocation.id ? result.data : loc))
        );
        setSelectedLocation(null);
        toast.success("Đã cập nhật vị trí");
      } else {
        toast.error(result.error || "Cập nhật thất bại.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối khi cập nhật.");
    }
  };

  // Submit xóa vị trí (Soft delete)
  const handleDeleteLocation = async (id: string) => {
    const ok = await confirm({
      title: "Xóa vị trí kho?",
      description: "Vị trí này sẽ bị xóa khỏi danh sách.",
      confirmText: "Xóa",
      variant: "danger",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/wms/api/locations/${id}`, {
        method: "DELETE"
      });
      const result = await res.json();
      if (result.success) {
        setLocations((prev) => prev.filter((loc) => loc.id !== id));
        setSelectedLocation(null);
        toast.success("Đã xóa vị trí");
      } else {
        toast.error(result.error || "Xóa thất bại.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối khi xóa.");
    }
  };

  // Submit tạo đơn lẻ
  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/wms/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(singleForm)
      });
      const result = await res.json();
      if (result.success) {
        setLocations((prev) => [...prev, result.data].sort((a, b) => a.code.localeCompare(b.code)));
        setShowSingleModal(false);
        toast.success("Đã tạo vị trí");
        // Reset form
        setSingleForm({
          zone: "A",
          rack: "1",
          level: "1",
          type: "STORAGE",
          status: "EMPTY",
          max_weight_kg: "1500",
          max_pallets: "4",
          note: ""
        });
      } else {
        toast.error(result.error || "Tạo vị trí thất bại.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối khi tạo vị trí.");
    }
  };

  // Submit tạo hàng loạt (Bulk)
  const handleCreateBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/wms/api/locations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bulkForm)
      });
      const result = await res.json();
      if (result.success) {
        const { created, skipped } = result.data;
        toast.success(`Tạo thành công ${created.length} vị trí, bỏ qua ${skipped.length}`);
        setShowBulkModal(false);
        fetchLocations();
      } else {
        toast.error(result.error || "Tạo hàng loạt thất bại.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối khi tạo hàng loạt.");
    }
  };

  // ===== Import vị trí kho từ Excel (UC-MD-05 / TC_LOC_001) =====
  const openImportModal = () => {
    setImportFile(null);
    setImportStep(1);
    setImportError("");
    setImportResult(null);
    setShowImportModal(true);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
      setImportError("");
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!importFile) {
      setImportError("Vui lòng chọn file Excel.");
      return;
    }
    setIsAnalyzing(true);
    setImportError("");
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await apiFetch("/wms/api/locations/import-excel", { method: "POST", body: formData });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        setImportError(resData.error || "Phân tích file thất bại.");
        return;
      }
      setImportResult(resData.data);
      setImportStep(2);
    } catch {
      setImportError("Lỗi kết nối mạng khi phân tích file.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importResult || importResult.rows.length === 0) return;
    setIsImporting(true);
    setImportError("");
    try {
      const res = await apiFetch("/wms/api/locations/import-excel/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locations: importResult.rows }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        setImportError(resData.error || "Nhập vị trí thất bại.");
        return;
      }
      setImportSuccessMsg(resData.message || "Nhập thành công!");
      setImportStep(3);
      fetchLocations();
    } catch {
      setImportError("Lỗi kết nối mạng khi ghi nhận nhập dữ liệu.");
    } finally {
      setIsImporting(false);
    }
  };

  const downloadLocationTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      const headers = ["Khu", "Kệ", "Tầng", "Loại vị trí", "Tải trọng tối đa (kg)", "Số pallet tối đa", "Ghi chú"];
      const sample = [
        ["A", "01", "01", "Vị trí chứa", 1500, 4, "Kệ tầng trệt"],
        ["A", "01", "02", "Vị trí chứa", 1500, 4, ""],
        ["B", "12", "03", "Vị trí chứa", 1000, 2, "Khu hàng nặng"],
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh sach vi tri kho");
      XLSX.writeFile(wb, "mau_import_vi_tri_kho.xlsx");
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải file mẫu. Vui lòng thử lại.");
    }
  };

  // Phân trang client-side cho chế độ xem dạng bảng (danh sách phẳng các vị trí).
  // Chế độ sơ đồ lưới là bản đồ tọa độ theo Kệ/Tầng nên không phân trang.
  const pg = useClientPagination(locations, {
    resetKey: `${filterZone}|${filterType}|${filterStatus}|${searchQuery}|${viewMode}`,
  });
  const { paged: pagedLoc } = pg;

  return (
    <AppLayout title="VỊ TRÍ KHO">
    <div className="p-6 space-y-5 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Sơ đồ vị trí kho</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Quản lý Khu vực - Kệ - Tầng (Quy chuẩn A-03-02) và điều phối trạng thái vị trí.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2 text-sm bg-white hover:bg-surface-low text-on-surface border border-outline-variant rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">apps</span>
            Khởi tạo hàng loạt
          </button>
          <button
            onClick={openImportModal}
            className="px-4 py-2 text-sm bg-white hover:bg-surface-low text-on-surface border border-outline-variant rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Nhập Excel
          </button>
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/locations/qr-print`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm border border-outline-variant hover:bg-surface-low rounded-lg flex items-center gap-2 font-medium transition-colors text-on-surface"
            title="Mở trang in QR tất cả vị trí (Ctrl+P để in)"
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
            In QR
          </a>
          <button
            onClick={() => setShowSingleModal(true)}
            className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Thêm vị trí
          </button>
        </div>
      </div>

      {/* KPI Cards Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        <div className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Tổng vị trí</span>
          <span className="text-2xl font-bold text-on-surface mt-2">{kpis.TOTAL}</span>
        </div>
        {Object.entries(STATUS_DETAILS).map(([key, details]) => (
          <div
            key={key}
            onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
            className={`cursor-pointer p-4 rounded-xl border transition-all shadow-sm flex flex-col justify-between ${
              filterStatus === key
                ? "bg-primary text-white border-primary scale-[1.02]"
                : "bg-white text-on-surface border-outline-variant hover:border-outline-variant"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wider ${filterStatus === key ? "text-on-surface-variant/50" : "text-on-surface-variant"}`}>
                {details.label}
              </span>
              <span className={`material-symbols-outlined text-[18px] ${filterStatus === key ? "text-white" : details.textClass}`}>
                {details.icon}
              </span>
            </div>
            <span className="text-2xl font-bold mt-2">{kpis[key as LocationStatus]}</span>
          </div>
        ))}
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm mb-6 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant/70 text-[20px]">search</span>
            <input
              type="text"
              placeholder="Tìm kiếm mã vị trí..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-surface-low border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Lọc theo Khu (Zone) */}
          <select
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
            className="px-3 py-2 text-sm bg-surface-low border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Chọn khu (Khu {uniqueZones.join(", ") || "—"})</option>
            {uniqueZones.map((z) => (
              <option key={z} value={z}>
                Khu {z}
              </option>
            ))}
          </select>

          {/* Lọc theo Loại vị trí */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 text-sm bg-surface-low border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">Tất cả loại vị trí</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Switches */}
        <div className="flex items-center border border-outline-variant rounded-lg p-0.5 bg-surface-low">
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === "grid" ? "bg-white shadow text-primary" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">grid_on</span>
            Sơ đồ lưới
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === "table" ? "bg-white shadow text-primary" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
            Danh sách bảng
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-outline-variant rounded-xl shadow-sm">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-on-surface-variant mt-4">Đang tải thông tin sơ đồ kho...</span>
        </div>
      ) : errorMsg ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl shadow-sm text-center font-medium">
          {errorMsg}
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW LAYOUT */
        groupedGridData ? (
          <div className="bg-white p-6 rounded-xl border border-outline-variant shadow-sm overflow-x-auto">
            <div className="mb-4 flex justify-between items-center pb-3 border-b border-outline-variant/50">
              <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-sm font-bold">Khu {groupedGridData.targetZone}</span>
                Sơ đồ lưới phân bổ ô vị trí
              </h2>
              <span className="text-xs text-on-surface-variant font-medium">Trục đứng: Kệ (Rack) · Trục ngang: Tầng (Level)</span>
            </div>

            {/* Grid structure */}
            <div className="min-w-[800px] flex flex-col gap-3">
              {/* Header: Levels */}
              <div className="flex items-center">
                {/* Rack Label Placeholder */}
                <div className="w-16 flex-shrink-0 text-xs font-bold text-on-surface-variant/70 text-right pr-4">RACK</div>
                <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${groupedGridData.levels.length}, minmax(0, 1fr))` }}>
                  {groupedGridData.levels.map((lvl) => (
                    <div key={lvl} className="text-center font-mono text-xs font-bold text-on-surface-variant/70 pb-1 uppercase">
                      Tầng {lvl}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows: Racks */}
              {groupedGridData.racks.map((rck) => (
                <div key={rck} className="flex items-center">
                  {/* Rack vertical Label */}
                  <div className="w-16 flex-shrink-0 font-mono text-xs font-bold text-on-surface-variant text-right pr-4">
                    Kệ {rck}
                  </div>

                  {/* Level Columns */}
                  <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${groupedGridData.levels.length}, minmax(0, 1fr))` }}>
                    {groupedGridData.levels.map((lvl) => {
                      const loc = groupedGridData.gridMap[`${rck}_${lvl}`];
                      if (!loc) {
                        return (
                          <div key={lvl} className="aspect-square bg-surface-low border border-outline-variant border-dashed rounded-lg flex items-center justify-center opacity-30 text-[10px] text-on-surface-variant/70 font-mono">
                            N/A
                          </div>
                        );
                      }

                      const details = STATUS_DETAILS[effStatus(loc)];
                      return (
                        <div
                          key={loc.id}
                          onClick={() => handleSelectLocation(loc)}
                          className={`aspect-[4/3] border rounded-xl p-2 cursor-pointer flex flex-col justify-between transition-all duration-150 transform hover:-translate-y-0.5 hover:shadow-md ${details.bgClass} ${details.borderClass}`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-mono text-xs font-bold tracking-tight text-on-surface">
                              {loc.code || `${loc.rack}-${loc.level}`}
                            </span>
                            <span className={`material-symbols-outlined text-[16px] ${details.textClass}`}>
                              {details.icon}
                            </span>
                          </div>

                          {/* UC-MD-05: status label nổi bật theo mockup */}
                          <div className="text-center">
                            <span className={`text-[10px] font-bold ${details.textClass}`}>
                              {details.label}
                            </span>
                          </div>

                          <div className="flex justify-between items-end">
                            <span className="text-[9px] font-semibold text-on-surface-variant/70 truncate max-w-[80px]">
                              {TYPE_LABELS[loc.type]}
                            </span>
                            {/* TC_LOC_003: tồn thực tế / sức chứa (vd 2/4) thay vì chỉ sức chứa */}
                            {loc.max_pallets != null && (
                              <span className="text-[9px] font-bold text-on-surface-variant bg-black/5 px-1.5 py-0.5 rounded">
                                {occCount(loc)}/{loc.max_pallets}P
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* UC-MD-05: Legend chú thích màu theo mockup */}
            <div className="mt-5 pt-4 border-t border-outline-variant/50 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-on-surface-variant">
              <span className="font-semibold text-on-surface-variant uppercase tracking-wider">Chú thích:</span>
              {(Object.keys(STATUS_DETAILS) as LocationStatus[]).map((st) => {
                const d = STATUS_DETAILS[st];
                return (
                  <span key={st} className="inline-flex items-center gap-1.5">
                    <span className={`inline-block w-3 h-3 rounded border ${d.bgClass.split(" ")[0]} ${d.borderClass}`} />
                    <span className={d.textClass}>{d.label}</span>
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white py-16 rounded-xl border border-outline-variant text-center text-on-surface-variant shadow-sm font-medium">
            Không tìm thấy thông tin sơ đồ khu. Hãy chọn/tạo khu để bắt đầu.
          </div>
        )
      ) : (
        /* TABLE VIEW LAYOUT */
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ minWidth: 780 }}>
              <thead>
                <tr className="bg-surface-low border-b border-outline-variant">
                  <th className="px-3 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">Mã vị trí</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap text-center">Khu</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap text-center">Kệ</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap text-center">Tầng</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">Loại</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap text-right">Tải (kg)</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap text-center">Tồn/Sức chứa</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">Trạng thái</th>
                  <th className="px-3 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {locations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-on-surface-variant/70 font-medium">
                      <span className="material-symbols-outlined text-[40px] opacity-30 block mx-auto mb-2">warehouse</span>
                      Danh sách vị trí kho trống.
                    </td>
                  </tr>
                ) : (
                  pagedLoc.map((loc) => {
                    const details = STATUS_DETAILS[effStatus(loc)];
                    return (
                      <tr key={loc.id} className="hover:bg-surface-low/60 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-sm font-bold text-primary whitespace-nowrap">{loc.code}</td>
                        <td className="px-3 py-2.5 font-mono text-sm text-center">{loc.zone}</td>
                        <td className="px-3 py-2.5 font-mono text-sm text-center">{loc.rack}</td>
                        <td className="px-3 py-2.5 font-mono text-sm text-center">{loc.level}</td>
                        <td className="px-3 py-2.5 text-xs text-on-surface-variant whitespace-nowrap">{TYPE_LABELS[loc.type]}</td>
                        <td className="px-3 py-2.5 text-sm font-mono text-on-surface-variant text-right whitespace-nowrap">
                          {loc.max_weight_kg ? `${parseFloat(loc.max_weight_kg.toString()).toLocaleString()}` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-sm font-mono text-on-surface-variant text-center">
                          {loc.max_pallets != null ? `${occCount(loc)}/${loc.max_pallets}` : (occCount(loc) || "—")}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${details.bgClass} ${details.textClass}`}>
                            <span className={`material-symbols-outlined text-[13px]`}>{details.icon}</span>
                            {details.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleSelectLocation(loc)}
                              title="Cấu hình vị trí"
                              className="w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteLocation(loc.id)}
                              title="Xóa vị trí"
                              className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 flex items-center justify-center transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Footer count */}
          {locations.length > 0 && (
            <div className="px-4 py-2.5 bg-surface-low border-t border-outline-variant text-xs text-on-surface-variant flex justify-between items-center">
              <span>Hiển thị <strong className="text-on-surface">{locations.length}</strong> vị trí</span>
              <span>Trống: <strong className="text-emerald-600">{kpis.EMPTY}</strong> · Đang dùng: <strong className="text-blue-600">{kpis.USING}</strong> · Đầy: <strong className="text-rose-600">{kpis.FULL}</strong></span>
            </div>
          )}
          {/* Phân trang danh sách vị trí (chế độ bảng) */}
          <ListPageFooter {...pg} unit="vị trí" />
        </div>
      )}

      {/* POPUP CẬP NHẬT VỊ TRÍ */}
      {selectedLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ animation: "fadeIn 0.2s ease-out" }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedLocation(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-[520px] max-w-[95vw] max-h-[90vh] overflow-y-auto" style={{ animation: "scaleIn 0.2s ease-out" }}>
            <div className="px-6 py-4 border-b border-surface-low flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <span className="text-xs font-semibold text-on-surface-variant/70 uppercase tracking-wider">Cập nhật ô vị trí</span>
                <h3 className="text-xl font-bold text-primary font-mono mt-0.5">{selectedLocation.code}</h3>
              </div>
              <button
                onClick={() => setSelectedLocation(null)}
                className="p-1 hover:bg-surface-low rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleUpdateLocation} className="p-6 space-y-5">
              {/* TC_LOC_003: tồn thực tế (suy từ pallet đang chiếm) — đối chiếu trạng thái */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-low border border-outline-variant">
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Đang chứa thực tế</span>
                <span className="text-sm font-bold text-on-surface">
                  {occCount(selectedLocation)}{selectedLocation.max_pallets != null ? `/${selectedLocation.max_pallets}` : ""} pallet
                  <span className="ml-2 text-xs font-medium text-on-surface-variant">
                    ({STATUS_DETAILS[effStatus(selectedLocation)].label})
                  </span>
                </span>
              </div>

              {/* 6 Trạng thái màu sắc */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-3">Trạng thái ô</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(STATUS_DETAILS).map(([key, details]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEditStatus(key as LocationStatus)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                        editStatus === key
                          ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/10 font-bold"
                          : "border-outline-variant hover:border-outline-variant bg-white text-on-surface"
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[18px] ${editStatus === key ? "text-primary" : details.textClass}`}>
                        {details.icon}
                      </span>
                      <span className="text-xs">{details.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">Loại vị trí</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as LocationType)}
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Sức chứa & Trọng tải */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">Tải tối đa (kg)</label>
                  <input
                    type="number"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                    placeholder="Ví dụ: 1500"
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">Số Pallet tối đa</label>
                  <input
                    type="number"
                    value={editPallets}
                    onChange={(e) => setEditPallets(e.target.value)}
                    placeholder="Ví dụ: 4"
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">Ghi chú vị trí</label>
                <textarea
                  rows={3}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Nhập ghi chú hoặc lý do bảo trì..."
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-surface-low">
                <button
                  type="button"
                  onClick={() => handleDeleteLocation(selectedLocation.id)}
                  className="px-4 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  Xóa
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLocation(null)}
                  className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-low"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-container flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SINGLE CREATION MODAL */}
      {showSingleModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center pb-3 border-b border-outline-variant/50 mb-5">
              <h3 className="text-lg font-bold text-on-surface">Thêm vị trí kho mới</h3>
              <button
                onClick={() => setShowSingleModal(false)}
                className="w-8 h-8 rounded-full bg-surface-low hover:bg-surface-low flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSingle} className="space-y-4">
              {/* Vị trí Khu-Kệ-Tầng */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Khu *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: A"
                    value={singleForm.zone}
                    onChange={(e) => setSingleForm({ ...singleForm, zone: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg uppercase"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Kệ (Rack) *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 03"
                    value={singleForm.rack}
                    onChange={(e) => setSingleForm({ ...singleForm, rack: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Tầng (Level) *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 02"
                    value={singleForm.level}
                    onChange={(e) => setSingleForm({ ...singleForm, level: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg"
                  />
                </div>
              </div>

              {/* Loại vị trí */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Loại vị trí</label>
                <select
                  value={singleForm.type}
                  onChange={(e) => setSingleForm({ ...singleForm, type: e.target.value as LocationType })}
                  className="w-full px-3 py-2 text-sm border border-outline-variant bg-white rounded-lg focus:outline-none"
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Sức chứa & Tải trọng */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Trọng tải tối đa (kg)</label>
                  <input
                    type="number"
                    value={singleForm.max_weight_kg}
                    onChange={(e) => setSingleForm({ ...singleForm, max_weight_kg: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Pallet tối đa</label>
                  <input
                    type="number"
                    value={singleForm.max_pallets}
                    onChange={(e) => setSingleForm({ ...singleForm, max_pallets: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg"
                  />
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Ghi chú</label>
                <textarea
                  rows={2}
                  value={singleForm.note}
                  placeholder="Nhập ghi chú bổ sung..."
                  onChange={(e) => setSingleForm({ ...singleForm, note: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg"
                />
              </div>

              <div className="pt-4 border-t border-outline-variant/50 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSingleModal(false)}
                  className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-lg text-sm hover:bg-surface-low font-medium"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold shadow-sm"
                >
                  Tạo vị trí
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK CREATION MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center pb-3 border-b border-outline-variant/50 mb-5">
              <h3 className="text-lg font-bold text-on-surface">Khởi tạo lưới kho hàng loạt</h3>
              <button
                onClick={() => setShowBulkModal(false)}
                className="w-8 h-8 rounded-full bg-surface-low hover:bg-surface-low flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateBulk} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Khu vực (Zone) *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: A, B, C"
                  value={bulkForm.zone}
                  onChange={(e) => setBulkForm({ ...bulkForm, zone: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg uppercase"
                />
              </div>

              {/* Dải Kệ và Tầng */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Kệ bắt đầu *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={bulkForm.rackFrom}
                    onChange={(e) => setBulkForm({ ...bulkForm, rackFrom: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Kệ kết thúc *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={bulkForm.rackTo}
                    onChange={(e) => setBulkForm({ ...bulkForm, rackTo: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Tầng bắt đầu *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={bulkForm.levelFrom}
                    onChange={(e) => setBulkForm({ ...bulkForm, levelFrom: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Tầng kết thúc *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={bulkForm.levelTo}
                    onChange={(e) => setBulkForm({ ...bulkForm, levelTo: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg"
                  />
                </div>
              </div>

              {/* Cấu hình chung */}
              <div>
                <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Loại vị trí áp dụng</label>
                <select
                  value={bulkForm.type}
                  onChange={(e) => setBulkForm({ ...bulkForm, type: e.target.value as LocationType })}
                  className="w-full px-3 py-2 text-sm border border-outline-variant bg-white rounded-lg focus:outline-none"
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Tải max mặc định (kg)</label>
                  <input
                    type="number"
                    value={bulkForm.max_weight_kg}
                    onChange={(e) => setBulkForm({ ...bulkForm, max_weight_kg: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant block mb-1.5">Số Pallet max mặc định</label>
                  <input
                    type="number"
                    value={bulkForm.max_pallets}
                    onChange={(e) => setBulkForm({ ...bulkForm, max_pallets: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg"
                  />
                </div>
              </div>

              {/* Dự kiến số lượng */}
              {(() => {
                const rf = parseInt(bulkForm.rackFrom);
                const rt = parseInt(bulkForm.rackTo);
                const lf = parseInt(bulkForm.levelFrom);
                const lt = parseInt(bulkForm.levelTo);
                const total = isNaN(rf) || isNaN(rt) || isNaN(lf) || isNaN(lt) || rt < rf || lt < lf
                  ? 0
                  : (rt - rf + 1) * (lt - lf + 1);
                return (
                  <div className="p-3 bg-surface-low border border-outline-variant rounded-xl text-xs font-medium text-on-surface-variant">
                    Dự kiến sẽ tạo <strong className="text-primary">{total}</strong> ô vị trí tại Khu {bulkForm.zone || "—"} (Bỏ qua các mã đã tồn tại).
                  </div>
                );
              })()}

              <div className="pt-4 border-t border-outline-variant/50 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-lg text-sm hover:bg-surface-low font-medium"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold shadow-sm"
                >
                  Bắt đầu tạo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT EXCEL MODAL (UC-MD-05 / TC_LOC_001) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ animation: "fadeIn 0.2s ease-out" }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isAnalyzing && !isImporting && setShowImportModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-[820px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden" style={{ animation: "scaleIn 0.2s ease-out" }}>

            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-surface-low px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">upload_file</span>
                Nhập vị trí kho từ Excel
              </h2>
              <button onClick={() => !isAnalyzing && !isImporting && setShowImportModal(false)} className="p-1 hover:bg-surface-low rounded-lg">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Stepper */}
            <div className="px-6 py-4 bg-surface-low border-b border-surface-low flex justify-between items-center text-xs font-semibold text-on-surface-variant">
              <div className={`flex items-center gap-2 ${importStep >= 1 ? "text-primary" : ""}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center border ${importStep > 1 ? "bg-primary text-white border-primary" : "border-primary"}`}>
                  {importStep > 1 ? "✓" : "1"}
                </span>
                Tải file Excel
              </div>
              <div className="flex-1 h-px bg-outline-variant mx-4" />
              <div className={`flex items-center gap-2 ${importStep >= 2 ? "text-primary" : ""}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center border ${importStep > 2 ? "bg-primary text-white border-primary" : importStep === 2 ? "border-primary" : "border-outline-variant"}`}>
                  {importStep > 2 ? "✓" : "2"}
                </span>
                Xem trước dữ liệu
              </div>
              <div className="flex-1 h-px bg-outline-variant mx-4" />
              <div className={`flex items-center gap-2 ${importStep === 3 ? "text-primary" : ""}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center border ${importStep === 3 ? "border-primary bg-primary text-white" : "border-outline-variant"}`}>
                  3
                </span>
                Hoàn tất
              </div>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {importError && (
                <div className="text-rose-700 text-sm font-medium bg-rose-50 p-3 rounded-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {importError}
                </div>
              )}

              {/* Step 1: Upload */}
              {importStep === 1 && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-outline-variant rounded-xl p-8 text-center bg-surface-low/30 hover:bg-surface-low/50 transition-colors relative group">
                    <input type="file" accept=".xlsx, .xls" onChange={handleImportFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <span className="material-symbols-outlined text-[48px] text-primary/60 mb-2 block group-hover:scale-110 transition-transform">
                      cloud_upload
                    </span>
                    <p className="text-sm font-medium">
                      {importFile ? importFile.name : "Kéo thả file Excel vào đây hoặc click để duyệt"}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">Hỗ trợ định dạng .xlsx, .xls</p>
                  </div>

                  <div className="flex items-center justify-between bg-primary/5 p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-[28px]">description</span>
                      <div>
                        <h4 className="text-sm font-semibold text-primary">Tải file Excel mẫu chuẩn hóa</h4>
                        <p className="text-xs text-on-surface-variant">File mẫu gồm cột Khu, Kệ, Tầng, Loại vị trí, Tải trọng, Pallet, Ghi chú.</p>
                      </div>
                    </div>
                    <button onClick={downloadLocationTemplate} className="px-3.5 py-1.5 bg-white border border-primary text-primary text-xs font-semibold rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      Tải file mẫu
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Preview */}
              {importStep === 2 && importResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-surface-low p-3 rounded-lg text-center">
                      <p className="text-xs text-on-surface-variant font-medium">Tổng số dòng</p>
                      <p className="text-xl font-bold text-primary">{importResult.summary.total}</p>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-emerald-700 font-medium">Vị trí mới</p>
                      <p className="text-xl font-bold text-emerald-700">{importResult.summary.new}</p>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-amber-700 font-medium">Trùng mã (Ghi đè)</p>
                      <p className="text-xl font-bold text-amber-700">{importResult.summary.warning}</p>
                    </div>
                    <div className="bg-rose-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-rose-700 font-medium">Lỗi (Bỏ qua)</p>
                      <p className="text-xl font-bold text-rose-700">{importResult.summary.error}</p>
                    </div>
                  </div>

                  <div className="border border-outline-variant rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-[300px]">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-surface-low sticky top-0">
                          <tr className="border-b border-outline-variant font-semibold">
                            <th className="px-3 py-2 text-center w-12">Dòng</th>
                            <th className="px-3 py-2">Mã vị trí</th>
                            <th className="px-3 py-2 text-center">Khu</th>
                            <th className="px-3 py-2 text-center">Kệ</th>
                            <th className="px-3 py-2 text-center">Tầng</th>
                            <th className="px-3 py-2">Trạng thái / Chi tiết</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-low font-normal">
                          {importResult.rows.map((row, index) => (
                            <tr key={index} className={
                              row.status === "ERROR" ? "bg-rose-50/60" :
                              row.status === "WARNING" ? "bg-amber-50/60" :
                              "bg-emerald-50/60"
                            }>
                              <td className="px-3 py-2 text-center text-on-surface-variant font-medium">{row.row_index}</td>
                              <td className="px-3 py-2 font-mono font-medium">{row.code || "—"}</td>
                              <td className="px-3 py-2 text-center font-mono">{row.zone || "—"}</td>
                              <td className="px-3 py-2 text-center font-mono">{row.rack || "—"}</td>
                              <td className="px-3 py-2 text-center font-mono">{row.level || "—"}</td>
                              <td className="px-3 py-2 font-medium">
                                <span className={
                                  row.status === "ERROR" ? "text-rose-700" :
                                  row.status === "WARNING" ? "text-amber-700" :
                                  "text-emerald-700"
                                }>
                                  {row.status === "ERROR" ? "Lỗi: " : row.status === "WARNING" ? "Cảnh báo: " : "Hợp lệ: "}
                                  {row.status_message}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Success */}
              {importStep === 3 && (
                <div className="py-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                    <span className="material-symbols-outlined text-[40px]">check_circle</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-primary">Nhập dữ liệu hoàn tất!</h3>
                    <p className="text-sm text-on-surface-variant mt-1">{importSuccessMsg}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-surface-low px-6 py-4 flex justify-end gap-3 z-10">
              {importStep === 1 && (
                <>
                  <button type="button" onClick={() => setShowImportModal(false)} className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-low">
                    Hủy
                  </button>
                  <button type="button" disabled={!importFile || isAnalyzing} onClick={handleUploadAndAnalyze} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover flex items-center gap-2 disabled:opacity-60">
                    {isAnalyzing ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang phân tích...</>
                    ) : (
                      <><span className="material-symbols-outlined text-[18px]">analytics</span>Phân tích file</>
                    )}
                  </button>
                </>
              )}

              {importStep === 2 && (
                <>
                  <button type="button" disabled={isImporting} onClick={() => setImportStep(1)} className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-low">
                    Quay lại
                  </button>
                  <button type="button" disabled={isImporting || (importResult?.rows.filter((r) => r.status !== "ERROR").length ?? 0) === 0} onClick={handleConfirmImport} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover flex items-center gap-2 disabled:opacity-60">
                    {isImporting ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang nhập...</>
                    ) : (
                      <><span className="material-symbols-outlined text-[18px]">done_all</span>Xác nhận nhập</>
                    )}
                  </button>
                </>
              )}

              {importStep === 3 && (
                <button type="button" onClick={() => setShowImportModal(false)} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover">
                  Đóng
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
    </AppLayout>
  );
}
