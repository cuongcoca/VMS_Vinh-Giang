"use client";
import { fetchJson } from "@/lib/api";
import { useToast } from "@/components/ui";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";

type Supplier = { id: string; code: string; name: string };

// UC-IN-06: schema khớp với API /api/inbound/import-excel
type ParsedRow = {
  row_index: number;
  excel_code: string;
  excel_name: string;
  excel_qty: number | null;
  excel_weight_kg?: number | null;  // UC-IN-06
  bu_group?: string | null;          // UC-IN-06: HC/BE/PC/F
  match_status: "matched" | "similar" | "unmatched";
  matched_item?: { id: string; code: string; short_name: string };
  suggestions?: { id: string; code: string; short_name: string }[];
  selected_item_id?: string;
};

type BuSummary = {
  bu_code: string;
  bu_label: string;
  sku_count: number;
  total_qty_box: number;
  total_weight_kg: number;
};

type ImportResult = {
  rows: ParsedRow[];
  summary: {
    total: number;
    matched: number;
    similar: number;
    unmatched: number;
    total_qty_box: number;
    total_weight_kg: number;
    by_bu: BuSummary[];
  };
  supplier_id: string | null;
};

export default function InboundImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step management
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Step 2 state
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);

  // Step 3 state
  const [invoiceNo, setInvoiceNo] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Fetch suppliers
  useEffect(() => {
    (async () => {
      try {
        const body = await fetchJson<{ data?: unknown[] }>("/wms/api/suppliers");
        setSuppliers((body.data ?? []) as typeof suppliers);
      } catch (err) {
        console.error("Fetch suppliers error:", err);
      }
    })();
  }, []);

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".xls"))) {
      setFile(droppedFile);
    } else {
      toast.error("Chỉ chấp nhận file .xlsx hoặc .xls");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  // Step 1: Upload
  const handleUpload = async () => {
    if (!file) {
      toast.warning("Vui lòng chọn file Excel.");
      return;
    }
    if (!selectedSupplier) {
      toast.warning("Vui lòng chọn Nhà cung cấp.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("supplier_id", selectedSupplier);

      const res = await fetch("/wms/api/inbound/import-excel", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();

      if (result.success) {
        setImportResult(result.data);
        setRows(result.data.rows || []);
        setStep(2);
      } else {
        toast.error(result.error || "Lỗi khi upload file.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối.");
    } finally {
      setUploading(false);
    }
  };

  // Step 2: Update row selection
  const handleRowItemChange = (rowIdx: number, itemId: string) => {
    const newRows = [...rows];
    newRows[rowIdx].selected_item_id = itemId;
    setRows(newRows);
  };

  // UC-IN-06: Tải file template Excel mẫu (Hàng U về của Unilever)
  const handleDownloadTemplate = () => {
    try {
      const sampleData = [
        ["STT", "Mã hàng", "Tên hàng", "SL thùng", "Trọng lượng (kg)", "BU"],
        [1, "69719229", "CLEAR MEN SP PERFUME WARM FOREST 8X600", 5, 5660, "BE"],
        [2, "65638473", "CLEAR SP C MTL/M CS LTD 8(1+1)630G/140G", 8, 7700, "BE"],
        [3, "65087872", "CLEAR SP COOL MENTHOL (10FR2) 1008X6G", 16, 7600, "BE"],
        [4, "65442462", "COMFORT LQ W.F.BABY PW FRGR Y25 360X20ML", 60, 8000, "HC"],
        [5, "64397162", "COMFORT LQ WH F.BABY PW FRGR POU 4X1.7L", 6, 7664, "HC"],
        [6, "62726100", "COMFORT LQ WHT F.BABY PW FRGR 12X800ML", 12, 10720, "HC"],
        [7, "65592437", "KNORR MEATY GRA 8(1+SUGAR300G)900G", 422, 10000, "F"],
        [8, "65650854", "OMO LQ FL A.M.SMELL POU PI0126 4X1.8KG", 28, 7832, "HC"],
        [9, "65650864", "OMO LQ FL LAVENDER POU PI0126 4X3.6KG", 288, 15491, "HC"],
        [10, "60221700", "CLOSEUP TOOTHPASTE WHITE FRESH 145G", 24, 4800, "PC"],
        [11, "60303125", "P/S TOOTHPASTE COOL MINT 200G", 36, 6480, "PC"],
        [12, "60411258", "LIFEBUOY HANDWASH 500G", 18, 5400, "PC"],
      ];
      const ws = XLSX.utils.aoa_to_sheet(sampleData);
      // Set column widths
      ws["!cols"] = [
        { wch: 6 },   // STT
        { wch: 14 },  // Mã hàng
        { wch: 50 },  // Tên hàng
        { wch: 12 },  // SL thùng
        { wch: 18 },  // Trọng lượng
        { wch: 6 },   // BU
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "HangUVe");
      XLSX.writeFile(wb, "HangUVe_template.xlsx");
    } catch (err) {
      console.error(err);
      toast.error("Không thể tạo file template.");
    }
  };

  // Step 3: Confirm
  const handleConfirm = async () => {
    // UC-IN-01: Số hoá đơn bắt buộc khi tạo phiếu nhập
    if (!invoiceNo.trim()) {
      toast.warning("Vui lòng nhập Số hoá đơn.");
      return;
    }

    // Khớp với API /confirm: gửi `lines` (item_code_id + qty_expected).
    // Dòng chưa map được mã → create_temp_code để tạo "Mã hàng theo chứng từ" tạm (UC-MD-02).
    const lines = rows.map((r) => {
      const itemCodeId = r.selected_item_id || r.matched_item?.id || null;
      return {
        item_code_id: itemCodeId || undefined,
        excel_code: r.excel_code,
        excel_name: r.excel_name,
        qty_expected: r.excel_qty,
        create_temp_code: !itemCodeId,
      };
    });

    setConfirming(true);
    try {
      const res = await fetch("/wms/api/inbound/import-excel/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: selectedSupplier,
          expected_date: expectedDate || null,
          invoice_no: invoiceNo.trim(),
          note: note || null,
          lines,
        }),
      });
      const result = await res.json();

      if (result.success) {
        const createdId = result.data?.id;
        router.push(createdId ? `/inbound/${createdId}` : "/inbound");
      } else {
        toast.error(result.error || "Lỗi khi tạo phiếu.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối.");
    } finally {
      setConfirming(false);
    }
  };

  const matchIcon = (status: string) => {
    switch (status) {
      case "matched": return { icon: "check_circle", color: "text-emerald-600", bg: "bg-emerald-50" };
      case "similar": return { icon: "help", color: "text-amber-600", bg: "bg-amber-50" };
      case "unmatched": return { icon: "error", color: "text-rose-600", bg: "bg-rose-50" };
      default: return { icon: "help", color: "text-on-surface-variant/70", bg: "bg-surface-low" };
    }
  };

  return (
    <AppLayout title="NHẬP TỪ EXCEL">
      <div className="p-6 space-y-5 min-w-0 overflow-hidden">
        {/* Header */}
        <div>
          <div className="mb-2"><BackButton fallback="/inbound" variant="link">Quay lại danh sách</BackButton></div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Nhập phiếu nhập từ Excel</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Tải file Excel lên, đối chiếu mã hàng, sau đó xác nhận tạo phiếu
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2">
          {[
            { num: 1, label: "Tải file" },
            { num: 2, label: "Đối chiếu" },
            { num: 3, label: "Xác nhận" },
          ].map(({ num, label }) => (
            <React.Fragment key={num}>
              {num > 1 && <div className={`flex-1 h-0.5 ${step >= num ? "bg-primary" : "bg-surface-mid"}`} />}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                step === num ? "bg-primary text-white" : step > num ? "bg-emerald-100 text-emerald-700" : "bg-surface-low text-on-surface-variant"
              }`}>
                <span className="material-symbols-outlined text-[16px]">
                  {step > num ? "check_circle" : num === 1 ? "upload_file" : num === 2 ? "compare_arrows" : "task_alt"}
                </span>
                {label}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-6 space-y-5">
            {/* NCC Dropdown */}
            <div className="max-w-md">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                Nhà cung cấp (NCC) <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">— Chọn NCC —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                ))}
              </select>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                dragOver ? "border-primary bg-primary/5 scale-[1.01]" : file ? "border-emerald-300 bg-emerald-50/30" : "border-outline-variant hover:border-outline-variant hover:bg-surface-low"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <>
                  <span className="material-symbols-outlined text-[48px] text-emerald-500">description</span>
                  <p className="mt-2 text-sm font-semibold text-emerald-700">{file.name}</p>
                  <p className="text-xs text-on-surface-variant mt-1">{(file.size / 1024).toFixed(1)} KB — Nhấn để chọn file khác</p>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[48px] text-on-surface-variant/50">cloud_upload</span>
                  <p className="mt-2 text-sm font-semibold text-on-surface-variant">Kéo thả file Excel vào đây</p>
                  <p className="text-xs text-on-surface-variant/70 mt-1">hoặc nhấn để chọn file (.xlsx, .xls)</p>
                </>
              )}
            </div>

            {/* UC-IN-06: hint format cột */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] mt-0.5">info</span>
              <div>
                <b>Định dạng cột:</b> Mã hàng · Tên hàng · SL thùng · Trọng lượng (kg) · BU (HC/BE/PC/F).
                <br />
                Hệ thống tự nhận diện cột theo header. Mã chưa có sẽ được tạo nhanh ở dạng "Mã hàng theo chứng từ" (UC-MD-02).
              </div>
            </div>

            {/* Upload Buttons */}
            <div className="flex justify-between items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-4 py-2 border border-outline-variant rounded-lg text-sm hover:bg-surface-low flex items-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                ⬇ Tải template mẫu (HangUVe)
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !file || !selectedSupplier}
                className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">{uploading ? "progress_activity" : "upload"}</span>
                {uploading ? "Đang xử lý..." : "Tải lên & Đối chiếu"}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Review */}
        {step === 2 && importResult && (
          <div className="space-y-4">
            {/* UC-IN-06: 5 KPI mockup style */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white border border-outline-variant rounded-xl p-3" style={{ borderLeftWidth: 4, borderLeftColor: "rgb(99 102 241)" }}>
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase">Tổng dòng</p>
                <p className="text-xl font-bold mt-0.5">{importResult.summary.total}</p>
                <p className="text-[10px] text-on-surface-variant/70">SKU</p>
              </div>
              <div className="bg-white border border-emerald-200 rounded-xl p-3" style={{ borderLeftWidth: 4, borderLeftColor: "rgb(16 185 129)" }}>
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase">Đã có mã chuẩn</p>
                <p className="text-xl font-bold mt-0.5 text-emerald-700">{importResult.summary.matched}</p>
                <p className="text-[10px] text-emerald-600">
                  {importResult.summary.total > 0
                    ? `${((importResult.summary.matched / importResult.summary.total) * 100).toFixed(1)}%`
                    : "—"}
                </p>
              </div>
              <div className="bg-white border border-amber-200 rounded-xl p-3" style={{ borderLeftWidth: 4, borderLeftColor: "rgb(245 158 11)" }}>
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase">Cần tạo mã</p>
                <p className="text-xl font-bold mt-0.5 text-amber-700">{importResult.summary.similar + importResult.summary.unmatched}</p>
                <p className="text-[10px] text-amber-600">
                  + {importResult.summary.similar} mã tương tự
                </p>
              </div>
              <div className="bg-white border border-outline-variant rounded-xl p-3">
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase">Tổng thùng</p>
                <p className="text-xl font-bold mt-0.5 font-mono">{importResult.summary.total_qty_box.toLocaleString()}</p>
              </div>
              <div className="bg-white border border-outline-variant rounded-xl p-3">
                <p className="text-[10px] font-semibold text-on-surface-variant uppercase">Tổng tải trọng</p>
                <p className="text-xl font-bold mt-0.5 font-mono">{(importResult.summary.total_weight_kg / 1000).toFixed(3)}</p>
                <p className="text-[10px] text-on-surface-variant/70">tấn</p>
              </div>
            </div>

            {/* UC-IN-06: Summary theo nhóm BU */}
            {importResult.summary.by_bu && importResult.summary.by_bu.length > 0 && (
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-surface-low border-b border-outline-variant text-sm font-bold text-on-surface">
                  📊 Tóm tắt theo nhóm BU (Business Unit)
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-surface-low">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-on-surface-variant">Nhóm BU</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-on-surface-variant">Số SKU</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-on-surface-variant">Số thùng</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-on-surface-variant">Trọng lượng (t)</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-on-surface-variant">% tổng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.summary.by_bu.map((b) => (
                      <tr key={b.bu_code} className="border-t border-outline-variant/50">
                        <td className="px-4 py-2 text-sm">
                          <b className="text-primary">{b.bu_code}</b>
                          <span className="text-on-surface-variant ml-1">— {b.bu_label}</span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono">{b.sku_count}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">{b.total_qty_box.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-mono">{(b.total_weight_kg / 1000).toFixed(3)}</td>
                        <td className="px-4 py-2 text-right font-mono text-on-surface-variant">
                          {importResult.summary.total_qty_box > 0
                            ? `${((b.total_qty_box / importResult.summary.total_qty_box) * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-outline-variant bg-surface-low font-bold">
                      <td className="px-4 py-2 text-sm">Tổng</td>
                      <td className="px-4 py-2 text-right font-mono">{importResult.summary.total}</td>
                      <td className="px-4 py-2 text-right font-mono">{importResult.summary.total_qty_box.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-mono">{(importResult.summary.total_weight_kg / 1000).toFixed(3)}</td>
                      <td className="px-4 py-2 text-right font-mono">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Rows Table */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 900 }}>
                  <thead>
                    <tr className="bg-surface-low border-b border-outline-variant">
                      <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant w-[50px]">#</th>
                      <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Mã hàng (file)</th>
                      <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tên hàng (file)</th>
                      <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">SL thùng</th>
                      <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant hidden md:table-cell">Trọng lượng (kg)</th>
                      <th className="text-center px-3 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant w-[60px] hidden md:table-cell">BU</th>
                      <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wider text-on-surface-variant min-w-[200px]">Đối chiếu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const mi = matchIcon(row.match_status);
                      return (
                        <tr key={idx} className={`border-b border-outline-variant/50 ${mi.bg}`}>
                          <td className="px-3 py-2.5 font-mono text-xs text-on-surface-variant">{row.row_index}</td>
                          <td className="px-3 py-2.5 font-mono font-bold text-xs">{row.excel_code}</td>
                          <td className="px-3 py-2.5 text-on-surface-variant text-xs">{row.excel_name}</td>
                          <td className="px-3 py-2.5 font-semibold text-right">{row.excel_qty ?? "—"}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs hidden md:table-cell">{row.excel_weight_kg?.toLocaleString() ?? "—"}</td>
                          <td className="px-3 py-2.5 text-center hidden md:table-cell">
                            {row.bu_group ? (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {row.bu_group}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            {row.match_status === "matched" && row.matched_item && (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                                <span className={`material-symbols-outlined text-[14px] ${mi.color}`}>{mi.icon}</span>
                                ✓ {row.matched_item.code}
                              </span>
                            )}
                            {row.match_status === "similar" && row.suggestions && (
                              <select
                                value={row.selected_item_id || ""}
                                onChange={(e) => handleRowItemChange(idx, e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-amber-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                              >
                                <option value="">⚠ Chọn mã chuẩn —</option>
                                {row.suggestions.map((item) => (
                                  <option key={item.id} value={item.id}>{item.code} — {item.short_name}</option>
                                ))}
                              </select>
                            )}
                            {row.match_status === "unmatched" && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-semibold">
                                <span className={`material-symbols-outlined text-[14px] ${mi.color}`}>{mi.icon}</span>
                                ⚠ Chưa có — sẽ tự tạo
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <button
                onClick={() => { setStep(1); setImportResult(null); setRows([]); setFile(null); }}
                className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-low transition-colors"
              >
                ← Quay lại
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover flex items-center gap-2 transition-colors shadow-sm"
              >
                Tiếp tục
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">task_alt</span>
                Xác nhận tạo phiếu nhập
              </h2>

              <div className="bg-surface-low rounded-lg p-4 border border-outline-variant">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs font-bold text-on-surface-variant">NCC:</span>
                    <span className="ml-2 text-on-surface">{suppliers.find((s) => s.id === selectedSupplier)?.name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-on-surface-variant">Tổng dòng hàng:</span>
                    <span className="ml-2 text-on-surface font-semibold">{rows.length}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                    Số hoá đơn <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    placeholder="VD: HD-001234"
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                    Ngày dự kiến nhập
                  </label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                    Ghi chú
                  </label>
                  <textarea
                    rows={1}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ghi chú cho phiếu nhập..."
                    className="w-full px-3 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  />
                </div>
              </div>

              {/* Preview rows */}
              <div className="overflow-x-auto border border-outline-variant rounded-lg">
                <table className="w-full text-sm" style={{ minWidth: 500 }}>
                  <thead>
                    <tr className="bg-surface-low border-b border-outline-variant">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-on-surface-variant">#</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-on-surface-variant">Mã hàng</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-on-surface-variant">Tên</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-on-surface-variant">SL thùng</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-on-surface-variant hidden md:table-cell">Trọng lượng</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-on-surface-variant hidden md:table-cell">BU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => {
                      const itemDisplay = r.match_status === "matched" && r.matched_item
                        ? r.matched_item.code
                        : r.selected_item_id
                          ? r.suggestions?.find((i) => i.id === r.selected_item_id)?.code || r.excel_code
                          : r.excel_code;
                      const nameDisplay = r.match_status === "matched" && r.matched_item
                        ? r.matched_item.short_name
                        : r.selected_item_id
                          ? r.suggestions?.find((i) => i.id === r.selected_item_id)?.short_name || r.excel_name
                          : r.excel_name;
                      return (
                        <tr key={idx} className="border-b border-outline-variant/50">
                          <td className="px-3 py-2 text-xs text-on-surface-variant">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono text-xs font-bold text-primary">{itemDisplay}</td>
                          <td className="px-3 py-2 text-on-surface-variant text-xs">{nameDisplay}</td>
                          <td className="px-3 py-2 text-right font-semibold">{r.excel_qty ?? "—"}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs hidden md:table-cell">{r.excel_weight_kg?.toLocaleString() ?? "—"}</td>
                          <td className="px-3 py-2 text-center text-xs hidden md:table-cell">{r.bu_group ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2.5 border border-outline-variant rounded-lg text-sm hover:bg-surface-low transition-colors"
              >
                ← Quay lại
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">{confirming ? "progress_activity" : "check_circle"}</span>
                {confirming ? "Đang tạo..." : "Tạo phiếu nhập"}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
