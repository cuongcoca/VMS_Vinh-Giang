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

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pagination } from "./Pagination";

export function useClientPagination<T>(
  items: T[],
  opts?: {
    initialLimit?: number;
    resetKey?: unknown;
    /**
     * Nhớ trang đang xem để rời màn hình rồi quay lại không bị mất.
     * - `true` (mặc định): bật
     * - chuỗi: thêm tiền tố, dùng khi 1 trang có nhiều bảng (vd `rememberKey: "b"`)
     * - `false`: tắt hẳn
     */
    rememberKey?: string | boolean;
  }
) {
  const initialLimit = opts?.initialLimit ?? 10;
  const resetKey = opts?.resetKey;
  const rememberKey = opts?.rememberKey ?? true;

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Tiền tố cho phép 2 bảng trên cùng một trang không ghi đè nhau.
  const prefix = typeof rememberKey === "string" && rememberKey ? `${rememberKey}:` : "";
  const rememberEnabled = rememberKey !== false;

  // ─── Lưu/khôi phục trang khi rời màn hình rồi quay lại ───────────────
  //
  // Vì sao dùng sessionStorage chứ không phải URL:
  //   Đã thử ghi `?page=` bằng `window.history.replaceState`. URL đổi đúng, nhưng
  //   khi bấm Quay lại thì App Router dựng lại địa chỉ từ state nội bộ của nó
  //   (`__PRIVATE_NEXTJS_INTERNALS_TREE.renderedSearch` vẫn là chuỗi rỗng) nên
  //   query bị mất → vẫn nhảy về trang 1. Đo trực tiếp trên Next 16.2.6.
  //   sessionStorage không phụ thuộc router, và tự hết khi đóng tab nên không
  //   để lại trạng thái cũ cho lần mở app sau.
  const storageKey =
    typeof window !== "undefined" ? `wms:pagination:${window.location.pathname}:${prefix}` : "";

  // Khôi phục 1 lần sau khi mount. Phải đọc trong effect chứ không đọc lúc
  // render: server render ra page=1, đọc lúc render sẽ lệch hydration.
  const restoredRef = useRef(false);
  const [restored, setRestored] = useState(!rememberEnabled);
  useEffect(() => {
    if (!rememberEnabled || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as { page?: number; limit?: number };
        if (typeof saved.limit === "number" && saved.limit > 0) setLimit(saved.limit);
        if (typeof saved.page === "number" && saved.page > 1) setPage(saved.page);
      }
    } catch {
      /* sessionStorage bị chặn hoặc dữ liệu hỏng → bỏ qua, dùng trang 1 */
    }
    setRestored(true);
  }, [rememberEnabled, storageKey]);

  // Ghi lại mỗi khi đổi trang / số dòng.
  // Chỉ ghi SAU khi đã khôi phục xong — nếu không, lượt chạy đầu (page vẫn là 1)
  // sẽ xoá mất giá trị mà chính effect khôi phục vừa đọc lên.
  useEffect(() => {
    if (!rememberEnabled || !restored) return;
    try {
      if (page === 1 && limit === initialLimit) {
        window.sessionStorage.removeItem(storageKey);
      } else {
        window.sessionStorage.setItem(storageKey, JSON.stringify({ page, limit }));
      }
    } catch {
      /* chế độ riêng tư / hết dung lượng → bỏ qua, chỉ mất tính năng nhớ trang */
    }
  }, [page, limit, rememberEnabled, restored, storageKey, initialLimit]);

  // Reset về trang 1 khi bộ lọc/tìm kiếm thay đổi.
  // So sánh GIÁ TRỊ resetKey chứ không dùng cờ "lần chạy đầu": React StrictMode
  // chạy effect hai lần lúc mount, cờ boolean sẽ bị lượt thứ hai vượt qua và
  // `setPage(1)` xoá mất trang vừa khôi phục.
  const prevResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (Object.is(prevResetKeyRef.current, resetKey)) return;
    prevResetKeyRef.current = resetKey;
    setPage(1);
  }, [resetKey]);

  // Kẹp trang hiện tại trong khoảng hợp lệ khi danh sách thu nhỏ (vd sau khi xóa).
  // Bỏ qua khi `total === 0`: lúc mới mount dữ liệu chưa tải xong nên totalPages = 1,
  // nếu kẹp ngay sẽ xoá mất trang vừa khôi phục.
  useEffect(() => {
    if (total === 0) return;
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, total]);

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
