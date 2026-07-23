"use client";

/**
 * useDebouncedValue — hoãn cập nhật một giá trị cho tới khi người dùng ngừng gõ.
 *
 * Dùng cho ô tìm kiếm trên các trang danh sách. Hai tác dụng:
 *   1. Mỗi phím gõ không còn bắn một request lên server.
 *   2. Đưa giá trị đã hoãn vào `resetKey` của `useClientPagination` để trang
 *      chỉ nhảy về 1 khi từ khoá đã ổn định, thay vì nhảy theo từng ký tự.
 *
 * Trước đây khuôn này bị chép tay ở 3 màn (inbound, inbound-adhoc, movements)
 * còn 17 màn khác thì thiếu hẳn.
 *
 * Mặc định 500ms — chọn theo mạng trong kho, ưu tiên giảm số request.
 *
 * Cách dùng:
 *   const debouncedSearch = useDebouncedValue(search);
 *   const pg = useClientPagination(items, { resetKey: `${debouncedSearch}|${tab}` });
 */

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delay = 500): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Đọc trang/số dòng đã lưu cho các màn phân trang SERVER-SIDE (tự quản state,
 * không dùng `useClientPagination`).
 *
 * Gọi trong hàm khởi tạo của `useState` để lần gọi API đầu tiên đã đúng trang —
 * nếu khôi phục bằng `useEffect` thì màn hình sẽ nạp trang 1 rồi mới nạp lại
 * trang cũ, vừa nháy giao diện vừa tốn thêm một request.
 *
 * Trên server `window` không tồn tại nên trả về mặc định; giá trị này chỉ ảnh
 * hưởng phần chân trang, mà lúc chưa có dữ liệu thì chân trang không render.
 */
export function readSavedPaging(
  storageKey: string,
  defaults: { page?: number; limit?: number } = {}
): { page: number; limit: number } {
  const fallback = { page: defaults.page ?? 1, limit: defaults.limit ?? 10 };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as { page?: number; limit?: number };
    return {
      page: typeof saved.page === "number" && saved.page > 1 ? saved.page : fallback.page,
      limit: typeof saved.limit === "number" && saved.limit > 0 ? saved.limit : fallback.limit,
    };
  } catch {
    return fallback;
  }
}
