import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiErrorResponse, ApiError } from "@/lib/auth-server";
import { logAudit } from "@/lib/audit";

/**
 * PUT /api/auth/profile — update profile của user đang đăng nhập.
 * Sprint A · S5-003: trước fix, page Profile gọi endpoint này nhưng route chưa tồn tại
 * → nút "Lưu thay đổi" trả 404 (xem REVIEW_MOCKUP_VS_CODE_2026-05-28.md).
 *
 * Body (tất cả optional, gửi field nào update field đó):
 *   - full_name: string (>=1 char)
 *   - email: string | null  (validate ASCII email; null = xoá)
 *   - phone: string | null  (validate VN 10-digit; null = xoá)
 *
 * KHÔNG cho update: role, password, is_locked, must_change_password
 * (đổi password qua /api/auth/change-password).
 */
export async function PUT(req: Request) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));

    const data: Prisma.UserUpdateInput = {};

    // full_name: nếu gửi thì validate >=1, đã trim
    if (typeof body.full_name === "string") {
      const full_name = body.full_name.trim();
      if (!full_name) throw new ApiError(400, "Họ tên không được để trống");
      if (full_name.length > 100) throw new ApiError(400, "Họ tên không quá 100 ký tự");
      data.full_name = full_name;
    }

    // email: nếu gửi thì validate; cho phép null/"" để xoá
    if ("email" in body) {
      const raw = body.email;
      if (raw === null || raw === "") {
        data.email = null;
      } else if (typeof raw === "string") {
        const email = raw.trim();
        if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
          throw new ApiError(400, "Địa chỉ email không hợp lệ");
        }
        if (email.length > 100) throw new ApiError(400, "Email không quá 100 ký tự");
        data.email = email;
      }
    }

    // phone: tương tự
    if ("phone" in body) {
      const raw = body.phone;
      if (raw === null || raw === "") {
        data.phone = null;
      } else if (typeof raw === "string") {
        const phone = raw.trim();
        if (!/^0[0-9]{9}$/.test(phone)) {
          throw new ApiError(400, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)");
        }
        data.phone = phone;
      }
    }

    // avatar_url
    if ("avatar_url" in body) {
      const raw = body.avatar_url;
      if (raw === null || raw === "") {
        data.avatar_url = null;
      } else if (typeof raw === "string") {
        data.avatar_url = raw.trim() || null;
      }
    }

    if (Object.keys(data).length === 0) {
      throw new ApiError(400, "Không có thay đổi nào để cập nhật");
    }

    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data,
        select: {
          id: true,
          full_name: true,
          email: true,
          phone: true,
          role: true,
          avatar_url: true,
        },
      });

      await logAudit(req, {
        entity_type: "user",
        entity_id: user.id,
        action: "UPDATE_PROFILE",
        old_value: {
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          avatar_url: user.avatar_url,
        },
        new_value: {
          full_name: updated.full_name,
          email: updated.email,
          phone: updated.phone,
          avatar_url: updated.avatar_url,
        },
      });

      return NextResponse.json({ success: true, data: updated });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = (e.meta?.target as string[] | undefined)?.join(",") ?? "";
        if (target.includes("email"))
          throw new ApiError(409, "Email đã được dùng bởi tài khoản khác");
        if (target.includes("phone"))
          throw new ApiError(409, "Số điện thoại đã được dùng bởi tài khoản khác");
        throw new ApiError(409, "Giá trị trùng với tài khoản khác");
      }
      throw e;
    }
  } catch (err) {
    return apiErrorResponse(err);
  }
}
