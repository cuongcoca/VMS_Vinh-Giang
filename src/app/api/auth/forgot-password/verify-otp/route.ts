import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { identifier, otp } = body;

    if (identifier) identifier = identifier.trim();
    if (otp) otp = otp.trim();

    // Validate required (TC_T04_14)
    if (!otp) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập mã OTP." },
        { status: 400 }
      );
    }

    // Validate format — chỉ cho phép số (TC_T04_15)
    if (/\D/.test(otp)) {
      return NextResponse.json(
        { success: false, error: "Mã OTP không hợp lệ. Chỉ chấp nhận chữ số." },
        { status: 400 }
      );
    }

    if (otp.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Mã OTP phải gồm 6 chữ số." },
        { status: 400 }
      );
    }

    // Tìm user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier },
        ],
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Tài khoản không tồn tại." },
        { status: 404 }
      );
    }

    // Tìm OTP mới nhất, chưa dùng
    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        user_id: user.id,
        purpose: "FORGOT_PASSWORD",
        is_used: false,
      },
      orderBy: { created_at: "desc" },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy yêu cầu OTP. Vui lòng gửi lại mã." },
        { status: 400 }
      );
    }

    // TC_T04_12: Kiểm tra hết hạn
    if (new Date() > otpRecord.expires_at) {
      await prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { is_used: true },
      });
      return NextResponse.json(
        { success: false, error: "Mã OTP đã hết hạn. Vui lòng gửi lại mã mới." },
        { status: 400 }
      );
    }

    // TC_T04_18: Kiểm tra số lần thử
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { is_used: true },
      });
      return NextResponse.json(
        { success: false, error: "Đã vượt quá số lần thử. Vui lòng gửi lại mã OTP mới.", attemptsLeft: 0 },
        { status: 400 }
      );
    }

    // TC_T04_11: So sánh OTP
    if (otpRecord.code !== otp) {
      const newAttempts = otpRecord.attempts + 1;
      await prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attempts: newAttempts },
      });
      const left = otpRecord.max_attempts - newAttempts;
      return NextResponse.json(
        {
          success: false,
          error: `Mã OTP không chính xác. Còn lại ${left} lượt thử.`,
          attemptsLeft: left,
        },
        { status: 400 }
      );
    }

    // TC_T04_10: OTP đúng — đánh dấu đã dùng
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { is_used: true },
    });

    // Tạo PasswordResetToken (hết hạn 15 phút)
    const resetTokenValue = crypto.randomUUID();
    const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token: resetTokenValue,
        expires_at: tokenExpiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Xác thực OTP thành công.",
      resetToken: resetTokenValue,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
