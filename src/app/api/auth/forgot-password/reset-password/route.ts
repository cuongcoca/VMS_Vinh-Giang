import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";

// Tái sử dụng từ change-password
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 50;

function validatePasswordRules(password: string): string | null {
  if (/\s/.test(password)) return "Mật khẩu không được chứa khoảng trắng.";
  if (password.length < PASSWORD_MIN_LENGTH) return `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Mật khẩu không được vượt quá ${PASSWORD_MAX_LENGTH} ký tự.`;
  if (!/[A-Z]/.test(password)) return "Mật khẩu phải chứa ít nhất 1 chữ cái viết hoa.";
  if (!/[a-z]/.test(password)) return "Mật khẩu phải chứa ít nhất 1 chữ cái viết thường.";
  if (!/[0-9]/.test(password)) return "Mật khẩu phải chứa ít nhất 1 chữ số.";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt.";
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { resetToken, newPassword, confirmPassword } = body;

    // Trim
    if (newPassword) newPassword = newPassword.trim();
    if (confirmPassword) confirmPassword = confirmPassword.trim();

    // TC_T04_37: Validate resetToken
    if (!resetToken) {
      return NextResponse.json(
        { success: false, error: "Link khôi phục không hợp lệ. Vui lòng thực hiện lại." },
        { status: 403 }
      );
    }

    // Tìm reset token
    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { token: resetToken },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { success: false, error: "Link khôi phục không hợp lệ hoặc đã hết hạn." },
        { status: 403 }
      );
    }

    // Đã dùng
    if (tokenRecord.is_used) {
      return NextResponse.json(
        { success: false, error: "Link khôi phục đã được sử dụng." },
        { status: 403 }
      );
    }

    // TC_T04_34: Hết hạn (15 phút)
    if (new Date() > tokenRecord.expires_at) {
      return NextResponse.json(
        { success: false, error: "Link khôi phục đã hết hạn. Vui lòng thực hiện lại." },
        { status: 403 }
      );
    }

    // TC_T04_20: Validate required
    if (!newPassword) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập mật khẩu mới." },
        { status: 400 }
      );
    }

    // TC_T04_21: Validate required confirm
    if (!confirmPassword) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập xác nhận mật khẩu." },
        { status: 400 }
      );
    }

    // TC_T04_22: Confirm match
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: "Mật khẩu xác nhận không khớp." },
        { status: 400 }
      );
    }

    // TC_T04_23: Password rules
    const ruleError = validatePasswordRules(newPassword);
    if (ruleError) {
      return NextResponse.json(
        { success: false, error: ruleError },
        { status: 400 }
      );
    }

    // Tìm user
    const user = await prisma.user.findUnique({
      where: { id: tokenRecord.user_id },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Tài khoản không tồn tại." },
        { status: 404 }
      );
    }

    // TC_T04_24: Kiểm tra trùng mật khẩu cũ
    const isSameAsOld = await bcrypt.compare(newPassword, user.password_hash);
    if (isSameAsOld) {
      return NextResponse.json(
        { success: false, error: "Mật khẩu mới không được trùng với mật khẩu cũ." },
        { status: 400 }
      );
    }

    // Hash mật khẩu mới
    const newHash = await bcrypt.hash(newPassword, 10);
    const now = new Date();

    // Transaction: Update password + mark token used + revoke sessions (TC_T04_27)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password_hash: newHash,
          password_changed_at: now,
          failed_login_attempts: 0,
          // Phương án B: KHÔNG tự mở khóa — giữ is_locked nguyên
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { is_used: true },
      }),
      // Revoke tất cả session cũ
      prisma.session.updateMany({
        where: { user_id: user.id },
        data: { is_active: false },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.",
      accountLocked: user.is_locked,
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
