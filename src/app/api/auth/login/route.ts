import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "vinhgiang_super_secret_key_2026";
const MAX_FAILED_ATTEMPTS = 5;

function parseDeviceInfo(userAgent: string): string {
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  // Detect OS
  if (/Windows/i.test(userAgent)) os = "Windows PC";
  else if (/Macintosh|Mac OS/i.test(userAgent)) os = "Mac";
  else if (/iPhone/i.test(userAgent)) os = "iPhone";
  else if (/iPad/i.test(userAgent)) os = "iPad";
  else if (/Android/i.test(userAgent)) os = "Android";
  else if (/Linux/i.test(userAgent)) os = "Linux";

  // Detect Browser
  if (/Edg\//i.test(userAgent)) browser = "Edge";
  else if (/Chrome/i.test(userAgent)) browser = "Chrome";
  else if (/Firefox/i.test(userAgent)) browser = "Firefox";
  else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) browser = "Safari";
  else if (/Opera|OPR/i.test(userAgent)) browser = "Opera";

  return `${os} - ${browser}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { identifier, password } = body;
    // Sprint A · A1-002: rememberMe → cấp token 30 ngày; mặc định 7 ngày (giữ backward-compat).
    const rememberMe = body?.remember_me === true || body?.rememberMe === true;
    const tokenExpiry: string = rememberMe ? "30d" : "7d";

    // TC_T01_014: Chặn dấu cách đầu/cuối identifier
    if (identifier) identifier = identifier.trim();
    // Mật khẩu không trim vì có thể người dùng cố ý đặt dấu cách, 
    // Nhưng TC_T01_016 yêu cầu chặn dấu cách đầu/cuối trường mật khẩu (theo requirement)
    if (password) password = password.trim();

    // TC_T01_003, TC_T01_004, TC_T01_011: Bỏ trống trường bắt buộc
    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập Email/SĐT và mật khẩu." },
        { status: 400 }
      );
    }

    // TC_T01_007, TC_T01_009: Giới hạn độ dài (Email/SĐT 50, Password 20)
    if (identifier.length > 50) {
      return NextResponse.json(
        { success: false, error: "Email/SĐT không được vượt quá 50 ký tự." },
        { status: 400 }
      );
    }
    if (password.length > 20) {
      return NextResponse.json(
        { success: false, error: "Mật khẩu không được vượt quá 20 ký tự." },
        { status: 400 }
      );
    }

    // TC_T01_005: Email strict ASCII (chặn Unicode/emoji)
    // TC_T01_006: SĐT VN format — 10 chữ số bắt đầu bằng 0
    const isEmail = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(identifier);
    const isPhone = /^0[0-9]{9}$/.test(identifier);

    if (!isEmail && !isPhone) {
      return NextResponse.json(
        { success: false, error: "Sai định dạng Email hoặc SĐT." },
        { status: 400 }
      );
    }

    // TC_T01_013: Tìm user trong DB
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Tài khoản không tồn tại." },
        { status: 404 }
      );
    }

    // TC_T01_012: Kiểm tra tài khoản bị khóa
    if (user.is_locked) {
      return NextResponse.json(
        { success: false, error: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin." },
        { status: 403 }
      );
    }

    // TC_T01_015, TC_T01_017: So sánh mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      const newAttempts = user.failed_login_attempts + 1;
      let errorMsg = "Mật khẩu không chính xác. Vui lòng thử lại.";

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        // Khóa tài khoản
        await prisma.user.update({
          where: { id: user.id },
          data: { is_locked: true, failed_login_attempts: newAttempts },
        });
        errorMsg = "Tài khoản của bạn đã bị khóa do nhập sai quá 5 lần.";
      } else {
        // Cập nhật số lần sai
        await prisma.user.update({
          where: { id: user.id },
          data: { failed_login_attempts: newAttempts },
        });
        errorMsg = `Mật khẩu không chính xác. Bạn còn ${MAX_FAILED_ATTEMPTS - newAttempts} lượt nhập. Nếu sai ${MAX_FAILED_ATTEMPTS} lần tài khoản sẽ bị khóa.`;
      }

      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 401 }
      );
    }

    // Đăng nhập thành công -> reset failed attempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failed_login_attempts: 0,
        last_login_at: new Date(),
      },
    });

    // Parse device info from User-Agent
    const userAgent = req.headers.get("user-agent") || "Unknown";
    const deviceInfo = parseDeviceInfo(userAgent);

    // Get IP address
    const forwarded = req.headers.get("x-forwarded-for");
    const ipAddress = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip") || "Unknown";

    // Tạo JWT token (tạm thời không có sessionId)
    const tempToken = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: tokenExpiry } as jwt.SignOptions
    );

    // Tạo Session record trong DB
    const session = await prisma.session.create({
      data: {
        user_id: user.id,
        token: tempToken,
        device_info: deviceInfo,
        ip_address: ipAddress,
        location: null, // Sẽ bổ sung lookup IP->Location sau
      },
    });

    // Tạo lại JWT token có chứa sessionId
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        sessionId: session.id,
      },
      JWT_SECRET,
      { expiresIn: tokenExpiry } as jwt.SignOptions
    );

    // Update session với token chính thức
    await prisma.session.update({
      where: { id: session.id },
      data: { token },
    });

    // UC_SYS_03_TC10: Ghi nhận log "ĐĂNG NHẬP" thành công
    try {
      await prisma.auditLog.create({
        data: {
          entity_type: "user",
          entity_id: user.id,
          action: "LOGIN",
          old_value: {},
          new_value: { device: deviceInfo, ip: ipAddress },
          reason: "Đăng nhập thành công",
          performed_by: user.id,
          performed_by_role: user.role,
          ip_address: ipAddress,
          user_agent: userAgent?.slice(0, 255) || null,
        },
      });
    } catch (err) {
      console.error("Login audit log error:", err);
    }

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        role: user.role,
        phone: user.phone,
        email: user.email,
        avatarUrl: user.avatar_url,
        avatar_url: user.avatar_url,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
