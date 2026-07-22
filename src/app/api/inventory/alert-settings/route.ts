import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// API cấu hình NHẬN cảnh báo (UC-INV-05 TC017) — quản lý danh sách email người nhận.
// Lưu vào model AlertSetting (recipients String[]). KHÔNG cần migration (model đã có sẵn).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/inventory/alert-settings — danh sách cấu hình cảnh báo
export async function GET() {
  try {
    const settings = await prisma.alertSetting.findMany({ orderBy: { alert_type: "asc" } });
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error("GET /api/inventory/alert-settings error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tải cấu hình cảnh báo." }, { status: 500 });
  }
}

// PUT /api/inventory/alert-settings — cập nhật (upsert) recipients/frequency/is_active theo alert_type
export async function PUT(req: NextRequest) {
  try {
    const { alert_type, recipients, frequency, is_active } = await req.json();
    if (!alert_type) {
      return NextResponse.json({ success: false, error: "Thiếu loại cảnh báo." }, { status: 400 });
    }

    // Chuẩn hoá + validate email — TC017: email sai định dạng / danh sách rỗng
    const emails: string[] = Array.isArray(recipients)
      ? recipients.map((e: string) => String(e).trim()).filter(Boolean)
      : [];
    const invalid = emails.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length > 0) {
      return NextResponse.json({ success: false, error: `Email sai định dạng: ${invalid.join(", ")}` }, { status: 400 });
    }
    if (is_active && emails.length === 0) {
      return NextResponse.json({ success: false, error: "Cảnh báo đang bật phải có ít nhất 1 người nhận." }, { status: 400 });
    }

    const updated = await prisma.alertSetting.upsert({
      where: { alert_type },
      update: {
        recipients: emails,
        ...(frequency ? { frequency } : {}),
        ...(is_active !== undefined ? { is_active: !!is_active } : {}),
      },
      create: {
        alert_type,
        recipients: emails,
        frequency: frequency || "DAILY_6AM",
        is_active: is_active ?? true,
      },
    });
    return NextResponse.json({ success: true, data: updated, message: "Đã lưu cấu hình nhận cảnh báo." });
  } catch (error) {
    console.error("PUT /api/inventory/alert-settings error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi lưu cấu hình cảnh báo." }, { status: 500 });
  }
}
