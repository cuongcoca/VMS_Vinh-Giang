"use client";

/**
 * UI/Pagination — Replace copy-paste 20 dòng pagination khắp các page.
 *
 * Sử dụng:
 *   <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
 */

import React from "react";

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  className?: string;
};

export function Pagination({ page, totalPages, onPageChange, className = "" }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = computePageRange(page, totalPages);

  return (
    <div className={`flex items-center justify-center gap-1 ${className}`} role="navigation" aria-label="Phân trang">
      <button
        onClick={() => onPageChange(1)}
        disabled={page === 1}
        className="p-1.5 rounded hover:bg-surface-low disabled:opacity-30 transition-colors"
        aria-label="Trang đầu"
      >
        <span className="material-symbols-outlined text-[18px]">first_page</span>
      </button>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="p-1.5 rounded hover:bg-surface-low disabled:opacity-30 transition-colors"
        aria-label="Trang trước"
      >
        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
      </button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`gap-${i}`} className="px-2 text-on-surface-variant text-sm">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            aria-current={p === page ? "page" : undefined}
            className={`min-w-[32px] h-8 rounded text-sm font-medium transition-colors ${
              p === page
                ? "bg-primary text-white"
                : "hover:bg-surface-low text-on-surface-variant"
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="p-1.5 rounded hover:bg-surface-low disabled:opacity-30 transition-colors"
        aria-label="Trang sau"
      >
        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={page === totalPages}
        className="p-1.5 rounded hover:bg-surface-low disabled:opacity-30 transition-colors"
        aria-label="Trang cuối"
      >
        <span className="material-symbols-outlined text-[18px]">last_page</span>
      </button>
    </div>
  );
}

function computePageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}
