"use client";

import React from "react";

/**
 * ScanField — hàng "select/input + nút Quét QR" dùng chung cho mọi màn mobile.
 *
 * Mục tiêu: chuẩn hoá bố cục co giãn để KHÔNG bị tràn/cắt khung trên điện thoại
 * (gốc lỗi FK-01, FK-08, TK-06, KK-01...). Quy tắc:
 *  - Trên màn nhỏ: xếp dọc (select trên, nút dưới) → không bao giờ tràn.
 *  - Từ sm trở lên: nằm ngang, select co được nhờ `min-w-0`, nút `shrink-0`.
 *
 * Lưu ý: phần tử con (select/input) NÊN có class `w-full` để lấp đầy ô bọc.
 * Bản thân modal quét (BarcodeScanner) vẫn do trang sở hữu; ScanField chỉ lo
 * bố cục + nút mở scanner qua `onScan`.
 */
export function ScanField({
  label,
  required = false,
  htmlFor,
  hint,
  onScan,
  scanLabel = "Quét QR",
  scanColorClass = "bg-indigo-600 hover:bg-indigo-700",
  children,
}: {
  label?: string;
  required?: boolean;
  htmlFor?: string;
  hint?: React.ReactNode;
  onScan: () => void;
  scanLabel?: string;
  scanColorClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5"
        >
          {label} {required && <span className="text-rose-500">*</span>}
          {hint}
        </label>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="w-full sm:flex-1 min-w-0">{children}</div>
        <button
          type="button"
          onClick={onScan}
          aria-label={scanLabel}
          className={`w-full sm:w-auto shrink-0 justify-center min-h-[44px] px-3 py-2.5 ${scanColorClass} text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors`}
        >
          <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
          {scanLabel}
        </button>
      </div>
    </div>
  );
}
