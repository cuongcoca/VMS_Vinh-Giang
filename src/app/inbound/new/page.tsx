"use client";
import { useToast } from "@/components/ui";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import { auth } from "@/lib/auth";

type Supplier = { id: string; code: string; name: string };
type ItemCode = { id: string; code: string; short_name: string; unit?: { name: string } };

type LineItem = {
  item_code_id: string;
  item_code_display: string;
  item_name_display: string;
  unit_display: string;
  expected_qty: number;
  note: string;
};

type ParsedRow = {
  row_index: number;
  excel_code: string;
  excel_name: string;
  excel_qty: number | null;
  match_status: "matched" | "similar" | "unmatched";
  matched_item?: { id: string; code: string; short_name: string; unit?: { name: string } };
  suggestions?: { id: string; code: string; short_name: string; unit?: { name: string } }[];
  selected_item_id?: string;
  create_temp_code?: boolean;
};

function InboundNewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragFileRef = useRef<HTMLInputElement>(null);

  // Tabs: 'manual' | 'excel'
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"manual" | "excel">("manual");

  // Proposed code (preview only — BE sinh mã thật khi POST)
  const [proposedCode, setProposedCode] = useState("Đang tải…");

  // Meta states
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [creatorName, setCreatorName] = useState("Kế toán");

  // Form general state
  const [form, setForm] = useState({
    supplier_id: "",
    expected_date: "",
    invoice_no: "", // UC-IN-01: số hoá đơn — bắt buộc, kế toán nhập lúc lập phiếu
    import_type: "Nhập từ NCC", // Default
    warehouse: "Kho chính - Hà Nội", // Default
    note: "",
  });

  // Saving state
  const [saving, setSaving] = useState(false);

  // Tab 1: Manual lines state
  const [lines, setLines] = useState<LineItem[]>([
    { item_code_id: "", item_code_display: "", item_name_display: "", unit_display: "—", expected_qty: 1, note: "" },
  ]);

  useEffect(() => {
    const prefillStr = searchParams.get("prefill");
    if (prefillStr) {
      try {
        const parsed = JSON.parse(prefillStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const prefillLines = parsed.map((item: any) => ({
            item_code_id: item.item_code_id || "",
            item_code_display: item.item_code || item.code || item.item_code_display || "",
            item_name_display: item.item_name || item.short_name || item.item_name_display || "",
            unit_display: item.unit_name || item.unit || item.unit_display || "—",
            expected_qty: Number(item.qty) || Number(item.qty_requested) || Number(item.expected_qty) || 1,
            note: item.note || "",
          }));
          setLines(prefillLines);
        }
      } catch (err) {
        console.error("Failed to parse prefill query:", err);
      }
    }
  }, [searchParams]);

  // Tab 2 & 3: Excel flow states
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelStep, setExcelStep] = useState(1); // 1: Upload, 2: Mapping/Match, 3: Confirm Preview
  const [excelRows, setExcelRows] = useState<ParsedRow[]>([]);
  const [excelSummary, setExcelSummary] = useState({ total: 0, matched: 0, similar: 0, unmatched: 0 });
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [dragOverExcel, setDragOverExcel] = useState(false);

  // Item code search state per line
  const [searchStates, setSearchStates] = useState<Record<number, { query: string; results: ItemCode[]; show: boolean }>>({});
  const debounceRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  // Ref tới từng ô input mã hàng — để dropdown gợi ý nổi ra ngoài (portal) neo đúng vị trí ô.
  const itemInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [, setPosTick] = useState(0); // ép tính lại vị trí dropdown khi cuộn/đổi cỡ cửa sổ
  const anyDropdownOpen = Object.values(searchStates).some((s) => s?.show && s?.results && s.results.length > 0);
  useEffect(() => {
    if (!anyDropdownOpen) return;
    const reposition = () => setPosTick((t) => t + 1);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [anyDropdownOpen]);

  // Fetch meta (Suppliers, Creator Name, Proposed Code) on mount
  useEffect(() => {
    // Get creator name
    const currentUser = auth.getUser();
    if (currentUser?.fullName) {
      setCreatorName(currentUser.fullName);
    }

    // Fetch suppliers
    (async () => {
      try {
        const res = await fetch("/wms/api/suppliers");
        const result = await res.json();
        if (result.success) setSuppliers(result.data);
      } catch (err) {
        console.error("Fetch suppliers error:", err);
      }
    })();

    // Fetch proposed code from BE (endpoint dành riêng — sinh đúng prefix PHN-)
    (async () => {
      try {
        const res = await fetch("/wms/api/inbound/next-code");
        const result = await res.json();
        if (result.success && result.data?.code) {
          setProposedCode(result.data.code);
        } else {
          const currentYear = new Date().getFullYear();
          setProposedCode(`PHN-${currentYear}-0001`);
        }
      } catch (err) {
        console.error("Fetch proposed code error:", err);
        const currentYear = new Date().getFullYear();
        setProposedCode(`PNK-${currentYear}-0001`);
      }
    })();
  }, []);

  // Search item codes with debounce
  const searchItemCodes = useCallback(async (lineIdx: number, query: string) => {
    if (!query || query.length < 1) {
      setSearchStates((prev) => ({ ...prev, [lineIdx]: { query, results: [], show: false } }));
      return;
    }
    try {
      const res = await fetch(`/wms/api/item-codes?q=${encodeURIComponent(query)}`);
      const result = await res.json();
      if (result.success) {
        setSearchStates((prev) => ({
          ...prev,
          [lineIdx]: { query, results: result.data || [], show: true },
        }));
      }
    } catch (err) {
      console.error("Search item codes error:", err);
    }
  }, []);

  const handleItemCodeInput = (lineIdx: number, value: string) => {
    const newLines = [...lines];
    newLines[lineIdx].item_code_display = value;
    newLines[lineIdx].item_code_id = "";
    newLines[lineIdx].item_name_display = "";
    newLines[lineIdx].unit_display = "—";
    setLines(newLines);

    if (debounceRef.current[lineIdx]) clearTimeout(debounceRef.current[lineIdx]);
    debounceRef.current[lineIdx] = setTimeout(() => searchItemCodes(lineIdx, value), 300);
  };

  const handleSelectItem = (lineIdx: number, item: ItemCode) => {
    const newLines = [...lines];
    newLines[lineIdx].item_code_id = item.id;
    newLines[lineIdx].item_code_display = item.code;
    newLines[lineIdx].item_name_display = item.short_name;
    newLines[lineIdx].unit_display = item.unit?.name || "—";
    setLines(newLines);
    setSearchStates((prev) => ({ ...prev, [lineIdx]: { query: "", results: [], show: false } }));
  };

  const addLine = () => {
    setLines([...lines, { item_code_id: "", item_code_display: "", item_name_display: "", unit_display: "—", expected_qty: 1, note: "" }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof LineItem, value: string | number) => {
    const newLines = [...lines];
    (newLines[idx] as Record<string, string | number>)[field] = value;
    setLines(newLines);
  };

  // Drag & drop excel quick import in manual list
  const handleQuickImportDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!form.supplier_id) {
      toast.warning("Vui lòng chọn Nhà cung cấp trước khi import nhanh.");
      return;
    }
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      await uploadQuickImportFile(file);
    } else {
      toast.error("Chỉ chấp nhận file Excel (.xlsx hoặc .xls)");
    }
  };

  const handleQuickImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadQuickImportFile(file);
    }
  };

  const uploadQuickImportFile = async (file: File) => {
    if (!form.supplier_id) {
      toast.warning("Vui lòng chọn Nhà cung cấp trước.");
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("supplier_id", form.supplier_id);

      const res = await fetch("/wms/api/inbound/import-excel", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (result.success) {
        const importedLines = result.data.rows.map((row: any) => ({
          item_code_id: row.matched_item?.id || "",
          item_code_display: row.matched_item?.code || row.excel_code || "",
          item_name_display: row.matched_item?.short_name || row.excel_name || "",
          unit_display: row.matched_item?.unit?.name || "—",
          expected_qty: row.excel_qty || 1,
          note: row.match_status === "similar" ? "Mã tương tự" : row.match_status === "unmatched" ? "Mã chưa khớp" : "",
        }));

        // Replace empty line if exists, otherwise merge
        const isEmpty = lines.length === 1 && !lines[0].item_code_id && !lines[0].item_code_display;
        if (isEmpty) {
          setLines(importedLines);
        } else {
          setLines([...lines, ...importedLines]);
        }
        toast.error(`Nhập nhanh thành công! Đã thêm ${importedLines.length} dòng hàng.`);
      } else {
        toast.error(result.error || "Lỗi khi xử lý file Excel.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối.");
    } finally {
      setSaving(false);
    }
  };

  // Excel Tab Flow: file drag-drop
  const handleExcelDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverExcel(true);
  };
  const handleExcelDragLeave = () => setDragOverExcel(false);
  const handleExcelDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverExcel(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      setExcelFile(file);
    } else {
      toast.error("Chỉ chấp nhận file Excel (.xlsx hoặc .xls)");
    }
  };

  const handleExcelUpload = async () => {
    if (!excelFile) {
      toast.warning("Vui lòng chọn hoặc kéo thả file Excel.");
      return;
    }
    if (!form.supplier_id) {
      toast.warning("Vui lòng chọn Nhà cung cấp.");
      return;
    }

    setUploadingExcel(true);
    try {
      const formData = new FormData();
      formData.append("file", excelFile);
      formData.append("supplier_id", form.supplier_id);

      const res = await fetch("/wms/api/inbound/import-excel", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (result.success) {
        setExcelRows(result.data.rows.map((r: any) => ({ ...r, selected_item_id: "", create_temp_code: r.match_status === "unmatched" })));
        setExcelSummary(result.data.summary);
        setExcelStep(2);
      } else {
        toast.error(result.error || "Lỗi khi xử lý file.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối.");
    } finally {
      setUploadingExcel(false);
    }
  };

  const handleExcelRowSelectChange = (idx: number, itemId: string) => {
    const updated = [...excelRows];
    updated[idx].selected_item_id = itemId;
    // Clear create_temp_code if they chose a valid suggestion
    if (itemId) {
      updated[idx].create_temp_code = false;
    }
    setExcelRows(updated);
  };

  const handleExcelToggleCreateTemp = (idx: number, checked: boolean) => {
    const updated = [...excelRows];
    updated[idx].create_temp_code = checked;
    if (checked) {
      updated[idx].selected_item_id = "";
    }
    setExcelRows(updated);
  };

  // Submit Action (Tab 1: Manual)
  const handleSaveManual = async (andSend: boolean) => {
    if (!form.supplier_id) {
      toast.warning("Vui lòng chọn Nhà cung cấp.");
      return;
    }
    if (!form.expected_date) {
      toast.warning("Vui lòng chọn Ngày dự kiến.");
      return;
    }
    if (!form.invoice_no.trim()) {
      toast.warning("Vui lòng nhập Số hoá đơn.");
      return;
    }

    const validLines = lines.filter((l) => l.item_code_id);
    if (validLines.length === 0) {
      toast.warning("Vui lòng thêm ít nhất 1 dòng hàng hợp lệ.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/wms/api/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: form.supplier_id,
          expected_date: form.expected_date,
          invoice_no: form.invoice_no.trim(),
          import_type: form.import_type,
          warehouse: form.warehouse,
          source: "MANUAL",
          note: form.note || null,
          lines: validLines.map((l) => ({
            item_code_id: l.item_code_id,
            qty_expected: l.expected_qty,
            note: l.note || null,
          })),
        }),
      });
      const result = await res.json();

      if (!result.success) {
        toast.error(result.error || "Lỗi khi tạo phiếu nhập.");
        setSaving(false);
        return;
      }

      const createdId = result.data?.id;

      if (andSend && createdId) {
        const sendRes = await fetch(`/wms/api/inbound/${createdId}/send`, { method: "POST" });
        const sendResult = await sendRes.json();
        if (!sendResult.success) {
          toast.error(sendResult.error || "Đã tạo phiếu nhưng gửi cho Thủ kho thất bại.");
        }
      }

      router.push(createdId ? `/inbound/${createdId}` : "/inbound");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối.");
      setSaving(false);
    }
  };

  // Submit Action (Tab 2 & 3: Excel Flow Confirmation)
  const handleSaveExcel = async (andSend: boolean) => {
    if (!form.supplier_id) {
      toast.warning("Vui lòng chọn Nhà cung cấp.");
      return;
    }
    if (!form.expected_date) {
      toast.warning("Vui lòng chọn Ngày dự kiến.");
      return;
    }
    if (!form.invoice_no.trim()) {
      toast.warning("Vui lòng nhập Số hoá đơn.");
      return;
    }

    setSaving(true);
    try {
      const formattedLines = excelRows.map((r) => {
        const item_code_id = r.selected_item_id || r.matched_item?.id || null;
        return {
          item_code_id: item_code_id,
          excel_code: r.excel_code,
          excel_name: r.excel_name,
          qty_expected: r.excel_qty || 1,
          create_temp_code: r.create_temp_code || (!item_code_id && r.match_status === "unmatched"),
        };
      });

      const res = await fetch("/wms/api/inbound/import-excel/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: form.supplier_id,
          expected_date: form.expected_date,
          invoice_no: form.invoice_no.trim(),
          import_type: form.import_type,
          warehouse: form.warehouse,
          source: "EXCEL",
          note: form.note || null,
          lines: formattedLines,
        }),
      });
      const result = await res.json();

      if (!result.success) {
        toast.error(result.error || "Lỗi khi lưu phiếu nhập từ Excel.");
        setSaving(false);
        return;
      }

      const createdId = result.data?.id;

      if (andSend && createdId) {
        const sendRes = await fetch(`/wms/api/inbound/${createdId}/send`, { method: "POST" });
        const sendResult = await sendRes.json();
        if (!sendResult.success) {
          toast.error(sendResult.error || "Đã tạo phiếu nhưng gửi cho Thủ kho thất bại.");
        }
      }

      router.push(createdId ? `/inbound/${createdId}` : "/inbound");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối.");
      setSaving(false);
    }
  };

  // Totals calculations for Tab 1 Manual
  const totalLinesCount = lines.length;
  const totalQtyCount = lines.reduce((acc, l) => acc + (Number(l.expected_qty) || 0), 0);

  // Totals for Excel Tab Step 3
  const excelTotalQtyCount = excelRows.reduce((acc, r) => acc + (Number(r.excel_qty) || 0), 0);

  return (
    <AppLayout title="LẬP PHIẾU NHẬP">
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="mb-2"><BackButton fallback="/inbound" variant="link">Quay lại danh sách</BackButton></div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">Lập phiếu nhập mới</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Tạo phiếu yêu cầu nhập hàng (PO) và gửi cho Thủ kho tiếp nhận thực tế.
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-outline-variant gap-2">
          {[
            { key: "manual", label: "Nhập tay", icon: "edit_note" },
            { key: "excel", label: "Up file Excel", icon: "upload_file" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as any);
                setExcelStep(1);
                setExcelFile(null);
                setExcelRows([]);
              }}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-primary hover:border-outline-variant"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form General Info (Common) */}
        <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">info</span>
            Thông tin chung phiếu yêu cầu
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Proposed Code */}
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Mã phiếu đề xuất
              </label>
              <input
                type="text"
                value={proposedCode}
                readOnly
                className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-surface-low text-on-surface-variant font-mono font-bold focus:outline-none"
              />
            </div>

            {/* Supplier */}
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Nhà cung cấp (NCC) <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.supplier_id}
                onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">— Chọn NCC —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                ))}
              </select>
            </div>

            {/* Expected Date */}
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Ngày dự kiến *
              </label>
              <input
                type="date"
                value={form.expected_date}
                onChange={(e) => setForm({ ...form, expected_date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Invoice No — UC-IN-01: bắt buộc */}
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Số hoá đơn <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.invoice_no}
                onChange={(e) => setForm({ ...form, invoice_no: e.target.value })}
                placeholder="VD: 1C26TAA-0001234"
                className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Import Type */}
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Loại nhập *
              </label>
              <select
                value={form.import_type}
                onChange={(e) => setForm({ ...form, import_type: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="Nhập từ NCC">Nhập từ NCC</option>
                <option value="Hàng trả lại">Hàng trả lại</option>
              </select>
            </div>

            {/* Warehouse */}
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Kho nhận *
              </label>
              <select
                value={form.warehouse}
                onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="Kho chính - Hà Nội">Kho chính - Hà Nội</option>
                <option value="Kho Bình Dương">Kho Bình Dương</option>
              </select>
            </div>

            {/* Creator */}
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Người tạo
              </label>
              <input
                type="text"
                value={creatorName}
                readOnly
                className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-surface-low text-on-surface-variant font-semibold focus:outline-none"
              />
            </div>
          </div>

          {/* Note textarea (Full width) */}
          <div className="pt-2">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
              Ghi chú chung
            </label>
            <textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Ghi chú thêm về phiếu nhập (nếu có)..."
              className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>
        </div>

        {/* TAB 1 CONTENT: MANUAL ENTRY */}
        {activeTab === "manual" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              {/* Header card manual */}
              <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">list_alt</span>
                  Danh sách dòng hàng
                </h2>
                <div className="flex items-center gap-2">
                  {/* Quick Drop Zone trigger */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={handleQuickImportDrop}
                    onClick={() => dragFileRef.current?.click()}
                    className="border border-dashed border-primary/50 bg-primary/5 px-4 py-1.5 rounded-lg text-xs text-primary font-medium hover:bg-primary/10 transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Kéo thả hoặc nhấn để import nhanh từ Excel"
                  >
                    <input
                      ref={dragFileRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleQuickImportFileSelect}
                      className="hidden"
                    />
                    <span className="material-symbols-outlined text-[16px]">upload_file</span>
                    Kéo thả / Nhập nhanh Excel
                  </div>
                  <button
                    onClick={addLine}
                    className="px-4 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Thêm dòng hàng
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 800 }}>
                  <thead>
                    <tr className="bg-surface-low border-b border-outline-variant">
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant w-12">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant w-[200px]">Mã hàng</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant min-w-[200px]">Tên hàng</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant w-[100px]">ĐVT</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant w-[120px]">SL Yêu Cầu</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant min-w-[150px]">Ghi chú dòng</th>
                      <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx} className="border-b border-outline-variant/50 hover:bg-surface-low/50 transition-colors">
                        <td className="px-4 py-2 text-on-surface-variant font-mono text-xs">{idx + 1}</td>
                        <td className="px-4 py-2 relative">
                          <input
                            type="text"
                            ref={(el) => { itemInputRefs.current[idx] = el; }}
                            value={line.item_code_display}
                            onChange={(e) => handleItemCodeInput(idx, e.target.value)}
                            onFocus={() => {
                              if (searchStates[idx]?.results?.length > 0) {
                                setSearchStates((prev) => ({ ...prev, [idx]: { ...prev[idx], show: true } }));
                              }
                            }}
                            onBlur={() => setTimeout(() => setSearchStates((prev) => ({ ...prev, [idx]: { ...prev[idx], show: false } })), 200)}
                            placeholder="Nhập mã hàng..."
                            className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono ${
                              line.item_code_id ? "border-emerald-400 bg-emerald-50/20" : "border-outline-variant"
                            }`}
                          />
                          {/* Search Dropdown — render qua PORTAL ra document.body để KHÔNG bị bảng (overflow) cắt */}
                          {searchStates[idx]?.show &&
                            searchStates[idx]?.results?.length > 0 &&
                            typeof document !== "undefined" &&
                            itemInputRefs.current[idx] &&
                            createPortal(
                              (() => {
                                const r = itemInputRefs.current[idx]!.getBoundingClientRect();
                                const width = Math.max(r.width, 360);
                                const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
                                return (
                                  <div
                                    style={{ position: "fixed", top: r.bottom + 4, left, width, zIndex: 1000 }}
                                    className="bg-white border border-outline-variant rounded-lg shadow-xl max-h-[280px] overflow-y-auto"
                                  >
                                    {searchStates[idx].results.map((item) => (
                                      <button
                                        key={item.id}
                                        type="button"
                                        onMouseDown={() => handleSelectItem(idx, item)}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-primary/5 flex items-center gap-2 border-b border-outline-variant/30 last:border-b-0"
                                      >
                                        <span className="font-mono font-bold text-primary text-xs whitespace-nowrap">{item.code}</span>
                                        <span className="text-on-surface-variant truncate flex-1">{item.short_name}</span>
                                        {item.unit && <span className="text-[10px] bg-surface-low px-1.5 py-0.5 rounded text-on-surface-variant font-semibold whitespace-nowrap">{item.unit.name}</span>}
                                      </button>
                                    ))}
                                  </div>
                                );
                              })(),
                              document.body
                            )}
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-sm font-medium text-on-surface">{line.item_name_display || "—"}</span>
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-xs px-2 py-1 bg-surface-low rounded text-on-surface-variant font-semibold">{line.unit_display}</span>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min={1}
                            value={line.expected_qty}
                            onChange={(e) => updateLine(idx, "expected_qty", parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-center font-semibold"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={line.note}
                            onChange={(e) => updateLine(idx, "note", e.target.value)}
                            placeholder="Ghi chú riêng cho sản phẩm..."
                            className="w-full px-3 py-1.5 text-sm border border-outline-variant rounded-lg focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => removeLine(idx)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-on-surface-variant/70 hover:text-rose-600 transition-colors"
                            title="Xóa dòng"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary row */}
              <div className="bg-surface-low border-t border-outline-variant px-6 py-3 flex items-center justify-between text-sm text-on-surface-variant font-semibold flex-wrap gap-2">
                <div>
                  Tổng dòng hàng: <span className="text-primary font-bold font-mono text-base">{totalLinesCount}</span>
                </div>
                <div>
                  Tổng số lượng yêu cầu: <span className="text-primary font-bold font-mono text-base">{totalQtyCount}</span>
                </div>
              </div>
            </div>

            {/* Footer Actions Left Aligned */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSaveManual(true)}
                disabled={saving}
                className="px-6 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "send"}</span>
                Lưu &amp; Gửi cho Thủ kho
              </button>
              <button
                onClick={() => handleSaveManual(false)}
                disabled={saving}
                className="px-6 py-3 border border-outline-variant text-on-surface bg-white rounded-lg text-sm font-semibold hover:bg-surface-low flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "save"}</span>
                Lưu nháp
              </button>
              <Link
                href="/inbound"
                className="px-6 py-3 border border-outline-variant text-on-surface-variant bg-white rounded-lg text-sm font-medium hover:bg-surface-low transition-colors"
              >
                Hủy
              </Link>
            </div>
          </div>
        )}

        {/* TAB 2 CONTENT: UP FILE EXCEL FLOW */}
        {activeTab === "excel" && (
          <div className="space-y-6">
            {/* Stepper indicators */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { num: 1, label: "Tải file Excel lên" },
                { num: 2, label: "Đối chiếu mã hàng" },
                { num: 3, label: "Xác nhận & Tạo phiếu" },
              ].map(({ num, label }) => (
                <React.Fragment key={num}>
                  {num > 1 && <div className={`flex-1 h-0.5 min-w-[20px] ${excelStep >= num ? "bg-primary" : "bg-surface-mid"}`} />}
                  <div className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold ${
                    excelStep === num ? "bg-primary text-white shadow-sm" : excelStep > num ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-surface-low text-on-surface-variant"
                  }`}>
                    <span className="material-symbols-outlined text-[16px]">
                      {excelStep > num ? "check_circle" : num === 1 ? "upload_file" : num === 2 ? "compare_arrows" : "task_alt"}
                    </span>
                    {label}
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* Wizard Box */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-6">
              {/* Step 1: Drag Drop File */}
              {excelStep === 1 && (
                <div className="space-y-5">
                  <div
                    onDragOver={handleExcelDragOver}
                    onDragLeave={handleExcelDragLeave}
                    onDrop={handleExcelDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                      dragOverExcel ? "border-primary bg-primary/5 scale-[1.01]" : excelFile ? "border-emerald-400 bg-emerald-50/20" : "border-outline-variant hover:border-primary hover:bg-surface-low/30"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setExcelFile(file);
                      }}
                      className="hidden"
                    />
                    {excelFile ? (
                      <>
                        <span className="material-symbols-outlined text-[48px] text-emerald-500">description</span>
                        <p className="mt-2 text-sm font-semibold text-emerald-700">{excelFile.name}</p>
                        <p className="text-xs text-on-surface-variant mt-1">{(excelFile.size / 1024).toFixed(1)} KB — Nhấn vào để chọn file khác</p>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[48px] text-on-surface-variant/70">cloud_upload</span>
                        <p className="mt-2 text-sm font-bold text-on-surface-variant">Kéo thả file Excel của Nhà cung cấp vào đây</p>
                        <p className="text-xs text-on-surface-variant/70 mt-1">hoặc click để chọn file từ máy tính (.xlsx, .xls)</p>
                      </>
                    )}
                  </div>

                  <div className="flex justify-end pt-4 border-t border-outline-variant/50">
                    <button
                      onClick={handleExcelUpload}
                      disabled={uploadingExcel || !excelFile || !form.supplier_id}
                      className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">{uploadingExcel ? "progress_activity" : "upload"}</span>
                      {uploadingExcel ? "Đang đọc file..." : "Tải lên &amp; Đối chiếu"}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Mapping Rows */}
              {excelStep === 2 && (
                <div className="space-y-4">
                  {/* Summary group */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-center shadow-sm">
                      <span className="material-symbols-outlined text-[24px] text-emerald-600 block">check_circle</span>
                      <span className="text-xl font-bold text-emerald-700 mt-1 block font-mono">{excelSummary.matched}</span>
                      <span className="text-xs text-emerald-600 font-semibold">Khớp mã hoàn hảo</span>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-center shadow-sm">
                      <span className="material-symbols-outlined text-[24px] text-amber-600 block">help</span>
                      <span className="text-xl font-bold text-amber-700 mt-1 block font-mono">{excelSummary.similar}</span>
                      <span className="text-xs text-amber-600 font-semibold">Mã tương tự cần chọn</span>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-center shadow-sm">
                      <span className="material-symbols-outlined text-[24px] text-rose-600 block">error</span>
                      <span className="text-xl font-bold text-rose-700 mt-1 block font-mono">{excelSummary.unmatched}</span>
                      <span className="text-xs text-rose-600 font-semibold">Không khớp (sẽ tạo mã tạm)</span>
                    </div>
                  </div>

                  {/* Rows Table mapping */}
                  <div className="overflow-x-auto border border-outline-variant rounded-lg shadow-sm">
                    <table className="w-full text-sm" style={{ minWidth: 800 }}>
                      <thead>
                        <tr className="bg-surface-low border-b border-outline-variant text-on-surface">
                          <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant w-16">Dòng</th>
                          <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant w-[160px]">Mã hàng (Excel)</th>
                          <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tên hàng (Excel)</th>
                          <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant w-[90px]">SL Yêu Cầu</th>
                          <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant w-16">Khớp</th>
                          <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant min-w-[240px]">Chọn mã hệ thống</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excelRows.map((row, idx) => (
                          <tr
                            key={idx}
                            className={`border-b border-outline-variant/40 ${
                              row.match_status === "matched" ? "bg-emerald-50/10" : row.match_status === "similar" ? "bg-amber-50/20" : "bg-rose-50/10"
                            }`}
                          >
                            <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{row.row_index}</td>
                            <td className="px-4 py-3 font-mono font-bold text-on-surface">{row.excel_code}</td>
                            <td className="px-4 py-3 text-on-surface-variant text-xs">{row.excel_name}</td>
                            <td className="px-4 py-3 font-semibold font-mono text-on-surface">{row.excel_qty || "—"}</td>
                            <td className="px-4 py-3 text-center">
                              {row.match_status === "matched" ? (
                                <span className="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span>
                              ) : row.match_status === "similar" ? (
                                <span className="material-symbols-outlined text-[20px] text-amber-600">help</span>
                              ) : (
                                <span className="material-symbols-outlined text-[20px] text-rose-600">error</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {row.match_status === "matched" && row.matched_item && (
                                <div className="text-sm text-emerald-700 font-semibold flex items-center gap-1.5">
                                  <span>{row.matched_item.code}</span>
                                  <span className="text-xs font-normal text-on-surface-variant">— {row.matched_item.short_name}</span>
                                </div>
                              )}

                              {row.match_status === "similar" && row.suggestions && (
                                <select
                                  value={row.selected_item_id || ""}
                                  onChange={(e) => handleExcelRowSelectChange(idx, e.target.value)}
                                  className="w-full px-2 py-1.5 text-xs border border-amber-300 rounded-lg bg-white focus:outline-none"
                                >
                                  <option value="">— Chọn mã hàng hệ thống tương thích —</option>
                                  {row.suggestions.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.code} — {item.short_name} ({item.unit?.name || "ĐVT"})
                                    </option>
                                  ))}
                                </select>
                              )}

                              {row.match_status === "unmatched" && (
                                <div className="flex items-center gap-2">
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={row.create_temp_code !== false}
                                      onChange={(e) => handleExcelToggleCreateTemp(idx, e.target.checked)}
                                      className="rounded border-outline-variant text-primary focus:ring-primary/20 w-4 h-4"
                                    />
                                    <span className="text-xs text-rose-600 font-medium italic">Tạo mã hàng tạm mới</span>
                                  </label>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between pt-4 border-t border-outline-variant/50">
                    <button
                      onClick={() => { setExcelStep(1); setExcelRows([]); }}
                      className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-low font-medium"
                    >
                      ← Tải lại file
                    </button>
                    <button
                      onClick={() => setExcelStep(3)}
                      className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover flex items-center gap-2 transition-colors shadow-sm"
                    >
                      Tiếp tục Review
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Review Preview and Create */}
              {excelStep === 3 && (
                <div className="space-y-5">
                  <div className="bg-surface-low rounded-xl p-4 border border-outline-variant/80">
                    <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider mb-2">Tóm tắt file import</h3>
                    <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-on-surface-variant">
                      <div>
                        Nhà cung cấp: <span className="text-on-surface font-bold ml-1">{suppliers.find((s) => s.id === form.supplier_id)?.name || "—"}</span>
                      </div>
                      <div>
                        Tổng số dòng hàng: <span className="text-on-surface font-bold ml-1 font-mono">{excelRows.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Preview lines */}
                  <div className="overflow-x-auto border border-outline-variant rounded-lg">
                    <table className="w-full text-sm" style={{ minWidth: 600 }}>
                      <thead>
                        <tr className="bg-surface-low border-b border-outline-variant text-on-surface">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-on-surface-variant w-12">#</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-on-surface-variant w-[160px]">Mã hàng</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-on-surface-variant">Tên hàng</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-on-surface-variant w-[90px]">SL Yêu Cầu</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-on-surface-variant w-[140px]">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excelRows.map((r, idx) => {
                          let codeDisplay = r.excel_code;
                          let nameDisplay = r.excel_name;
                          let statusLabel = "";
                          let statusClass = "";

                          if (r.matched_item && !r.selected_item_id) {
                            codeDisplay = r.matched_item.code;
                            nameDisplay = r.matched_item.short_name;
                            statusLabel = "Mã khớp";
                            statusClass = "text-emerald-700 bg-emerald-50 border-emerald-100";
                          } else if (r.selected_item_id) {
                            const matchedSuggestion = r.suggestions?.find((s) => s.id === r.selected_item_id);
                            codeDisplay = matchedSuggestion?.code || r.excel_code;
                            nameDisplay = matchedSuggestion?.short_name || r.excel_name;
                            statusLabel = "Đã khớp tương tự";
                            statusClass = "text-amber-700 bg-amber-50 border-amber-100";
                          } else if (r.create_temp_code || r.match_status === "unmatched") {
                            statusLabel = "Tạo mã tạm";
                            statusClass = "text-rose-700 bg-rose-50 border-rose-100";
                          }

                          return (
                            <tr key={idx} className="border-b border-outline-variant/40">
                              <td className="px-3 py-2 text-xs font-mono text-on-surface-variant">{idx + 1}</td>
                              <td className="px-3 py-2 font-mono text-xs font-bold text-primary">{codeDisplay}</td>
                              <td className="px-3 py-2 text-xs text-on-surface-variant">{nameDisplay}</td>
                              <td className="px-3 py-2 font-semibold font-mono">{r.excel_qty || 1}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${statusClass}`}>
                                  {statusLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary row */}
                  <div className="bg-surface-low border-t border-outline-variant px-6 py-3 flex items-center justify-between text-sm text-on-surface-variant font-semibold flex-wrap gap-2">
                    <div>
                      Tổng dòng hàng: <span className="text-primary font-bold font-mono text-base">{excelRows.length}</span>
                    </div>
                    <div>
                      Tổng số lượng yêu cầu: <span className="text-primary font-bold font-mono text-base">{excelTotalQtyCount}</span>
                    </div>
                  </div>

                  {/* Left Aligned Actions */}
                  <div className="flex items-center gap-3 pt-4 border-t border-outline-variant/50">
                    <button
                      onClick={() => handleSaveExcel(true)}
                      disabled={saving}
                      className="px-6 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "send"}</span>
                      Lưu &amp; Gửi cho Thủ kho
                    </button>
                    <button
                      onClick={() => handleSaveExcel(false)}
                      disabled={saving}
                      className="px-6 py-3 border border-outline-variant text-on-surface bg-white rounded-lg text-sm font-semibold hover:bg-surface-low flex items-center gap-2 disabled:opacity-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "save"}</span>
                      Lưu nháp
                    </button>
                    <button
                      onClick={() => setExcelStep(2)}
                      className="px-6 py-3 border border-outline-variant text-on-surface-variant bg-white rounded-lg text-sm font-medium hover:bg-surface-low transition-colors"
                    >
                      ← Quay lại chỉnh sửa
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}

export default function InboundNewPage() {
  return (
    <Suspense fallback={
      <div className="py-12 text-center">
        <span className="material-symbols-outlined animate-spin text-[24px] text-primary">
          progress_activity
        </span>
      </div>
    }>
      <InboundNewForm />
    </Suspense>
  );
}
