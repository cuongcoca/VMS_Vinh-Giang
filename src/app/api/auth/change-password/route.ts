import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

import { getJwtSecret } from "@/lib/jwt";

// Password validation rules
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 50;

function validatePasswordRules(password: string): string | null {
  if (/\s/.test(password)) {
    return "Mật khẩu không được chứa khoảng trắng.";
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Mật khẩu không được vượt quá ${PASSWORD_MAX_LENGTH} ký tự.`;
  }
  if (!/[A-Z]/.test(password)) {
    return "Mật khẩu phải chứa ít nhất 1 chữ cái viết hoa.";
  }
  if (!/[a-z]/.test(password)) {
    return "Mật khẩu phải chứa ít nhất 1 chữ cái viết thường.";
  }
  if (!/[0-9]/.test(password)) {
    return "Mật khẩu phải chứa ít nhất 1 chữ số.";
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (@, #, $, %, ...).";
  }
  return null;
}

export async function PUT(req: Request) {
  try {
    // Verify JWT token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại." },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    let decoded: { userId: string; sessionId?: string };

    try {
      decoded = jwt.verify(token, getJwtSecret()) as { userId: string; sessionId?: string };
    } catch {
      return NextResponse.json(
        { success: false, error: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại." },
        { status: 401 }
      );
    }

    // Parse body
    const body = await req.json();
    let { currentPassword, newPassword, confirmPassword } = body;

    // currentPassword trim để so khớp với hash đã lưu.
    if (currentPassword) currentPassword = currentPassword.trim();
    // TC_T03_12: KHÔNG tự trim mật khẩu mới/xác nhận — phải CHẶN nếu có khoảng trắng
    // đầu/cuối (xử lý ngay dưới phần validate required).

    // TC_T03_02, TC_T03_03, TC_T03_04, TC_T03_05: Validate required
    if (!currentPassword || !newPassword || !confirmPassword) {
      const missing = [];
      if (!currentPassword) missing.push("mật khẩu hiện tại");
      if (!newPassword) missing.push("mật khẩu mới");
      if (!confirmPassword) missing.push("xác nhận mật khẩu");
      return NextResponse.json(
        { success: false, error: `Vui lòng nhập ${missing.join(", ")}.` },
        { status: 400 }
      );
    }

    // TC_T03_12: Chặn khoảng trắng đầu/cuối ở mật khẩu mới (không cho phép, không tự trim).
    if (newPassword !== newPassword.trim()) {
      return NextResponse.json(
        { success: false, error: "Mật khẩu mới không được chứa khoảng trắng ở đầu hoặc cuối." },
        { status: 400 }
      );
    }

    // TC_T03_07: Confirm password match
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: "Mật khẩu xác nhận không khớp." },
        { status: 400 }
      );
    }

    // TC_T03_09, TC_T03_10, TC_T03_11: Password rules
    const ruleError = validatePasswordRules(newPassword);
    if (ruleError) {
      return NextResponse.json(
        { success: false, error: ruleError },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Tài khoản không tồn tại." },
        { status: 404 }
      );
    }

    // TC_T03_06: Verify current password
    const isCurrentValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentValid) {
      return NextResponse.json(
        { success: false, error: "Mật khẩu hiện tại không đúng." },
        { status: 401 }
      );
    }

    // TC_T03_08: Check new password != old password
    const isSameAsOld = await bcrypt.compare(newPassword, user.password_hash);
    if (isSameAsOld) {
      return NextResponse.json(
        { success: false, error: "Mật khẩu mới không được trùng với mật khẩu cũ." },
        { status: 400 }
      );
    }

    // Hash new password and update
    const newHash = await bcrypt.hash(newPassword, 10);
    const now = new Date();

    await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        password_hash: newHash,
        password_changed_at: now,
      },
    });

    // TC_T03_21: Revoke all other sessions (keep current session if exists)
    if (decoded.sessionId) {
      await prisma.session.updateMany({
        where: {
          user_id: decoded.userId,
          id: { not: decoded.sessionId },
        },
        data: { is_active: false },
      });
    } else {
      // No sessionId in token, deactivate all sessions
      await prisma.session.updateMany({
        where: { user_id: decoded.userId },
        data: { is_active: false },
      });
    }

    // TC_T03_01: Success
    return NextResponse.json({
      success: true,
      message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
