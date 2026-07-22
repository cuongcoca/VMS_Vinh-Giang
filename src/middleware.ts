import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Middleware chạy trên Edge nên không import được prisma hay jsonwebtoken (phụ thuộc Node.js APIs)
// Do đó, ta chỉ kiểm tra có token ở cookie hay không. 
// Hiện tại token đang lưu ở localStorage, nên middleware khó đọc được.
// Để tương thích với Next.js App Router middleware, ta nên bảo vệ route ở phía Client Component (hoặc update auth để lưu cookie).
// Tuy nhiên tạm thời ở đây ta redirect nếu có yêu cầu bảo vệ mà ko thấy cookie.
// WMS hiện tại chưa dùng cookie, ta sẽ skip middleware server-side và xử lý Auth Guard ở Layout hoặc Page.
// Nhưng vì TC_T01_025 yêu cầu "Chưa login -> Truy cập URL Dashboard -> Redirect Login", 
// Ta có thể thêm script nhỏ ở layout hoặc dùng middleware kiểm tra cookie nếu sau này chuyển sang cookie.

// Mobile standalone routing: khi BASE_PATH trùng tên role (/thukho, /kiemke),
// CHỈ rewrite root "/" để hiện dashboard mobile. Các sub-path đã được 
// xử lý bởi mobileHref() (strip prefix cho Next.js Link).
const STANDALONE_ROLES: Record<string, string[]> = {
  "/thukho": ["/thukho"],
  "/kiemke": ["/kiemke"],
};

export function middleware(request: NextRequest) {
  const basePath = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "/wms";
  const pathname = request.nextUrl.pathname;

  // Chỉ xử lý cho standalone mobile builds (BASE_PATH = /thukho hoặc /kiemke)
  if (basePath in STANDALONE_ROLES) {
    const roleName = basePath; // e.g. "/thukho"

    // Chỉ rewrite root path "/" → "/thukho" để hiện mobile dashboard
    if (pathname === "/") {
      const newUrl = request.nextUrl.clone();
      newUrl.pathname = roleName;
      return NextResponse.rewrite(newUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
