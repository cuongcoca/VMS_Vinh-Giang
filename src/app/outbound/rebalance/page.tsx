"use client";
import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { AppLayout } from "@/components/layout/AppLayout";
import { BackButton } from "@/components/BackButton";
import Link from "next/link";

type StagingLine = {
  id: string; qty_box: string; lot: string | null; expiry_date: string | null;
  item_code: { code: string; short_name: string };
  pallet: { id: string; code: string; status: string };
};

type ExcelRow = {
  excel_code: string; excel_name: string; excel_qty: number;
  match_status: "matched" | "over" | "unmatched";
  current_qty: number; new_qty: number;
  pallet_line_id: string | null; pallet_code: string | null;
  merged_rows: number; // số dòng gốc trong file đã gộp vào mã này (>1 = file có dòng trùng)
};

// UC-OUT-05_TC05 — dòng bị loại khi đọc file (SL âm/0/không phải số/thiếu mã/thiếu SL)
type InvalidRow = { row_no: number; code: string; raw_qty: string; reason: string };

// UC-OUT-05_TC03/04/06 — preview phiếu PYX tải từ Excel
type PyxPreviewRow = {
  row_index: number; excel_code: string; excel_name: string;
  system_name: string; excel_qty: number | null; note: string;
  found: boolean; item_code_id: string | null;
};

// UC-OUT-05_TC12: key lưu file cân tồn "tạm hoãn" để giữ lại qua điều hướng/refresh
const POSTPONE_KEY = "wms_rebalance_postpone_v1";

export default function RebalancePage() {
  const [activeTab, setActiveTab] = useState<"manual" | "excel" | "pyx">("manual");
  const [lines, setLines] = useState<(StagingLine & { qty_out: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Excel tab state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelRows, setExcelRows] = useState<ExcelRow[]>([]);
  const [excelInvalid, setExcelInvalid] = useState<InvalidRow[]>([]);
  const [excelFileName, setExcelFileName] = useState(""); // giữ tên file kể cả khi khôi phục từ tạm hoãn
  const [postponed, setPostponed] = useState(false); // preview hiện tại đến từ file đã "tạm hoãn"
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // UC-OUT-05_TC02: ngày xuất hàng cho file SL đã xuất (mặc định hôm nay)
  const [exportDate, setExportDate] = useState(new Date().toISOString().slice(0, 10));

  // UC-OUT-05_TC03/04/06: tải phiếu PYX từ Excel
  const [pyxMode, setPyxMode] = useState<"info" | "excel">("info");
  const [pyxCustomer, setPyxCustomer] = useState("");
  const [pyxShipDate, setPyxShipDate] = useState("");
  const [pyxNote, setPyxNote] = useState("");
  const [pyxFile, setPyxFile] = useState<File | null>(null);
  const [pyxRows, setPyxRows] = useState<PyxPreviewRow[]>([]);
  const [pyxUploading, setPyxUploading] = useState(false);
  const [pyxCreating, setPyxCreating] = useState(false);
  const [pyxCreated, setPyxCreated] = useState<{ id: string; code: string } | null>(null);
  const pyxFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchStagingLines(); }, []);

  const fetchStagingLines = async () => {
    try {
      setLoading(true);
      const res = await fetch("/wms/api/outbound/staging");
      const result = await res.json();
      if (result.success) {
        const allLines: (StagingLine & { qty_out: number })[] = [];
        for (const pallet of result.data) {
          for (const line of pallet.lines) {
            allLines.push({ ...line, pallet: { id: pallet.id, code: pallet.code, status: pallet.status }, qty_out: 0 });
          }
        }
        setLines(allLines);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      // UC-OUT-05_TC12: sau khi load staging, khôi phục file cân tồn "tạm hoãn" (nếu có) từ localStorage
      try {
        const raw = localStorage.getItem(POSTPONE_KEY);
        if (raw) {
          const p = JSON.parse(raw);
          if (p && (p.rows?.length || p.invalid?.length)) {
            setExcelRows(p.rows || []);
            setExcelInvalid(p.invalid || []);
            setExcelFileName(p.fileName || "");
            if (p.exportDate) setExportDate(p.exportDate);
            setPostponed(true);
            setActiveTab("excel");
          }
        }
      } catch { /* ignore */ }
    }
  };

  const updateQtyOut = (lineId: string, value: number) => {
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, qty_out: value } : l));
  };

  const handleConfirmManual = async () => {
    const adjustments = lines.filter(l => l.qty_out > 0).map(l => ({ pallet_line_id: l.id, qty_out: l.qty_out }));
    if (adjustments.length === 0) { setToast({ message: "Chưa nhập SL xuất nào.", type: "error" }); return; }
    if (!window.confirm(`Xác nhận trừ tồn ${adjustments.length} dòng hàng?`)) return;
    setSaving(true);
    try {
      const res = await fetch("/wms/api/outbound/rebalance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustments }),
      });
      const result = await res.json();
      if (result.success) { setToast({ message: result.message, type: "success" }); fetchStagingLines(); }
      else setToast({ message: result.error, type: "error" });
    } catch { setToast({ message: "Lỗi kết nối.", type: "error" }); }
    finally { setSaving(false); setTimeout(() => setToast(null), 4000); }
  };

  // Excel tab handlers
  const handleDownloadTemplate = () => {
    const csv = "Mã hàng,SL đã xuất,Ghi chú\nVG-NM-001,50,Lô 1\nVG-TT-002,30,";
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "template_can_lai_ton.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const handleExcelUpload = async () => {
    if (!excelFile) { setToast({ message: "Chưa chọn file.", type: "error" }); return; }
    setUploading(true);
    try {
      // Parse CSV client-side
      const text = await excelFile.text();
      const rows = text.replace(/^﻿/, "").split(/\r?\n/).filter(r => r.trim());

      // UC-OUT-05_TC05a: file rỗng → báo không có dữ liệu
      if (rows.length === 0) {
        setExcelRows([]); setExcelInvalid([]);
        setToast({ message: "File rỗng — không có dữ liệu xử lý.", type: "error" });
        setUploading(false); return;
      }

      // Tự nhận dấu phân cách: Excel VN hay xuất CSV ngăn bằng ';' thay vì ','
      const delim = rows[0].split(";").length > rows[0].split(",").length ? ";" : ",";
      const splitCells = (r: string) => r.split(delim).map(c => c.trim().replace(/^"|"$/g, ""));

      const header = splitCells(rows[0]).map(c => c.toLowerCase());
      const codeIdx = header.findIndex(c => c.includes("mã") || c.includes("code"));
      const qtyIdx = header.findIndex(c => c.includes("sl") || c.includes("số lượng") || c.includes("qty") || c.includes("quantity"));

      // UC-OUT-05_TC05b: sai định dạng / thiếu cột bắt buộc → nói rõ thiếu cột nào
      if (codeIdx < 0 || qtyIdx < 0) {
        const missing: string[] = [];
        if (codeIdx < 0) missing.push("Mã hàng");
        if (qtyIdx < 0) missing.push("SL đã xuất");
        setExcelRows([]); setExcelInvalid([]);
        setToast({ message: `File thiếu cột bắt buộc: ${missing.join(" & ")}. Tải template để đúng định dạng.`, type: "error" });
        setUploading(false); return;
      }

      // UC-OUT-05_TC05c: chỉ có dòng tiêu đề, không có dữ liệu
      if (rows.length < 2) {
        setExcelRows([]); setExcelInvalid([]);
        setToast({ message: "Không có dữ liệu xử lý — file chỉ có dòng tiêu đề.", type: "error" });
        setUploading(false); return;
      }

      // Phân loại từng dòng dữ liệu. Dòng KHÔNG hợp lệ (thiếu mã/SL, SL âm/0/không phải số)
      // được gom vào `invalid` để BÁO RÕ thay vì bỏ qua âm thầm.
      // Dòng hợp lệ thì gộp dồn theo mã hàng (cùng mã xuất hiện nhiều lần → CỘNG SL trước khi
      // đối chiếu tồn, tránh trừ tồn lặp lúc áp dụng).
      const groups = new Map<string, { code: string; total_qty: number; row_count: number }>();
      const invalid: InvalidRow[] = [];
      rows.slice(1).forEach((row, idx) => {
        const cells = splitCells(row);
        const code = cells[codeIdx] || "";
        const rawQty = cells[qtyIdx] ?? "";
        const rowNo = idx + 2; // 1-based, cộng dòng tiêu đề
        if (!code) { invalid.push({ row_no: rowNo, code: "(trống)", raw_qty: rawQty || "—", reason: "Thiếu mã hàng" }); return; }
        if (rawQty === "") { invalid.push({ row_no: rowNo, code, raw_qty: "(trống)", reason: "Thiếu SL" }); return; }
        const qty = Number(rawQty);
        if (Number.isNaN(qty)) { invalid.push({ row_no: rowNo, code, raw_qty: rawQty, reason: "SL không phải số" }); return; }
        if (qty < 0) { invalid.push({ row_no: rowNo, code, raw_qty: rawQty, reason: "SL âm — không hợp lệ" }); return; }
        if (qty === 0) { invalid.push({ row_no: rowNo, code, raw_qty: rawQty, reason: "SL = 0 — bỏ qua" }); return; }
        const g = groups.get(code);
        if (g) { g.total_qty += qty; g.row_count += 1; }
        else groups.set(code, { code, total_qty: qty, row_count: 1 });
      });

      const parsed: ExcelRow[] = [];
      for (const g of groups.values()) {
        // Match với staging lines
        const matchingLines = lines.filter(l => l.item_code.code === g.code);
        const totalStock = matchingLines.reduce((s, l) => s + Number(l.qty_box), 0);
        const firstLine = matchingLines[0];
        parsed.push({
          excel_code: g.code,
          excel_name: firstLine?.item_code.short_name || "(không tìm thấy)",
          excel_qty: g.total_qty,
          current_qty: totalStock,
          new_qty: Math.max(0, totalStock - g.total_qty),
          match_status: !firstLine ? "unmatched" : g.total_qty > totalStock ? "over" : "matched",
          pallet_line_id: firstLine?.id || null,
          pallet_code: firstLine?.pallet.code || null,
          merged_rows: g.row_count,
        });
      }
      setExcelRows(parsed);
      setExcelInvalid(invalid);
      setExcelFileName(excelFile.name);
      setPostponed(false); // file mới đọc, không phải bản tạm hoãn khôi phục

      // Toast tổng hợp — đỏ (cảnh báo) nếu có dòng lỗi / mã không tồn tại / không có gì hợp lệ
      const dupCount = parsed.filter(r => r.merged_rows > 1).length;
      const unmatchedCount = parsed.filter(r => r.match_status === "unmatched").length;
      const notes: string[] = [];
      if (dupCount) notes.push(`gộp ${dupCount} mã trùng`);
      if (unmatchedCount) notes.push(`${unmatchedCount} mã không tồn tại`);
      if (invalid.length) notes.push(`${invalid.length} dòng SL không hợp lệ`);
      setToast({
        message: parsed.length === 0
          ? (invalid.length > 0
              ? `Không có dòng hợp lệ — ${invalid.length} dòng bị loại (SL âm/0/sai/thiếu).`
              : "Không có dữ liệu hợp lệ để xử lý.")
          : `Đọc ${parsed.length} mã hàng${notes.length ? " — " + notes.join(", ") : ""}.`,
        type: (parsed.length === 0 || unmatchedCount > 0 || invalid.length > 0) ? "error" : "success",
      });
    } catch (err) {
      console.error(err);
      setToast({ message: "Lỗi khi đọc file. Kiểm tra lại file có đúng định dạng CSV không.", type: "error" });
    } finally { setUploading(false); setTimeout(() => setToast(null), 6000); }
  };

  const handleConfirmExcel = async () => {
    const validRows = excelRows.filter(r => r.match_status === "matched" && r.pallet_line_id);
    if (validRows.length === 0) { setToast({ message: "Không có dòng nào hợp lệ để apply.", type: "error" }); return; }
    if (!window.confirm(`Áp dụng ${validRows.length} dòng (bỏ qua ${excelRows.length - validRows.length} dòng có cảnh báo)?`)) return;
    setSaving(true);
    try {
      const adjustments = validRows.map(r => ({ pallet_line_id: r.pallet_line_id, qty_out: r.excel_qty }));
      const res = await fetch("/wms/api/outbound/rebalance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustments, source: "EXCEL_UPLOAD", file_name: excelFile?.name, export_date: exportDate }),
      });
      const result = await res.json();
      if (result.success) {
        setToast({ message: `Đã apply ${validRows.length} dòng từ Excel.`, type: "success" });
        setExcelRows([]); setExcelInvalid([]); setExcelFile(null); setExcelFileName(""); setPostponed(false);
        try { localStorage.removeItem(POSTPONE_KEY); } catch { /* ignore */ }
        fetchStagingLines();
      } else setToast({ message: result.error, type: "error" });
    } catch { setToast({ message: "Lỗi kết nối.", type: "error" }); }
    finally { setSaving(false); setTimeout(() => setToast(null), 4000); }
  };

  // UC-OUT-05_TC12: Tạm hoãn — KHÔNG trừ tồn, lưu lại file/preview để cân sau (giữ qua refresh/điều hướng)
  const handlePostponeExcel = () => {
    if (excelRows.length === 0 && excelInvalid.length === 0) {
      setToast({ message: "Chưa có file nào để tạm hoãn.", type: "error" }); return;
    }
    try {
      localStorage.setItem(POSTPONE_KEY, JSON.stringify({
        rows: excelRows, invalid: excelInvalid, fileName: excelFileName, exportDate, savedAt: new Date().toISOString(),
      }));
      setPostponed(true);
      setToast({ message: "Đã tạm hoãn — giữ lại file, chưa trừ tồn. Quay lại trang sẽ thấy lại để cân tiếp.", type: "success" });
    } catch {
      setToast({ message: "Không lưu được file tạm hoãn (trình duyệt chặn localStorage).", type: "error" });
    }
    setTimeout(() => setToast(null), 5000);
  };

  // UC-OUT-05_TC13: Hủy — bỏ file vừa up, KHÔNG cập nhật tồn kho, về trạng thái ban đầu
  const handleCancelExcel = () => {
    setExcelRows([]); setExcelInvalid([]); setExcelFile(null); setExcelFileName(""); setPostponed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    try { localStorage.removeItem(POSTPONE_KEY); } catch { /* ignore */ }
    setToast({ message: "Đã hủy thao tác cân tồn — không cập nhật tồn kho.", type: "success" });
    setTimeout(() => setToast(null), 4000);
  };

  // ── UC-OUT-05_TC03/04/06: PYX từ Excel ──
  const handlePyxDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Mã hàng", "SL yêu cầu", "Ghi chú"],
      ["VG-NM-001", 50, "Giao gấp"],
      ["VG-TT-002", 30, ""],
    ]);
    ws["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PhieuYeuCauXuat");
    XLSX.writeFile(wb, "template_phieu_yeu_cau_xuat.xlsx");
  };

  const handlePyxParse = async () => {
    if (!pyxFile) { setToast({ message: "Chưa chọn file.", type: "error" }); return; }
    setPyxUploading(true);
    setPyxCreated(null);
    try {
      const fd = new FormData();
      fd.append("file", pyxFile);
      fd.append("customer", pyxCustomer);
      fd.append("ship_date", pyxShipDate);
      fd.append("note", pyxNote);
      fd.append("dry_run", "true");
      const res = await fetch("/wms/api/outbound/requests/import", { method: "POST", body: fd });
      const result = await res.json();
      if (result.success) {
        setPyxRows(result.data.rows);
        const s = result.data.summary;
        setToast({ message: `Đọc ${s.total} dòng — khớp ${s.matched}, không khớp ${s.unmatched}.`, type: "success" });
      } else {
        // TC04: file sai định dạng
        setPyxRows([]);
        setToast({ message: result.error || "Lỗi đọc file.", type: "error" });
      }
    } catch {
      setToast({ message: "Lỗi kết nối khi đọc file.", type: "error" });
    } finally { setPyxUploading(false); setTimeout(() => setToast(null), 5000); }
  };

  const handlePyxCreate = async () => {
    if (!pyxFile) { setToast({ message: "Chưa chọn file.", type: "error" }); return; }
    if (!pyxCustomer.trim()) { setToast({ message: "Vui lòng nhập tên khách hàng.", type: "error" }); return; }
    const validCount = pyxRows.filter(r => r.found && r.excel_qty && r.excel_qty > 0).length;
    if (validCount === 0) { setToast({ message: "Không có dòng hàng hợp lệ để tạo phiếu.", type: "error" }); return; }
    if (!window.confirm(`Tạo phiếu PYX cho "${pyxCustomer.trim()}" với ${validCount} dòng hàng?`)) return;
    setPyxCreating(true);
    try {
      const fd = new FormData();
      fd.append("file", pyxFile);
      fd.append("customer", pyxCustomer);
      fd.append("ship_date", pyxShipDate);
      fd.append("note", pyxNote);
      fd.append("dry_run", "false");
      const res = await fetch("/wms/api/outbound/requests/import", { method: "POST", body: fd });
      const result = await res.json();
      if (result.success) {
        setPyxCreated({ id: result.data.id, code: result.data.code });
        setToast({ message: `Đã tạo phiếu ${result.data.code} (${result.data.lines.length} dòng).`, type: "success" });
        setPyxRows([]); setPyxFile(null);
        if (pyxFileInputRef.current) pyxFileInputRef.current.value = "";
      } else setToast({ message: result.error || "Lỗi tạo phiếu.", type: "error" });
    } catch {
      setToast({ message: "Lỗi kết nối khi tạo phiếu.", type: "error" });
    } finally { setPyxCreating(false); setTimeout(() => setToast(null), 5000); }
  };

  const pyxValidCount = pyxRows.filter(r => r.found && r.excel_qty && r.excel_qty > 0).length;

  const hasAdjustments = lines.some(l => l.qty_out > 0);

  return (
    <AppLayout title="CÂN LẠI TỒN">
      <div className="p-6 space-y-5">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
            <span className="material-symbols-outlined text-[18px]">{toast.type === "success" ? "check_circle" : "error"}</span>{toast.message}
          </div>
        )}
        <BackButton fallback="/outbound">Quay lại</BackButton>
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[28px]">balance</span> Cân lại tồn khu chờ xuất
        </h1>
        <p className="text-sm text-on-surface-variant">Chọn 1 trong 3 cách để cập nhật tồn ở khu chờ xuất sau khi giao hàng.</p>

        {/* 3 Tabs */}
        <div className="flex border-b border-outline-variant gap-2">
          {[
            { key: "manual", label: "Cách 3 · Nhập tay từng dòng", icon: "edit_note" },
            { key: "excel", label: "Cách 1 · Up file Excel SL đã xuất", icon: "upload_file" },
            { key: "pyx", label: "Cách 2 · Phiếu yêu cầu xuất (PYX)", icon: "description" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as "manual" | "excel" | "pyx")}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-primary hover:border-outline-variant"}`}>
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        {/* TAB EXCEL — Upload + Preview */}
        {activeTab === "excel" && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <div>
                <p className="font-semibold">Hướng dẫn:</p>
                <ol className="list-decimal list-inside mt-1 space-y-0.5 text-xs">
                  <li>Tải template CSV (cột: Mã hàng | SL đã xuất | Ghi chú).</li>
                  <li>Điền data theo NCC/khách → save file.</li>
                  <li>Upload lên → preview so với tồn thực tế.</li>
                  <li>Dòng "Khớp" sẽ apply trừ tồn; dòng "Vượt tồn" hoặc "Không khớp" sẽ skip.</li>
                </ol>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-outline-variant p-5 shadow-sm space-y-4">
              <div className="flex items-end gap-3 flex-wrap">
                {/* UC-OUT-05_TC02: chọn ngày xuất hàng */}
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Ngày xuất hàng</label>
                  <input type="date" value={exportDate} onChange={(e) => setExportDate(e.target.value)} className="px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <button onClick={handleDownloadTemplate}
                  className="px-4 py-2 bg-surface-low text-on-surface rounded-lg text-sm font-semibold hover:bg-surface-mid flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">download</span>Tải template CSV
                </button>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={e => setExcelFile(e.target.files?.[0] || null)} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 border border-primary text-primary rounded-lg text-sm font-semibold hover:bg-primary/5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">attach_file</span>{excelFile?.name || excelFileName || "Chọn file CSV"}
                </button>
                <button onClick={handleExcelUpload} disabled={!excelFile || uploading}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 disabled:opacity-50">
                  <span className="material-symbols-outlined text-[18px]">{uploading ? "progress_activity" : "search"}</span>Đọc & Đối chiếu
                </button>
              </div>
            </div>

            {/* UC-OUT-05_TC12: banner báo đang xem file cân tồn ĐÃ TẠM HOÃN (khôi phục lại) */}
            {postponed && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                <div>
                  <p className="font-semibold">Đang có file cân tồn tạm hoãn{excelFileName ? `: ${excelFileName}` : ""}</p>
                  <p className="text-xs mt-0.5">File đã được giữ lại (chưa trừ tồn). Bấm <b>Áp dụng Excel</b> bên dưới để hoàn tất, hoặc <b>Hủy</b> để bỏ.</p>
                </div>
              </div>
            )}

            {/* UC-OUT-05_TC: luôn hiển thị bảng cấu trúc file Excel mẫu (kể cả khi chưa upload) để user biết file cần gì */}
            <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-outline-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">table_view</span>
                <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Cấu trúc file Excel mẫu</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 480 }}>
                  <thead className="bg-surface-low/50 border-b border-outline-variant">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Mã hàng <span className="text-rose-500">*</span></th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">SL đã xuất <span className="text-rose-500">*</span></th>
                      <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-outline-variant/40">
                      <td className="px-4 py-2.5 font-mono text-xs">VG-NM-001</td>
                      <td className="px-4 py-2.5 text-right font-mono">50</td>
                      <td className="px-4 py-2.5 text-xs text-on-surface-variant">Lô 1</td>
                    </tr>
                    <tr className="border-b border-outline-variant/40">
                      <td className="px-4 py-2.5 font-mono text-xs">VG-TT-002</td>
                      <td className="px-4 py-2.5 text-right font-mono">30</td>
                      <td className="px-4 py-2.5 text-xs text-on-surface-variant">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-2.5 border-t border-outline-variant bg-surface-low/30 text-xs text-on-surface-variant">
                Cột <b>Mã hàng</b> và <b>SL đã xuất</b> bắt buộc. Hỗ trợ CSV ngăn bằng dấu phẩy hoặc chấm phẩy. Bấm <b>Tải template CSV</b> để lấy file mẫu này.
              </div>
            </div>

            {excelRows.length > 0 && (
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Xem trước {excelRows.length} mã hàng</h3>
                  <div className="flex gap-2 text-xs flex-wrap">
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full font-semibold">✓ Khớp: {excelRows.filter(r => r.match_status === "matched").length}</span>
                    <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full font-semibold">⚠ Vượt tồn: {excelRows.filter(r => r.match_status === "over").length}</span>
                    <span className="px-2 py-1 bg-rose-50 text-rose-700 rounded-full font-semibold">✗ Không khớp: {excelRows.filter(r => r.match_status === "unmatched").length}</span>
                    {excelRows.some(r => r.merged_rows > 1) && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full font-semibold">⚠ Trùng (đã gộp): {excelRows.filter(r => r.merged_rows > 1).length}</span>
                    )}
                  </div>
                </div>
                <table className="w-full text-sm" style={{ minWidth: 700 }}>
                  <thead className="bg-surface-low/50 border-b border-outline-variant">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Mã hàng</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Tên hàng</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden md:table-cell">Pallet</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Tồn hiện tại</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Số lượng</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Tồn mới</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelRows.map((r, i) => (
                      <tr key={i} className={`border-b border-outline-variant/40 ${r.match_status === "over" ? "bg-amber-50/30" : r.match_status === "unmatched" ? "bg-rose-50/30" : ""}`}>
                        <td className="px-4 py-2.5 font-mono font-bold text-primary text-xs">{r.excel_code}</td>
                        <td className="px-4 py-2.5">{r.excel_name}</td>
                        <td className="px-4 py-2.5 hidden md:table-cell font-mono text-xs text-on-surface-variant">{r.pallet_code || "—"}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{r.current_qty}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">{r.excel_qty}</td>
                        <td className={`px-4 py-2.5 text-right font-mono font-bold ${r.new_qty < 0 || r.match_status === "over" ? "text-rose-600" : "text-emerald-600"}`}>{r.match_status === "unmatched" ? "—" : r.new_qty}</td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {r.match_status === "matched" && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">✓ Khớp</span>}
                            {r.match_status === "over" && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">⚠ Vượt</span>}
                            {r.match_status === "unmatched" && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700">✗ Không khớp</span>}
                            {r.merged_rows > 1 && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700" title={`File có ${r.merged_rows} dòng cùng mã hàng này — đã cộng dồn SL`}>⚠ Trùng · gộp {r.merged_rows} dòng</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-5 py-4 border-t border-outline-variant bg-amber-50/30 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm text-on-surface">
                    Sẽ apply <b className="text-emerald-700 font-mono">{excelRows.filter(r => r.match_status === "matched").length}</b> dòng "Khớp". Còn lại skip.
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* UC-OUT-05_TC13: Hủy — không cập nhật tồn kho */}
                    <button onClick={handleCancelExcel} disabled={saving}
                      className="px-4 py-2.5 border border-rose-300 text-rose-600 rounded-lg text-sm font-semibold hover:bg-rose-50 flex items-center gap-2 disabled:opacity-50">
                      <span className="material-symbols-outlined text-[18px]">close</span>Hủy
                    </button>
                    {/* UC-OUT-05_TC12: Tạm hoãn — giữ lại file để cân sau */}
                    <button onClick={handlePostponeExcel} disabled={saving}
                      className="px-4 py-2.5 border border-amber-400 text-amber-700 rounded-lg text-sm font-semibold hover:bg-amber-50 flex items-center gap-2 disabled:opacity-50">
                      <span className="material-symbols-outlined text-[18px]">schedule</span>Tạm hoãn (giữ file)
                    </button>
                    <button onClick={handleConfirmExcel} disabled={saving || excelRows.filter(r => r.match_status === "matched").length === 0}
                      className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 disabled:opacity-50 shadow-sm">
                      <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "check_circle"}</span>
                      Áp dụng Excel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* UC-OUT-05_TC05: bảng dòng bị loại + lý do (SL âm / SL = 0 / không phải số / thiếu mã / thiếu SL) */}
            {excelInvalid.length > 0 && (
              <div className="bg-white rounded-xl border border-rose-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-rose-200 bg-rose-50/60 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-rose-600">error</span>
                  <h3 className="text-sm font-bold text-rose-700 uppercase tracking-wider">{excelInvalid.length} dòng bị loại — dữ liệu không hợp lệ</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: 560 }}>
                    <thead className="bg-surface-low/50 border-b border-outline-variant">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant w-16">Dòng</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Mã hàng</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">SL trong file</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Lý do</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excelInvalid.map((r, i) => (
                        <tr key={i} className="border-b border-outline-variant/40 bg-rose-50/20">
                          <td className="px-4 py-2.5 font-mono text-xs text-on-surface-variant">{r.row_no}</td>
                          <td className="px-4 py-2.5 font-mono text-xs">{r.code}</td>
                          <td className="px-4 py-2.5 text-right font-mono">{r.raw_qty}</td>
                          <td className="px-4 py-2.5 text-xs font-semibold text-rose-600">{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-outline-variant bg-rose-50/30 text-xs text-rose-700">
                  Các dòng này sẽ <b>không</b> được áp dụng. Sửa lại SL/mã hàng trong file rồi tải lại.
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB PYX — Phiếu yêu cầu xuất: thủ công hoặc tải từ Excel */}
        {activeTab === "pyx" && pyxMode === "info" && (
          <div className="bg-white rounded-xl border border-outline-variant p-8 shadow-sm text-center space-y-4">
            <span className="material-symbols-outlined text-[64px] text-primary/40">description</span>
            <h3 className="text-lg font-bold text-on-surface">Phiếu yêu cầu xuất (PYX)</h3>
            <p className="text-sm text-on-surface-variant max-w-lg mx-auto">
              Tạo phiếu PYX-YYYY-NNNN cho từng đơn hàng giao đi. Có thể nhập tay từng dòng hoặc <b>tải lên từ file Excel</b> để tạo nhanh nhiều dòng hàng.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
              <button onClick={() => { setPyxMode("excel"); setPyxCreated(null); }}
                className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 shadow-sm">
                <span className="material-symbols-outlined text-[18px]">upload_file</span>Tải lên từ Excel
              </button>
              <Link href="/outbound/requests/new" className="px-5 py-2.5 border border-primary text-primary rounded-lg text-sm font-semibold hover:bg-primary/5 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">edit_note</span>Tạo phiếu thủ công
              </Link>
              <Link href="/outbound/requests" className="px-5 py-2.5 border border-outline-variant text-on-surface rounded-lg text-sm font-semibold hover:bg-surface-low flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">list</span>Danh sách phiếu PYX
              </Link>
            </div>
          </div>
        )}

        {/* TAB PYX — Tải lên từ Excel (UC-OUT-05_TC03/04/06) */}
        {activeTab === "pyx" && pyxMode === "excel" && (
          <div className="space-y-4">
            <button onClick={() => { setPyxMode("info"); setPyxRows([]); }} className="text-sm text-primary hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>Quay lại
            </button>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <div>
                <p className="font-semibold">Tạo phiếu PYX từ file Excel:</p>
                <ol className="list-decimal list-inside mt-1 space-y-0.5 text-xs">
                  <li>Tải template (cột: Mã hàng | SL yêu cầu | Ghi chú).</li>
                  <li>Điền data → save file (.xlsx hoặc .csv).</li>
                  <li>Nhập Khách hàng + Ngày giao, chọn file → "Đọc & Đối chiếu".</li>
                  <li>Đối chiếu mã hàng với hệ thống → "Tạo phiếu PYX".</li>
                </ol>
              </div>
            </div>

            {pyxCreated && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800 flex items-center justify-between gap-3 flex-wrap">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  Đã tạo phiếu <b className="font-mono">{pyxCreated.code}</b> thành công.
                </span>
                <Link href={`/outbound/requests/${pyxCreated.id}`} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">visibility</span>Xem chi tiết phiếu
                </Link>
              </div>
            )}

            <div className="bg-white rounded-xl border border-outline-variant p-5 shadow-sm space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Khách hàng / Người nhận <span className="text-rose-500">*</span></label>
                  <input type="text" value={pyxCustomer} onChange={(e) => setPyxCustomer(e.target.value)} placeholder="VD: NPP miền Bắc"
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Ngày giao dự kiến</label>
                  <input type="date" value={pyxShipDate} onChange={(e) => setPyxShipDate(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant mb-1">Ghi chú</label>
                  <input type="text" value={pyxNote} onChange={(e) => setPyxNote(e.target.value)} placeholder="Ghi chú thêm..."
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div className="flex items-end gap-3 flex-wrap pt-1">
                <button onClick={handlePyxDownloadTemplate}
                  className="px-4 py-2 bg-surface-low text-on-surface rounded-lg text-sm font-semibold hover:bg-surface-mid flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">download</span>Tải template Excel
                </button>
                <input ref={pyxFileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => { setPyxFile(e.target.files?.[0] || null); setPyxRows([]); }} className="hidden" />
                <button onClick={() => pyxFileInputRef.current?.click()}
                  className="px-4 py-2 border border-primary text-primary rounded-lg text-sm font-semibold hover:bg-primary/5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">attach_file</span>{pyxFile ? pyxFile.name : "Chọn file Excel/CSV"}
                </button>
                <button onClick={handlePyxParse} disabled={!pyxFile || pyxUploading}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 disabled:opacity-50">
                  <span className="material-symbols-outlined text-[18px]">{pyxUploading ? "progress_activity" : "search"}</span>Đọc & Đối chiếu
                </button>
              </div>
            </div>

            {pyxRows.length > 0 && (
              <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Đối chiếu {pyxRows.length} dòng từ file</h3>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full font-semibold">✓ Tìm thấy: {pyxValidCount}</span>
                    <span className="px-2 py-1 bg-rose-50 text-rose-700 rounded-full font-semibold">✗ Không khớp: {pyxRows.length - pyxValidCount}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: 720 }}>
                    <thead className="bg-surface-low/50 border-b border-outline-variant">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant w-10">#</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Mã hàng</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Tên hàng</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Số lượng</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant hidden md:table-cell">Ghi chú</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase text-on-surface-variant">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pyxRows.map((r, i) => {
                        const ok = r.found && !!r.excel_qty && r.excel_qty > 0;
                        return (
                          <tr key={i} className={`border-b border-outline-variant/40 ${ok ? "" : "bg-rose-50/30"}`}>
                            <td className="px-4 py-2.5 text-on-surface-variant/70 font-mono text-xs">{i + 1}</td>
                            <td className="px-4 py-2.5 font-mono font-bold text-primary text-xs">{r.excel_code || "—"}</td>
                            <td className="px-4 py-2.5">{r.found ? r.system_name : <span className="text-rose-600 italic">không tìm thấy trong hệ thống</span>}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-semibold">{r.excel_qty ?? "—"}</td>
                            <td className="px-4 py-2.5 hidden md:table-cell text-xs text-on-surface-variant">{r.note || "—"}</td>
                            <td className="px-4 py-2.5 text-center">
                              {ok
                                ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">✓ Tìm thấy</span>
                                : <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700">✗ Không khớp</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-4 border-t border-outline-variant bg-emerald-50/30 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm text-on-surface">
                    Sẽ tạo phiếu với <b className="text-emerald-700 font-mono">{pyxValidCount}</b> dòng "Tìm thấy". Còn lại bỏ qua.
                  </span>
                  <button onClick={handlePyxCreate} disabled={pyxCreating || pyxValidCount === 0 || !pyxCustomer.trim()}
                    className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95 flex items-center gap-2 disabled:opacity-50 shadow-sm">
                    <span className="material-symbols-outlined text-[18px]">{pyxCreating ? "progress_activity" : "check_circle"}</span>
                    Tạo phiếu PYX
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB MANUAL — existing UI */}
        {activeTab === "manual" && (
          <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 700 }}>
                <thead>
                  <tr className="bg-surface-low/50 border-b border-outline-variant">
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Pallet</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Mã hàng</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tên hàng</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tồn hiện tại</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Số lượng</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Tồn mới</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase tracking-wider text-on-surface-variant">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-12"><span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span></td></tr>
                  ) : lines.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-on-surface-variant">Không có dòng hàng nào ở khu chờ xuất.</td></tr>
                  ) : lines.map(l => {
                    const current = Number(l.qty_box);
                    const newQty = Math.max(0, current - l.qty_out);
                    return (
                      <tr key={l.id} className={`border-b border-outline-variant/40 transition-colors ${l.qty_out > 0 ? "bg-amber-50/50" : "hover:bg-surface-low/50"}`}>
                        <td className="px-4 py-2.5 font-mono font-bold text-primary text-xs">{l.pallet.code}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{l.item_code.code}</td>
                        <td className="px-4 py-2.5 text-sm">{l.item_code.short_name}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{current}</td>
                        <td className="px-4 py-2.5 text-right">
                          <input type="number" min="0" max={current} step="0.01" value={l.qty_out || ""} onChange={e => updateQtyOut(l.id, Number(e.target.value))}
                            placeholder="0" className="w-20 px-2 py-1 text-right text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold ${newQty <= 0 ? "text-rose-600" : l.qty_out > 0 ? "text-amber-600" : "text-on-surface-variant/70"}`}>
                          {l.qty_out > 0 ? newQty : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {l.qty_out === 0
                            ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-low text-on-surface-variant">Chưa nhập</span>
                            : l.qty_out > current
                              ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">⚠ Vượt tồn</span>
                              : <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">✓ Hợp lệ</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {hasAdjustments && (
              <div className="px-5 py-4 border-t border-outline-variant bg-amber-50/50 flex items-center justify-between">
                <span className="text-sm text-amber-800"><strong>{lines.filter(l => l.qty_out > 0).length}</strong> dòng sẽ bị trừ tồn</span>
                <button onClick={handleConfirmManual} disabled={saving}
                  className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover flex items-center gap-2 disabled:opacity-50 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "check_circle"}</span>
                  Xác nhận trừ tồn
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
