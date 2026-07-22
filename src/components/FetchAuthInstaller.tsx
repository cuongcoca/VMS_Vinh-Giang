"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Vá window.fetch MỘT LẦN ở phía client để TỰ ĐỘNG đính JWT (Authorization:
// Bearer) vào mọi request tới API nội bộ (/api/...).
//
// Lý do: app dùng RBAC phía client (token trong localStorage). Server chỉ biết
// "ai thực hiện" qua JWT trong header Authorization. Nhiều lệnh fetch rải rác
// (≈267 chỗ) KHÔNG đính token → nhật ký hoạt động ghi performed_by = null →
// cột "Người thực hiện" để trống. Vá tại đây giúp MỌI nghiệp vụ ghi log đều bắt
// được người thực hiện mà không phải sửa từng chỗ.
//
// An toàn: chỉ thêm header (không đổi gì khác), chỉ cho API same-origin, chỉ khi
// có token, không ghi đè nếu request đã tự đính (apiFetch), và bọc try/catch để
// không bao giờ chặn nghiệp vụ chính.
// ─────────────────────────────────────────────────────────────────────────────
import { auth } from "@/lib/auth";

if (typeof window !== "undefined") {
  const w = window as unknown as { __vgFetchAuthPatched?: boolean };
  if (!w.__vgFetchAuthPatched) {
    const original = window.fetch.bind(window);

    window.fetch = function patchedFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      try {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url;

        // Chỉ đính token cho API nội bộ same-origin (URL tương đối "/..." hoặc
        // tuyệt đối cùng origin), có chứa "/api/".
        const isInternalApi =
          !!url &&
          (url.startsWith("/")
            ? url.includes("/api/")
            : url.startsWith(window.location.origin) && url.includes("/api/"));

        const token = auth.getToken();

        if (isInternalApi && token) {
          const headers = new Headers(
            init?.headers ?? (input instanceof Request ? input.headers : undefined)
          );
          // Không ghi đè nếu lệnh gọi đã tự đính token (vd apiFetch)
          if (!headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
            return original(input, { ...(init ?? {}), headers });
          }
        }
      } catch {
        // Bất kỳ lỗi nào → bỏ qua, dùng fetch gốc để không chặn nghiệp vụ chính
      }
      return original(input, init);
    };

    w.__vgFetchAuthPatched = true;
  }
}

// Component rỗng — chỉ để mount vào root layout, kích hoạt đoạn vá ở trên.
export function FetchAuthInstaller() {
  return null;
}
