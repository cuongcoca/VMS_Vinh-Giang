import { NextResponse } from "next/server";
import * as jwt from "jsonwebtoken";
import { prisma } from "./prisma";

/**
 * Lớp helper xác thực + RBAC dùng cho mọi API route business.
 * Sửa AUTH-001 (mọi route /api/* business chưa verify JWT) và RC-1 trong
 * docs/REVIEW_LOGIC_ERRORS_2026-05-28.md.
 *
 * Cách dùng:
 *   import { requireAuth, withAuth } from "@/lib/auth-server";
 *
 *   // Style 1 — try/catch + apiErrorResponse:
 *   export async function POST(req: Request) {
 *     try {
 *       const { user } = await requireAuth(req, ["QUAN_LY"]);
 *       // ... business logic, đã có `user.id`, `user.role`
 *     } catch (err) { return apiErrorResponse(err); }
 *   }
 *
 *   // Style 2 — wrapper:
 *   export const PUT = withAuth(["ADMIN"], async ({ user, req }) => { ... });
 *
 * Super-role (ADMIN/MANAGER/STAFF) tự động pass mọi `allowedRoles`.
 */

export type SessionRole =
  | "ADMIN"
  | "MANAGER"
  | "STAFF"
  | "QUAN_LY"
  | "KE_TOAN"
  | "THU_KHO"
  | "XE_NANG"
  | "KIEM_KE";

const SUPER_ROLES: SessionRole[] = ["ADMIN", "MANAGER", "STAFF"];

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Trong helper mới này KHÔNG fallback. AUTH-003 yêu cầu rotate + bỏ literal.
    // Throw ở call-time (không ở module load) để dev không bị block khi
    // import file này từ route khác mà chưa cần verify token.
    throw new ApiError(500, "Server chưa cấu hình JWT_SECRET");
  }
  return secret;
}

export interface AuthContext {
  user: {
    id: string;
    role: SessionRole;
    full_name: string;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
  };
  sessionId: string | null;
  token: string;
}

interface JwtPayload {
  userId: string;
  sessionId?: string;
  role?: string;
  iat?: number;
}

export async function requireAuth(
  req: Request,
  allowedRoles?: SessionRole[]
): Promise<AuthContext> {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    throw new ApiError(401, "Chưa đăng nhập");
  }
  const token = authHeader.slice(7).trim();
  if (!token) throw new ApiError(401, "Token rỗng");

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    }) as JwtPayload;
  } catch {
    throw new ApiError(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn");
  }
  if (!payload.userId) throw new ApiError(401, "Token thiếu userId");

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      role: true,
      full_name: true,
      email: true,
      phone: true,
      avatar_url: true,
      is_locked: true,
      password_changed_at: true,
    },
  });
  if (!user) throw new ApiError(401, "Tài khoản không tồn tại");
  if (user.is_locked) throw new ApiError(403, "Tài khoản đã bị khoá");

  // Nếu token issued trước khi đổi password → coi như invalid (đẩy ra re-login).
  // Phòng trường hợp token bị đánh cắp, user đổi pass nhưng token cũ vẫn dùng được
  // ở các route không gọi /api/auth/me (AUTH-010).
  if (
    payload.iat &&
    user.password_changed_at &&
    payload.iat * 1000 < user.password_changed_at.getTime()
  ) {
    throw new ApiError(401, "Mật khẩu đã đổi, vui lòng đăng nhập lại");
  }

  // Kiểm tra session còn active (nếu token có sessionId)
  let sessionId: string | null = null;
  if (payload.sessionId) {
    const session = await prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        user_id: user.id,
        is_active: true,
      },
      select: { id: true },
    });
    if (!session) throw new ApiError(401, "Phiên đã hết hạn hoặc bị thu hồi");
    sessionId = session.id;
  }

  // Role gate: super-role tự pass; còn lại phải nằm trong allowedRoles.
  if (allowedRoles && allowedRoles.length > 0) {
    const role = user.role as SessionRole;
    if (!SUPER_ROLES.includes(role) && !allowedRoles.includes(role)) {
      throw new ApiError(403, "Không có quyền thực hiện thao tác này");
    }
  }

  return {
    user: {
      id: user.id,
      role: user.role as SessionRole,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      avatar_url: user.avatar_url,
    },
    sessionId,
    token,
  };
}

export function apiErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.status }
    );
  }
  console.error("[api] unexpected error:", err);
  return NextResponse.json(
    { success: false, error: "Lỗi hệ thống" },
    { status: 500 }
  );
}

type WithAuthHandler<T> = (ctx: AuthContext & { req: Request }) => Promise<T>;

export function withAuth<T extends Response | NextResponse>(
  allowedRoles: SessionRole[] | null,
  handler: WithAuthHandler<T>
) {
  return async (req: Request): Promise<Response> => {
    try {
      const ctx = await requireAuth(req, allowedRoles ?? undefined);
      return await handler({ ...ctx, req });
    } catch (err) {
      return apiErrorResponse(err);
    }
  };
}
