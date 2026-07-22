"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ExcelExport } from "@/components/ExcelExport";
import { useToast } from "@/components/ui";
import { auth } from "@/lib/auth";

interface ProductGroup {
  id: string;
  name: string;
  description?: string;
  _count?: { products: number };
}

interface UnitOfMeasure {
  id: string;
  name: string;
  symbol?: string;
}

interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  short_name?: string;
  group_id?: string;
  unit_id?: string;
  specification?: string;
  units_per_box?: number;
  weight_per_box?: number;
  volume_per_box?: number;
  manage_lot: boolean;
  manage_expiry: boolean;
  min_stock: number;
  max_stock?: number;
  is_active: boolean;
  created_at: string;
  group?: { id: string; name: string };
  unit?: { id: string; name: string; symbol?: string };
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const EMPTY_FORM = {
  sku: "",
  barcode: "",
  name: "",
  short_name: "",
  group_id: "",
  unit_id: "",
  specification: "",
  units_per_box: "1",
  weight_per_box: "",
  volume_per_box: "",
  manage_lot: false,
  manage_expiry: false,
  min_stock: "0",
  max_stock: "",
  // Phase 5.2 — TC_MD_001/_005, row 36: track is_active rõ ràng (trước đó
  // không có trong form state → openEditModal không phục hồi trạng thái cũ,
  // submit luôn ghi đè về true).
  is_active: true,
};

// ===== TC_ADD_005 / TC_ADD_006: ràng buộc nhập liệu cho các trường số =====
// Vấn đề gốc: <input type="number"> mặc định VẪN cho gõ "e", "E", "+", "-" và
// khi sai định dạng trình duyệt bật thông báo tiếng Anh "Please enter a number."
// → (1) chặn phím không phải số ngay khi gõ, (2) chặn paste rác,
//   (3) ép thông báo lỗi sang tiếng Việt "Trường chỉ cho phép nhập số".
const NUMERIC_ONLY_MSG = "Trường chỉ cho phép nhập số";

// Chặn phím: chỉ cho 0-9 (và 1 dấu "." nếu là trường thập phân). Bỏ qua tổ hợp
// phím (Ctrl/Cmd/Alt → copy/paste/cut/shortcut) và phím chức năng/điều hướng
// (Backspace, Delete, Tab, mũi tên, F5… đều có key.length > 1).
const blockNonNumericKey =
  (allowDecimal: boolean) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length > 1) return;
    if (e.key >= "0" && e.key <= "9") return;
    if (allowDecimal && e.key === "." && !e.currentTarget.value.includes(".")) return;
    e.preventDefault();
  };

// Chặn dán (paste) chuỗi chứa chữ cái / ký tự đặc biệt / số âm.
const blockNonNumericPaste =
  (allowDecimal: boolean) => (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    const re = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/;
    if (!re.test(text)) e.preventDefault();
  };

// Thông báo lỗi tiếng Việt cho input số (thay native "Please enter a number.").
// positive=true → trường bắt buộc > 0 (trọng lượng) giữ thông báo riêng cho TC_ADD_009.
const numberFieldInvalid =
  (label: string, positive = false) =>
  (e: React.FormEvent<HTMLInputElement>) => {
    const v = e.currentTarget.validity;
    if (v.badInput || v.typeMismatch) {
      e.currentTarget.setCustomValidity(NUMERIC_ONLY_MSG);
    } else if (v.valueMissing) {
      e.currentTarget.setCustomValidity(`Vui lòng nhập ${label}.`);
    } else if (v.rangeUnderflow || v.stepMismatch || v.rangeOverflow) {
      e.currentTarget.setCustomValidity(
        positive ? "Chỉ được phép nhập giá trị lớn hơn 0" : `${label} không hợp lệ.`
      );
    } else {
      e.currentTarget.setCustomValidity(NUMERIC_ONLY_MSG);
    }
  };

// ===== TC_ADD_017: bộ cột Excel DÙNG CHUNG cho "Xuất Excel" và "Mẫu Import" =====
// Trước đây cột Xuất ("Tên đầy đủ", "KL/thùng (kg)", "TT/thùng (m³)"…) KHÁC tên cột
// trong file mẫu Import nên file vừa xuất ra đem nhập lại bị chặn "sai định dạng"
// (parser tìm "tên sản phẩm"/"trọng lượng" nhưng không thấy) → user không biết phải
// nhập theo mẫu nào. Nay 2 nơi dùng CHUNG danh sách này; mọi header đều được parser
// import nhận diện (xem api/products/import-excel/route.ts) → "Xuất → Nhập lại" luôn khớp.
// Lưu ý: chỉ gồm các cột import xử lý được. Min/Tồn tối đa/Trạng thái KHÔNG đưa vào vì
// luồng import không ghi các trường này (tránh xuất ra cột mà nhập lại bị bỏ qua).
const PRODUCT_EXCEL_COLUMNS: {
  header: string;
  key: string;
  transform?: (value: unknown) => string | number;
  sample: (string | number)[];
}[] = [
  { header: "Mã SKU (*)", key: "sku", sample: ["SKU-TEST-001", "SKU-TEST-002"] },
  { header: "Mã vạch (Barcode)", key: "barcode", sample: ["8931234567890", "8931234567891"] },
  { header: "Tên sản phẩm (*)", key: "name", sample: ["Ván MDF phủ Melamine 18mm", "Gỗ dán Poly 9mm"] },
  { header: "Tên rút gọn (*)", key: "short_name", sample: ["MDF Melamine 18", "Poly 9mm"] },
  { header: "Nhóm hàng", key: "group", transform: (v) => (v as { name?: string })?.name || "", sample: ["Ván công nghiệp", "Gỗ dán"] },
  { header: "Đơn vị tính (*)", key: "unit", transform: (v) => (v as { name?: string })?.name || "", sample: ["Tấm", "Tấm"] },
  { header: "Quy cách (*)", key: "specification", sample: ["1220x2440x18mm", "1220x2440x9mm"] },
  { header: "Trọng lượng / thùng (kg) (*)", key: "weight_per_box", sample: [32.5, 16.2] },
  { header: "Thể tích / thùng (m3)", key: "volume_per_box", sample: [0.053, 0.026] },
  { header: "Quản lý Lô (1: Có, 0: Không)", key: "manage_lot", transform: (v) => (v ? 1 : 0), sample: [0, 1] },
  { header: "Quản lý HSD (1: Có, 0: Không)", key: "manage_expiry", transform: (v) => (v ? 1 : 0), sample: [0, 1] },
];

export default function MasterDataPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 0 });

  // Filters
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  // UI
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);

  // Import Excel State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState(1); // 1: Upload, 2: Preview, 3: Success
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    rows: any[];
    summary: { total: number; new: number; warning: number; error: number };
  } | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState("");

  const openImportModal = () => {
    setImportFile(null);
    setImportStep(1);
    setImportError("");
    setImportResult(null);
    setShowImportModal(true);
  };

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch groups + units (once)
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [gRes, uRes] = await Promise.all([
          fetch(`${basePath}/api/product-groups`),
          fetch(`${basePath}/api/units`),
        ]);
        const gData = await gRes.json();
        const uData = await uRes.json();
        if (gData.success) setGroups(gData.data);
        if (uData.success) setUnits(uData.data);
      } catch { /* silent */ }
    };
    fetchMeta();
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterGroup) params.set("groupId", filterGroup);
      if (filterStatus) params.set("status", filterStatus);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("page", page.toString());
      params.set("limit", "10");

      const res = await fetch(`${basePath}/api/products?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
        setPagination(data.pagination);
      }
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, [search, filterGroup, filterStatus, sortBy, sortOrder, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const fetchAllProductsForExport = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterGroup) params.set("groupId", filterGroup);
      if (filterStatus) params.set("status", filterStatus);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("page", "1");
      params.set("limit", "100000");

      const res = await fetch(`${basePath}/api/products?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        return data.data as Record<string, unknown>[];
      }
      throw new Error(data.error || "Lỗi tải dữ liệu");
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [search, filterGroup, filterStatus, sortBy, sortOrder, basePath]);

  // Debounced search
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
    }, 300);
  };

  // Sort handler
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  // Open add modal
  const openAddModal = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  // Open edit modal
  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setForm({
      sku: p.sku,
      barcode: p.barcode || "",
      name: p.name,
      short_name: p.short_name || "",
      group_id: p.group_id || "",
      unit_id: p.unit_id || "",
      specification: p.specification || "",
      units_per_box: (p.units_per_box ?? 1).toString(),
      weight_per_box: p.weight_per_box?.toString() || "",
      volume_per_box: p.volume_per_box?.toString() || "",
      manage_lot: p.manage_lot,
      manage_expiry: p.manage_expiry,
      min_stock: p.min_stock.toString(),
      max_stock: p.max_stock?.toString() || "",
      is_active: p.is_active !== false,
    });
    setFormError("");
    setShowModal(true);
  };

  // Submit form (create/update) — hỗ trợ "Lưu & Thêm mới" (TC_ADD_001)
  // Phase 5.2 — TC_ADD_003: tổng hợp tất cả lỗi cùng lúc (trước fix chỉ
  // báo lỗi đầu tiên gặp); TC_ADD_009: trọng lượng > 0 + thông báo tiếng Việt.
  const handleSubmit = async (e: React.FormEvent, saveAndNew = false) => {
    e.preventDefault();
    if (formLoading) return;
    setFormError("");

    const errors: string[] = [];
    if (!form.sku.trim()) errors.push("Mã SKU");
    if (!form.name.trim()) errors.push("Tên sản phẩm");
    if (!form.short_name.trim()) errors.push("Tên rút gọn");
    if (!form.unit_id) errors.push("Đơn vị tính");
    if (!form.specification.trim()) errors.push("Quy cách");
    if (!form.weight_per_box) errors.push("Trọng lượng / thùng");

    if (errors.length > 0) {
      setFormError(`Vui lòng nhập đầy đủ các trường bắt buộc: ${errors.join(", ")}.`);
      return;
    }

    // Validate giá trị số — TC_ADD_009: trọng lượng phải > 0, các trường khác >= 0
    if (form.weight_per_box) {
      const w = parseFloat(form.weight_per_box);
      if (Number.isNaN(w)) { setFormError("Trọng lượng / thùng phải là số hợp lệ."); return; }
      if (w <= 0) { setFormError("Chỉ được phép nhập giá trị lớn hơn 0 cho Trọng lượng / thùng."); return; }
    }
    if (form.volume_per_box) {
      const v = parseFloat(form.volume_per_box);
      if (Number.isNaN(v)) { setFormError("Thể tích / thùng phải là số hợp lệ."); return; }
      if (v < 0) { setFormError("Thể tích / thùng phải lớn hơn hoặc bằng 0."); return; }
    }
    if (form.min_stock && Number.isNaN(parseInt(form.min_stock))) {
      setFormError("Tồn tối thiểu phải là số nguyên hợp lệ."); return;
    }
    if (form.max_stock && Number.isNaN(parseInt(form.max_stock))) {
      setFormError("Tồn tối đa phải là số nguyên hợp lệ."); return;
    }

    setFormLoading(true);
    try {
      const payload = {
        sku: form.sku.trim(),
        barcode: form.barcode.trim() || null,
        name: form.name.trim(),
        short_name: form.short_name.trim() || null,
        group_id: form.group_id || null,
        unit_id: form.unit_id || null,
        specification: form.specification.trim() || null,
        units_per_box: parseInt(form.units_per_box, 10) || 1,
        weight_per_box: form.weight_per_box ? parseFloat(form.weight_per_box) : null,
        volume_per_box: form.volume_per_box ? parseFloat(form.volume_per_box) : null,
        manage_lot: form.manage_lot,
        manage_expiry: form.manage_expiry,
        min_stock: parseInt(form.min_stock) || 0,
        max_stock: form.max_stock ? parseInt(form.max_stock) : null,
        // Phase 5.2 — TC_MD_001/_005: gửi is_active rõ ràng để PUT update đúng
        is_active: form.is_active,
      };

      const url = editingProduct ? `${basePath}/api/products/${editingProduct.id}` : `${basePath}/api/products`;
      const method = editingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.getToken() ?? ""}`,
        },
        body: JSON.stringify(payload),
      });
      // TC_PERMISSION_005: phiên hết hạn/không hợp lệ → xóa token + về trang đăng nhập.
      if (res.status === 401) {
        auth.removeToken();
        window.location.href = `${basePath}/auth`;
        return;
      }
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Thao tác thất bại.");
        setFormLoading(false);
        return;
      }

      // Hiển thị thông báo cascade khi weight/units_per_box đổi
      if (data.cascade && data.cascade.lines_updated > 0) {
        toast.success(
          `Đã cập nhật ${data.cascade.lines_updated} dòng hàng trong ${data.cascade.pallets_updated} pallet còn hoạt động (${data.cascade.pallet_codes.slice(0, 3).join(", ")}${data.cascade.pallet_codes.length > 3 ? "…" : ""}). Pallet đã xuất/hủy không bị ảnh hưởng.`
        );
      }

      // "Lưu & Thêm mới": reset form, giữ modal mở
      if (saveAndNew && !editingProduct) {
        setForm(EMPTY_FORM);
        setFormError("");
        fetchProducts();
      } else {
        setShowModal(false);
        fetchProducts();
      }
    } catch {
      setFormError("Lỗi kết nối mạng.");
    } finally {
      setFormLoading(false);
    }
  };

  const { toast } = useToast();

  // Delete product
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(`${basePath}/api/products/${deleteConfirm.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.getToken() ?? ""}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Xóa thất bại.");
        setDeleteConfirm(null);
        return;
      }
      setDeleteConfirm(null);
      toast.success("Đã xóa sản phẩm");
      fetchProducts();
    } catch {
      toast.error("Lỗi kết nối mạng.");
    }
  };

  const downloadTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      // TC_ADD_017: header + dữ liệu mẫu lấy từ CÙNG bộ cột với nút Xuất Excel
      // → file mẫu và file xuất luôn khớp nhau, nhập lại không lệch cột.
      const headers = PRODUCT_EXCEL_COLUMNS.map((c) => c.header);
      const sampleCount = Math.max(...PRODUCT_EXCEL_COLUMNS.map((c) => c.sample.length));
      const sampleRows = Array.from({ length: sampleCount }, (_, i) =>
        PRODUCT_EXCEL_COLUMNS.map((c) => c.sample[i] ?? "")
      );
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh sach san pham");
      XLSX.writeFile(wb, "mau_import_san_pham.xlsx");
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải file mẫu. Vui lòng thử lại.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      const res = await fetch(`${basePath}/api/products/import-excel`, {
        method: "POST",
        body: formData,
      });
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
      const res = await fetch(`${basePath}/api/products/import-excel/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: importResult.rows }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        setImportError(resData.error || "Nhập sản phẩm thất bại.");
        return;
      }
      setImportSuccessMsg(resData.message || "Nhập thành công!");
      setImportStep(3);
      fetchProducts();
    } catch {
      setImportError("Lỗi kết nối mạng khi ghi nhận nhập dữ liệu.");
    } finally {
      setIsImporting(false);
    }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <span className="material-symbols-outlined text-[14px] ml-1 opacity-50">
      {sortBy === field ? (sortOrder === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
    </span>
  );

  return (
    <AppLayout title="DANH MỤC SẢN PHẨM">
      <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="headline-md text-primary">Danh mục Sản phẩm</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Quản lý SKU và mã hàng trong hệ thống kho
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* UC-MD-01: Xuất Excel — TC_ADD_017: dùng CHUNG bộ cột với file mẫu
                Import (PRODUCT_EXCEL_COLUMNS) để file xuất ra nhập lại được ngay. */}
            <ExcelExport
              fetchData={fetchAllProductsForExport}
              columns={PRODUCT_EXCEL_COLUMNS.map(({ header, key, transform }) => ({ header, key, transform }))}
              filename="san_pham"
              label="Xuất Excel"
            />
            <button onClick={openImportModal} className="px-4 py-2 border border-primary text-primary rounded-lg text-sm hover:bg-primary/5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              Nhập từ Excel
            </button>
            <button onClick={openAddModal} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-container flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Thêm sản phẩm
            </button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <label className="label-caps text-on-surface-variant block mb-1">Tìm kiếm SKU / Tên</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
                <input type="text" placeholder="Nhập SKU hoặc tên sản phẩm..." value={search} onChange={(e) => handleSearch(e.target.value)} className="w-full pl-10 pr-3 py-2 bg-surface-low rounded-lg border-0 text-sm focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="label-caps text-on-surface-variant block mb-1">Nhóm hàng</label>
              <select value={filterGroup} onChange={(e) => { setFilterGroup(e.target.value); setPage(1); }} className="w-full px-3 py-2 bg-surface-low rounded-lg border-0 text-sm focus:ring-2 focus:ring-primary/20">
                <option value="">Tất cả nhóm hàng</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label-caps text-on-surface-variant block mb-1">Trạng thái</label>
              <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="w-full px-3 py-2 bg-surface-low rounded-lg border-0 text-sm focus:ring-2 focus:ring-primary/20">
                <option value="">Tất cả</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Ngừng hoạt động</option>
              </select>
            </div>
            <div className="md:col-span-1 flex items-end">
              <button onClick={() => { setSearch(""); setFilterGroup(""); setFilterStatus(""); setPage(1); }} className="w-full p-2 bg-surface-low rounded-lg hover:bg-surface-mid transition-colors flex items-center justify-center" title="Xóa bộ lọc">
                <span className="material-symbols-outlined text-on-surface-variant">filter_alt_off</span>
              </button>
            </div>
          </div>
        </Card>

        {/* Products Table */}
        <Card className="rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 760 }}>
              <thead className="bg-surface-low">
                <tr className="text-left label-caps text-on-surface-variant">
                  <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort("sku")}>MÃ SKU<SortIcon field="sku" /></th>
                  <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort("name")}>TÊN SẢN PHẨM<SortIcon field="name" /></th>
                  <th className="px-4 py-3 hidden lg:table-cell">NHÓM HÀNG</th>
                  <th className="px-4 py-3">ĐVT</th>
                  <th className="px-4 py-3 hidden md:table-cell">QUY CÁCH</th>
                  <th className="px-4 py-3 hidden lg:table-cell text-right">KL/THÙNG</th>
                  <th className="px-4 py-3 hidden lg:table-cell text-right">TT/THÙNG</th>
                  <th className="px-4 py-3">TRẠNG THÁI</th>
                  <th className="px-4 py-3 text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-on-surface-variant">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      Đang tải dữ liệu...
                    </div>
                  </td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-[32px] mb-2 block opacity-40">inventory_2</span>
                    Không có dữ liệu
                  </td></tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="border-t border-surface-low hover:bg-surface-low/50">
                      <td className="px-4 py-3 data-mono font-medium">{p.sku}</td>
                      <td className="px-4 py-3">
                        <div>{p.name}</div>
                        {p.short_name && <div className="text-xs text-on-surface-variant">{p.short_name}</div>}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant hidden lg:table-cell">{p.group?.name || "—"}</td>
                      <td className="px-4 py-3">{p.unit?.name || "—"}</td>
                      <td className="px-4 py-3 text-on-surface-variant text-xs hidden md:table-cell">{p.specification || "—"}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs hidden lg:table-cell">
                        {p.weight_per_box ? `${Number(p.weight_per_box).toFixed(2)} kg` : <span className="text-on-surface-variant/70">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs hidden lg:table-cell">
                        {p.volume_per_box ? `${Number(p.volume_per_box).toFixed(4)} m³` : <span className="text-on-surface-variant/70">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {p.is_active ? (
                          <Badge variant="success">HOẠT ĐỘNG</Badge>
                        ) : (
                          <Badge variant="error">NGỪNG</Badge>
                        )}
                        <div className="flex gap-1 mt-1">
                          {p.manage_lot && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">LÔ</span>}
                          {p.manage_expiry && <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded font-medium">HSD</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEditModal(p)} className="p-1 hover:bg-surface-mid rounded transition-colors mr-1" title="Sửa">
                          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit</span>
                        </button>
                        <button onClick={() => setDeleteConfirm(p)} className="p-1 hover:bg-error/10 rounded transition-colors" title="Xóa">
                          <span className="material-symbols-outlined text-[18px] text-error">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-low">
              <span className="text-xs text-on-surface-variant">
                Hiển thị {(page - 1) * 10 + 1} - {Math.min(page * 10, pagination.total)} trong số {pagination.total} sản phẩm
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1} className="p-1 rounded hover:bg-surface-low disabled:opacity-30">
                  <span className="material-symbols-outlined text-[18px]">first_page</span>
                </button>
                <button onClick={() => setPage(page - 1)} disabled={page === 1} className="p-1 rounded hover:bg-surface-low disabled:opacity-30">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-on-surface-variant">...</span>}
                      <button onClick={() => setPage(p)} className={`w-8 h-8 rounded text-sm font-medium ${p === page ? "bg-primary text-white" : "hover:bg-surface-low"}`}>{p}</button>
                    </React.Fragment>
                  ))}
                <button onClick={() => setPage(page + 1)} disabled={page === pagination.totalPages} className="p-1 rounded hover:bg-surface-low disabled:opacity-30">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
                <button onClick={() => setPage(pagination.totalPages)} disabled={page === pagination.totalPages} className="p-1 rounded hover:bg-surface-low disabled:opacity-30">
                  <span className="material-symbols-outlined text-[18px]">last_page</span>
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* KPI Footer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 rounded-lg">
            <p className="label-caps text-on-surface-variant mb-1">TỔNG SẢN PHẨM</p>
            <p className="text-2xl font-bold text-primary" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{pagination.total}</p>
            <p className="text-xs text-on-surface-variant mt-1">Trong hệ thống</p>
          </Card>
          <Card className="p-5 rounded-lg">
            <p className="label-caps text-on-surface-variant mb-1">ĐANG HOẠT ĐỘNG</p>
            <p className="text-2xl font-bold text-success" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{products.filter(p => p.is_active).length}</p>
            <p className="text-xs text-on-surface-variant mt-1">Trên trang hiện tại</p>
          </Card>
          <Card className="p-5 rounded-lg">
            <p className="label-caps text-on-surface-variant mb-1">QUẢN LÝ HSD</p>
            <p className="text-2xl font-bold text-warning" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{products.filter(p => p.manage_expiry).length}</p>
            <p className="text-xs text-on-surface-variant mt-1">Sản phẩm cần theo dõi FEFO</p>
          </Card>
        </div>
      </div>

      {/* ====== MODAL THÊM/SỬA SẢN PHẨM ====== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ animation: "fadeIn 0.2s ease-out" }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-[680px] max-w-[95vw] max-h-[90vh] overflow-y-auto" style={{ animation: "scaleIn 0.2s ease-out" }}>
            <div className="sticky top-0 bg-white border-b border-surface-low px-6 py-4 flex items-center justify-between z-10">
              <h2 className="headline-sm text-primary">{editingProduct ? "Sửa sản phẩm" : "Thêm sản phẩm mới"}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-surface-low rounded-lg">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="text-error text-sm font-medium bg-error/5 p-3 rounded-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {formError}
                </div>
              )}

              {/* Row 1: SKU + Mã vạch */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-caps text-on-surface-variant block mb-1">Mã SKU <span className="text-error">*</span></label>
                  <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="VD: SKU-VG-0001" />
                </div>
                <div>
                  <label className="label-caps text-on-surface-variant block mb-1">Mã vạch (Barcode)</label>
                  <input type="text" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="VD: 8934673000123" />
                </div>
              </div>

              {/* Row 2: Tên đầy đủ + Tên rút gọn */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-caps text-on-surface-variant block mb-1">Tên sản phẩm <span className="text-error">*</span></label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Tên đầy đủ sản phẩm" />
                </div>
                <div>
                  <label className="label-caps text-on-surface-variant block mb-1">Tên rút gọn <span className="text-error">*</span></label>
                  <input type="text" value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="VD: MDF 18 Oak" />
                </div>
              </div>

              {/* Row 3: Số lẻ/thùng + ĐVT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-caps text-on-surface-variant block mb-1">
                    Số lẻ / thùng <span className="text-error">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={form.units_per_box}
                    onKeyDown={blockNonNumericKey(false)}
                    onPaste={blockNonNumericPaste(false)}
                    onInvalid={numberFieldInvalid("Số lẻ / thùng")}
                    onChange={(e) => {
                      e.currentTarget.setCustomValidity("");
                      setForm({ ...form, units_per_box: e.target.value });
                    }}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="VD: 24 (24 chai/thùng)"
                  />
                  <p className="text-[10px] text-on-surface-variant/70 mt-1">
                    Bao nhiêu đơn vị lẻ trong 1 thùng. Đặt = 1 nếu hàng bán theo thùng (1 thùng = 1 đv lẻ).
                  </p>
                </div>
                <div>
                  <label className="label-caps text-on-surface-variant block mb-1">Đơn vị tính <span className="text-error">*</span></label>
                  <select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary">
                    <option value="">— Chọn ĐVT —</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 3b: Mô tả kích thước (optional) */}
              <div>
                <label className="label-caps text-on-surface-variant block mb-1">Mô tả kích thước (tuỳ chọn)</label>
                <input
                  type="text"
                  value={form.specification}
                  onChange={(e) => setForm({ ...form, specification: e.target.value })}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="VD: 2440x1220x18mm hoặc 500ml/chai"
                />
              </div>

              {/* Row 4: Nhóm hàng + Trạng thái */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-caps text-on-surface-variant block mb-1">Nhóm hàng</label>
                  <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary">
                    <option value="">— Chọn nhóm —</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-caps text-on-surface-variant block mb-1">Trạng thái</label>
                  {/* Phase 5.2 — TC_MD_001/_005, row 36: dùng form.is_active trực tiếp */}
                  <select
                    value={form.is_active ? "active" : "inactive"}
                    onChange={(e) => setForm({ ...form, is_active: e.target.value === "active" })}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="active">Đang hoạt động</option>
                    <option value="inactive">Ngừng hoạt động</option>
                  </select>
                </div>
              </div>

              {/* Row 5: Trọng lượng + Thể tích — Phase 5.2 row 35/TC_ADD_009:
                  min phải > 0 (không cho phép = 0), HTML5 placeholder + step.
                  Validate thực tế ở handleSubmit để báo lỗi tiếng Việt. */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-caps text-on-surface-variant block mb-1">Trọng lượng / thùng (kg) <span className="text-error">*</span></label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    inputMode="decimal"
                    value={form.weight_per_box}
                    onKeyDown={blockNonNumericKey(true)}
                    onPaste={blockNonNumericPaste(true)}
                    onChange={(e) => {
                      // TC_ADD_009: clear custom message khi user nhập lại
                      e.currentTarget.setCustomValidity("");
                      setForm({ ...form, weight_per_box: e.target.value });
                    }}
                    // TC_ADD_006 (chữ → "chỉ cho phép nhập số") + TC_ADD_009 (≤ 0 → "> 0")
                    onInvalid={numberFieldInvalid("Trọng lượng / thùng", true)}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="VD: 12.500"
                  />
                </div>
                <div>
                  <label className="label-caps text-on-surface-variant block mb-1">Thể tích / thùng (m³)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    inputMode="decimal"
                    value={form.volume_per_box}
                    onKeyDown={blockNonNumericKey(true)}
                    onPaste={blockNonNumericPaste(true)}
                    onInvalid={numberFieldInvalid("Thể tích / thùng")}
                    onChange={(e) => {
                      e.currentTarget.setCustomValidity("");
                      setForm({ ...form, volume_per_box: e.target.value });
                    }}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="VD: 0.025"
                  />
                </div>
              </div>

              {/* Row 5: Min/Max stock — Phase 5.2 row 50: chỉ hiển thị khi TẠO mới
                  (form Sửa SP yêu cầu bỏ field này). */}
              {!editingProduct && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label-caps text-on-surface-variant block mb-1">Tồn tối thiểu</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={form.min_stock}
                      onKeyDown={blockNonNumericKey(false)}
                      onPaste={blockNonNumericPaste(false)}
                      onInvalid={numberFieldInvalid("Tồn tối thiểu")}
                      onChange={(e) => {
                        e.currentTarget.setCustomValidity("");
                        setForm({ ...form, min_stock: e.target.value });
                      }}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="label-caps text-on-surface-variant block mb-1">Tồn tối đa</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={form.max_stock}
                      onKeyDown={blockNonNumericKey(false)}
                      onPaste={blockNonNumericPaste(false)}
                      onInvalid={numberFieldInvalid("Tồn tối đa")}
                      onChange={(e) => {
                        e.currentTarget.setCustomValidity("");
                        setForm({ ...form, max_stock: e.target.value });
                      }}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="Không giới hạn"
                    />
                  </div>
                </div>
              )}

              {/* Row 6: Toggles */}
              <div className="flex gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.manage_lot} onChange={(e) => setForm({ ...form, manage_lot: e.target.checked })} className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20" />
                  <span className="text-sm">Quản lý Lô</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.manage_expiry} onChange={(e) => setForm({ ...form, manage_expiry: e.target.checked })} className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20" />
                  <span className="text-sm">Quản lý HSD (FEFO)</span>
                </label>
              </div>

              {/* Actions — TC_ADD_001: Lưu / Lưu & Thêm mới / Hủy */}
              <div className="flex justify-end gap-3 pt-4 border-t border-surface-low">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-low">
                  Hủy
                </button>
                {!editingProduct && (
                  <button type="button" disabled={formLoading} onClick={(e) => handleSubmit(e as unknown as React.FormEvent, true)} className="px-5 py-2.5 border border-primary text-primary rounded-lg text-sm hover:bg-primary/5 flex items-center gap-2 disabled:opacity-60">
                    {formLoading ? (
                      <><div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> Đang lưu...</>
                    ) : (
                      <><span className="material-symbols-outlined text-[18px]">add_circle</span>Lưu &amp; Thêm mới</>
                    )}
                  </button>
                )}
                <button type="submit" disabled={formLoading} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-container flex items-center gap-2 disabled:opacity-60">
                  {formLoading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang lưu...</>
                  ) : (
                    <><span className="material-symbols-outlined text-[18px]">save</span>{editingProduct ? "Cập nhật" : "Lưu"}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== CONFIRM DELETE ====== */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 w-[420px] max-w-[90vw]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-error/10 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-error">delete_forever</span>
              </div>
              <div>
                <h3 className="font-semibold text-primary">Xác nhận xóa</h3>
                <p className="text-sm text-on-surface-variant">Hành động này không thể hoàn tác.</p>
              </div>
            </div>
            <p className="text-sm mb-5">
              Bạn có chắc chắn muốn xóa sản phẩm <strong>{deleteConfirm.sku}</strong> — <em>{deleteConfirm.name}</em>?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-outline-variant rounded-lg text-sm hover:bg-surface-low">Hủy</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-error text-white rounded-lg text-sm hover:bg-error/90 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">delete</span> Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== MODAL IMPORT EXCEL (UC-MD-01) ====== */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ animation: "fadeIn 0.2s ease-out" }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isAnalyzing && !isImporting && setShowImportModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-[800px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden" style={{ animation: "scaleIn 0.2s ease-out" }}>
            
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-surface-low px-6 py-4 flex items-center justify-between z-10">
              <h2 className="headline-sm text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">upload_file</span>
                Nhập sản phẩm từ Excel
              </h2>
              <button onClick={() => !isAnalyzing && !isImporting && setShowImportModal(false)} className="p-1 hover:bg-surface-low rounded-lg">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Stepper Timeline */}
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

            {/* Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {importError && (
                <div className="text-error text-sm font-medium bg-error/5 p-3 rounded-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {importError}
                </div>
              )}

              {/* Step 1: Upload File */}
              {importStep === 1 && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-outline-variant rounded-xl p-8 text-center bg-surface-low/30 hover:bg-surface-low/50 transition-colors relative group">
                    <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <span className="material-symbols-outlined text-[48px] text-primary/60 mb-2 block group-hover:scale-110 transition-transform">
                      cloud_upload
                    </span>
                    <p className="text-sm font-medium">
                      {importFile ? importFile.name : "Kéo thả file Excel vào đây hoặc click để duyệt"}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Hỗ trợ định dạng .xlsx, .xls (Tối đa 5MB)
                    </p>
                  </div>

                  <div className="flex items-center justify-between bg-primary/5 p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-[28px]">description</span>
                      <div>
                        <h4 className="text-sm font-semibold text-primary">Tải file Excel mẫu chuẩn hóa</h4>
                        <p className="text-xs text-on-surface-variant">Sử dụng file mẫu này để tránh lỗi định dạng cột.</p>
                      </div>
                    </div>
                    <button onClick={downloadTemplate} className="px-3.5 py-1.5 bg-white border border-primary text-primary text-xs font-semibold rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      Tải file mẫu
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Preview Data */}
              {importStep === 2 && importResult && (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-surface-low p-3 rounded-lg text-center">
                      <p className="text-xs text-on-surface-variant font-medium">Tổng số dòng</p>
                      <p className="text-xl font-bold text-primary">{importResult.summary.total}</p>
                    </div>
                    <div className="bg-success/5 p-3 rounded-lg text-center">
                      <p className="text-xs text-success font-medium">Sản phẩm mới</p>
                      <p className="text-xl font-bold text-success">{importResult.summary.new}</p>
                    </div>
                    <div className="bg-warning/5 p-3 rounded-lg text-center">
                      <p className="text-xs text-warning font-medium">Trùng SKU (Ghi đè)</p>
                      <p className="text-xl font-bold text-warning">{importResult.summary.warning}</p>
                    </div>
                    <div className="bg-error/5 p-3 rounded-lg text-center">
                      <p className="text-xs text-error font-medium">Lỗi (Bỏ qua)</p>
                      <p className="text-xl font-bold text-error">{importResult.summary.error}</p>
                    </div>
                  </div>

                  {/* Detail Table */}
                  <div className="border border-outline-variant rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-[300px]">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-surface-low sticky top-0">
                          <tr className="border-b border-outline-variant font-semibold">
                            <th className="px-3 py-2 text-center w-12">Dòng</th>
                            <th className="px-3 py-2">Mã SKU</th>
                            <th className="px-3 py-2">Tên sản phẩm</th>
                            <th className="px-3 py-2">ĐVT</th>
                            <th className="px-3 py-2">Nhóm hàng</th>
                            <th className="px-3 py-2">Trạng thái / Chi tiết</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-low font-normal">
                          {importResult.rows.map((row, index) => (
                            <tr key={index} className={
                              row.status === "ERROR" ? "bg-error/5" :
                              row.status === "WARNING" ? "bg-warning/5" :
                              "bg-success/5"
                            }>
                              <td className="px-3 py-2 text-center text-on-surface-variant font-medium">{row.row_index}</td>
                              <td className="px-3 py-2 font-mono font-medium">{row.sku || "—"}</td>
                              <td className="px-3 py-2">
                                <div>{row.name || "—"}</div>
                                {row.barcode && <span className="text-[10px] bg-white px-1 py-0.5 border rounded text-on-surface-variant font-mono">Barcode: {row.barcode}</span>}
                              </td>
                              <td className="px-3 py-2">{row.unit_name || "—"}</td>
                              <td className="px-3 py-2">{row.group_name || "—"}</td>
                              <td className="px-3 py-2 font-medium">
                                <span className={
                                  row.status === "ERROR" ? "text-error" :
                                  row.status === "WARNING" ? "text-warning" :
                                  "text-success"
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

              {/* Step 3: Success Completed */}
              {importStep === 3 && (
                <div className="py-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto text-success">
                    <span className="material-symbols-outlined text-[40px]">check_circle</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-primary">Nhập dữ liệu hoàn tất!</h3>
                    <p className="text-sm text-on-surface-variant mt-1">
                      {importSuccessMsg}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t border-surface-low px-6 py-4 flex justify-end gap-3 z-10">
              {importStep === 1 && (
                <>
                  <button type="button" onClick={() => setShowImportModal(false)} className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-low">
                    Hủy
                  </button>
                  <button type="button" disabled={!importFile || isAnalyzing} onClick={handleUploadAndAnalyze} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-container flex items-center gap-2 disabled:opacity-60">
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
                  <button type="button" disabled={isImporting || importResult?.rows.filter(r => r.status !== "ERROR").length === 0} onClick={handleConfirmImport} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-container flex items-center gap-2 disabled:opacity-60">
                    {isImporting ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang nhập...</>
                    ) : (
                      <><span className="material-symbols-outlined text-[18px]">done_all</span>Xác nhận nhập</>
                    )}
                  </button>
                </>
              )}

              {importStep === 3 && (
                <button type="button" onClick={() => setShowImportModal(false)} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-container">
                  Đóng
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </AppLayout>
  );
}
