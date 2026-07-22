"use client";

/**
 * Phân trang CLIENT-SIDE dùng chung cho mọi trang hiển thị danh sách.
 *
 * Dùng cho các trang fetch toàn bộ mảng rồi render (không phân trang ở API).
 * Mục tiêu: TC_PENDING_004 — "mọi trang hiển thị danh sách bắt buộc có phân trang".
 *
 * Cách dùng:
 *   const pg = useClientPagination(filtered, { resetKey: `${search}|${status}` });
 *   // render pg.paged thay cho mảng đầy đủ
 *   <ListPageFooter {...pg} unit="phiếu" />
 */

import React, { useEffect, useMemo, useState } from "react";
import { Pagination } from "./Pagination";

export function useClientPagination<T>(
  items: T[],
  opts?: { initialLimit?: number; resetKey?: unknown }
) {
  const initialLimit = opts?.initialLimit ?? 10;
  const resetKey = opts?.resetKey;

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Reset về trang 1 khi bộ lọc/tìm kiếm thay đổi.
  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  // Kẹp trang hiện tại trong khoảng hợp lệ khi danh sách thu nhỏ (vd sau khi xóa).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paged = useMemo(
    () => items.slice((page - 1) * limit, page * limit),
    [items, page, limit]
  );

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return { page, setPage, limit, setLimit, total, totalPages, paged, from, to };
}

type ListPageFooterProps = {
  page: number;
  setPage: (p: number) => void;
  limit: number;
  setLimit: (n: number) => void;
  total: number;
  totalPages: number;
  from: number;
  to: number;
  /** Đơn vị hiển thị, vd "phiếu", "pallet", "mã hàng". */
  unit?: string;
  /** Các lựa chọn số dòng/trang (mặc định 5/10/20/50). */
  options?: number[];
  className?: string;
};

/**
 * Footer phân trang chuẩn: "x - y / tổng" + chọn số dòng/trang + nút trang.
 * Luôn hiển thị selector số dòng/trang khi có dữ liệu (kể cả 1 trang) để
 * kiểm thử được với danh sách ít bản ghi. Nút trang tự ẩn khi chỉ 1 trang.
 */
export function ListPageFooter({
  page,
  setPage,
  limit,
  setLimit,
  total,
  totalPages,
  from,
  to,
  unit,
  options = [5, 10, 20, 50],
  className = "",
}: ListPageFooterProps) {
  if (total === 0) return null;
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 border-t border-surface-low gap-3 flex-wrap ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs text-on-surface-variant">
          {from} - {to} / {total}
          {unit ? ` ${unit}` : ""}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-on-surface-variant">Số dòng/trang:</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value, 10));
              setPage(1);
            }}
            className="px-2 py-1 bg-surface-low rounded-lg border-0 text-xs focus:ring-2 focus:ring-primary/20"
          >
            {options.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
