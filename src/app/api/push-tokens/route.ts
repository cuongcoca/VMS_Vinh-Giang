import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestActor } from "@/lib/audit";

/**
 * POST /api/push-tokens — Đăng ký hoặc cập nhật device token (FCM)
 *
 * Body: { token: string, platform: "IOS" | "ANDROID", device_name?: string, app_version?: string }
 *
 * Khi mobile app đăng nhập hoặc khởi động, gọi API này để lưu FCM token.
 * Dùng upsert để tránh duplicate khi user mở lại app.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = getRequestActor(req);
    if (!actor.userId) {
      return NextResponse.json(
        { success: false, error: "Chưa đăng nhập." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { token, platform, device_name, app_version } = body;

    if (!token || !platform) {
      return NextResponse.json(
        { success: false, error: "Thiếu token hoặc platform." },
        { status: 400 }
      );
    }

    if (!["IOS", "ANDROID"].includes(platform)) {
      return NextResponse.json(
        { success: false, error: "Platform phải là IOS hoặc ANDROID." },
        { status: 400 }
      );
    }

    // Upsert: nếu token đã tồn tại cho user này → cập nhật, nếu chưa → tạo mới
    const deviceToken = await prisma.deviceToken.upsert({
      where: {
        user_id_token: {
          user_id: actor.userId,
          token: token,
        },
      },
      update: {
        platform,
        device_name: device_name || null,
        app_version: app_version || null,
        is_active: true,
        updated_at: new Date(),
      },
      create: {
        user_id: actor.userId,
        token,
        platform,
        device_name: device_name || null,
        app_version: app_version || null,
        is_active: true,
      },
    });

    // Deactivate token cũ nếu cùng token nhưng khác user (user đổi tài khoản trên cùng device)
    await prisma.deviceToken.updateMany({
      where: {
        token,
        user_id: { not: actor.userId },
      },
      data: { is_active: false },
    });

    return NextResponse.json({
      success: true,
      data: { id: deviceToken.id },
    });
  } catch (error) {
    console.error("POST /api/push-tokens error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi đăng ký push token." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/push-tokens — Xóa (deactivate) device token khi logout
 *
 * Body: { token: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const actor = getRequestActor(req);
    if (!actor.userId) {
      return NextResponse.json(
        { success: false, error: "Chưa đăng nhập." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Thiếu token." },
        { status: 400 }
      );
    }

    const result = await prisma.deviceToken.updateMany({
      where: {
        user_id: actor.userId,
        token,
      },
      data: { is_active: false },
    });

    return NextResponse.json({
      success: true,
      deactivated_count: result.count,
    });
  } catch (error) {
    console.error("DELETE /api/push-tokens error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi xóa push token." },
      { status: 500 }
    );
  }
}
