"use client";
import { useToast } from "@/components/ui";
import React from "react";

interface ExcelExportColumn {
  key: string;
  header: string;
  transform?: (value: unknown) => string | number;
}

interface ExcelExportProps {
  data?: Record<string, unknown>[];
  fetchData?: () => Promise<Record<string, unknown>[]>;
  columns: ExcelExportColumn[];
  filename?: string;
  className?: string;
  label?: string;
}

export function ExcelExport({
  data = [],
  fetchData,
  columns,
  filename = "export",
  className = "",
  label = "Xuất Excel",
}: ExcelExportProps) {
  const [exporting, setExporting] = React.useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setExporting(true);
    let dataset = data;
    try {
      if (fetchData) {
        dataset = await fetchData();
      }
      if (!dataset || dataset.length === 0) {
        toast.error("Không có dữ liệu để xuất.");
        setExporting(false);
        return;
      }

      const XLSX = await import("xlsx");

      // Transform data to match columns
      const rows = dataset.map(row => {
        const obj: Record<string, unknown> = {};
        for (const col of columns) {
          const raw = row[col.key];
          obj[col.header] = col.transform ? col.transform(raw) : raw;
        }
        return obj;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

      // Auto-size columns
      const colWidths = columns.map(col => {
        const maxLen = Math.max(
          col.header.length,
          ...rows.map(r => String(r[col.header] ?? "").length)
        );
        return { wch: Math.min(maxLen + 2, 40) };
      });
      ws["!cols"] = colWidths;

      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `${filename}_${dateStr}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Lỗi khi xuất file Excel.");
    } finally {
      setExporting(false);
    }
  };

  const hasData = fetchData || (data && data.length > 0);

  return (
    <button
      onClick={handleExport}
      disabled={exporting || !hasData}
      className={`inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors ${className}`}
    >
      <span className="material-symbols-outlined text-[16px]">
        {exporting ? "progress_activity" : "download"}
      </span>
      {exporting ? "Đang xuất..." : label}
    </button>
  );
}
