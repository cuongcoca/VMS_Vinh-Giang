import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import crypto from "crypto";

// Tạo OTP 6 chữ số (100000-999999)
function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// Escape HTML tối thiểu cho dữ liệu nhúng vào email (full_name)
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Template email OTP — mã nổi bật, có cảnh báo bảo mật
function otpEmailHtml(fullName: string, otp: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;padding:24px;background:#faf9f6">
    <h2 style="color:#000e24;margin:0 0 4px">Đặt lại mật khẩu — WMS Vĩnh Giang</h2>
    <p style="color:#43474e;margin:0 0 20px">Xin chào ${escHtml(fullName)},</p>
    <p style="color:#43474e;margin:0 0 12px">Mã OTP đặt lại mật khẩu của bạn là:</p>
    <div style="text-align:center;margin:20px 0">
      <span style="display:inline-block;font-size:34px;font-weight:bold;letter-spacing:10px;color:#000e24;background:#fff;border:1px solid #e3e2e0;border-radius:12px;padding:16px 28px">${otp}</span>
    </div>
    <p style="color:#43474e;margin:0 0 6px">Mã có hiệu lực trong <b>5 phút</b>.</p>
    <p style="color:#9a2143;margin:0 0 20px;font-weight:600">Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
    <hr style="border:0;border-top:1px solid #e3e2e0;margin:20px 0"/>
    <p style="font-size:12px;color:#9aa0a6;margin:0">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
  </div>`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { identifier } = body;

    // Trim khoảng trắng (TC_T04_41)
    if (identifier) identifier = identifier.trim();

    // Validate required (TC_T04_02, TC_T04_07)
    if (!identifier) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập Email hoặc Số điện thoại." },
        { status: 400 }
      );
    }

    // Giới hạn độ dài
    if (identifier.length > 50) {
      return NextResponse.json(
        { success: false, error: "Email/SĐT không được vượt quá 50 ký tự." },
        { status: 400 }
      );
    }

    // Detect email vs SĐT chính xác (TC_T04_03, TC_T04_07): có chữ cái/@ → email; toàn số → SĐT
    const looksLikeEmail = /[a-zA-Z@]/.test(identifier);
    if (looksLikeEmail) {
      // Strict ASCII email (TC_T04_42 — Unicode/emoji)
      if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(identifier)) {
        return NextResponse.json(
          { success: false, error: "Địa chỉ Email không hợp lệ." },
          { status: 400 }
        );
      }
    } else {
      if (!/^0[0-9]{9}$/.test(identifier)) {
        return NextResponse.json(
          { success: false, error: "Số điện thoại không hợp lệ (bắt đầu bằng 0, gồm 10 chữ số)." },
          { status: 400 }
        );
      }
    }

    // Tìm user theo email hoặc phone (TC_T04_04)
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
        { success: false, error: "Tài khoản không tồn tại trong hệ thống." },
        { status: 404 }
      );
    }

    // TC_T04_05, TC_T04_09: Account đã bị khóa
    if (user.is_locked) {
      return NextResponse.json(
        { success: false, error: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin." },
        { status: 403 }
      );
    }

    // TC_T04_17, TC_T04_18: Rate limiting — Max 5 OTP / 30 phút
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recentOtpCount = await prisma.otpCode.count({
      where: {
        user_id: user.id,
        purpose: "FORGOT_PASSWORD",
        created_at: { gte: thirtyMinAgo },
      },
    });

    if (recentOtpCount >= 5) {
      return NextResponse.json(
        { success: false, error: "Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau 30 phút." },
        { status: 429 }
      );
    }

    // Vô hiệu hóa tất cả OTP cũ chưa dùng
    await prisma.otpCode.updateMany({
      where: {
        user_id: user.id,
        purpose: "FORGOT_PASSWORD",
        is_used: false,
      },
      data: { is_used: true },
    });

    // Tạo OTP mới — hết hạn sau 5 phút
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.otpCode.create({
      data: {
        user_id: user.id,
        code: otpCode,
        purpose: "FORGOT_PASSWORD",
        expires_at: expiresAt,
      },
    });

    // ===== GỬI OTP THẬT =====
    // Email: gửi qua sendMail() (SMTP/Mailgun/SendGrid khai báo ở /system/mail).
    // SĐT: chưa tích hợp SMS/Zalo (Giai đoạn 2) — nhánh phone giữ nguyên hành vi cũ.
    let emailSent = false;
    let sendError = "";
    if (looksLikeEmail) {
      const result = await sendMail({
        to: identifier,
        subject: "Mã OTP đặt lại mật khẩu — WMS Vĩnh Giang",
        html: otpEmailHtml(user.full_name, otpCode),
      });
      emailSent = result.ok;
      if (!result.ok) sendError = result.error ?? "";
    }

    // MOCK MODE: chỉ trả OTP khi BẬT TƯỜNG MINH ở dev — không bao giờ trên production.
    const allowMockOtp =
      process.env.NODE_ENV !== "production" && process.env.MOCK_OTP === "1";
    if (allowMockOtp) {
      console.log(`[MOCK OTP] User: ${identifier} | OTP: ${otpCode} | Expires: ${expiresAt.toISOString()}`);
    }

    // Email gửi thật thất bại VÀ không ở chế độ mock → báo lỗi rõ ràng,
    // KHÔNG trả "đã gửi" giả như trước.
    if (looksLikeEmail && !emailSent && !allowMockOtp) {
      console.error(`Gửi email OTP thất bại cho ${identifier}: ${sendError}`);
      return NextResponse.json(
        {
          success: false,
          error: "Hệ thống chưa gửi được email OTP. Vui lòng liên hệ Admin để kiểm tra cấu hình email.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: looksLikeEmail
        ? `Mã OTP đã được gửi tới email ${identifier}. Vui lòng kiểm tra hộp thư (cả mục Spam).`
        : `Mã OTP đã được gửi tới ${identifier}.`,
      ...(allowMockOtp ? { mock_otp: otpCode, mock_mode: true } : {}),
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
