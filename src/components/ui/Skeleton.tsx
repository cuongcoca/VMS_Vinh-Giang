"use client";

import React from "react";

/**
 * Skeleton — khối "xương" nhấp nháy nhẹ dùng khi đang tải, thay cho spinner-rồi-nhảy.
 * Giữ ĐÚNG bố cục cuối (cùng số dòng/cột, cùng chiều cao) → nội dung không nhảy giật
 * khi dữ liệu về (UX chuyên nghiệp).
 */
export function Skeleton({
  className = "",
  rounded = "rounded",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`block bg-surface-variant/70 animate-pulse ${rounded} ${className}`}
    />
  );
}

/**
 * TableSkeleton — N dòng × M cột ô xương, cao đều để bảng KHÔNG co/giãn khi load.
 * Dùng bên trong <tbody>. `widths` (tuỳ chọn) đặt bề rộng tương đối từng cột.
 */
export function TableSkeleton({
  rows = 8,
  cols,
  widths,
}: {
  rows?: number;
  cols: number;
  widths?: string[];
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-outline-variant/40">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <Skeleton className={`h-4 ${widths?.[c] ?? (c === 0 ? "w-3/4" : "w-1/2")}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
