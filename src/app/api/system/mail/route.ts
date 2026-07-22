import { NextRequest, NextResponse } from "next/server";
import { loadMailConfig, saveMailConfig, verifyMail, sendMail } from "@/lib/mailer";

// GET /api/system/mail — Lấy cấu hình mail (mask sensitive fields)
export async function GET() {
  try {
    const data = await loadMailConfig();
    // Mask passwords/API keys — UI shows placeholder dots when saved
    const masked = { ...data };
    for (const k of ["smtp_password", "mailgun_api_key", "sendgrid_api_key", "brevo_api_key"] as const) {
      if (masked[k]) masked[k] = "********";
    }
    return NextResponse.json({ success: true, data: masked });
  } catch (error) {
    console.error("GET /api/system/mail error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

// PUT /api/system/mail — Lưu cấu hình (ignore masked sentinel values)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    for (const k of ["smtp_password", "mailgun_api_key", "sendgrid_api_key", "brevo_api_key"]) {
      if (body[k] === "********") delete body[k];
    }
    await saveMailConfig(body);
    return NextResponse.json({ success: true, message: "Đã lưu cấu hình mail." });
  } catch (error) {
    console.error("PUT /api/system/mail error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

/**
 * POST /api/system/mail
 *   - { action: "verify" }    → verify credentials only (no send)
 *   - { action: "send", to }  → send a real test email to `to`
 *   - {}                       → verify (legacy default)
 */
export async function POST(req: NextRequest) {
  try {
    let body: { action?: string; to?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Empty body — default to verify
    }

    if (body.action === "send" && body.to) {
      const now = new Date().toLocaleString("vi-VN");
      const result = await sendMail({
        to: body.to,
        subject: "WMS Vĩnh Giang — Email test",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#faf9f6">
          <h2 style="color:#000e24">✓ Cấu hình email hoạt động</h2>
          <p>Đây là email test từ hệ thống WMS Vĩnh Giang.</p>
          <hr style="border:0;border-top:1px solid #e3e2e0;margin:24px 0"/>
          <p style="font-size:12px;color:#43474e">Gửi lúc: ${now}</p>
        </div>`,
      });
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: `Gửi thất bại: ${result.error}` },
          { status: 200 },
        );
      }
      return NextResponse.json({
        success: true,
        message: `Đã gửi mail test đến ${body.to} qua ${result.provider}. ID: ${result.id ?? "(không có)"}`,
      });
    }

    const result = await verifyMail();
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Verify thất bại." },
        { status: 200 },
      );
    }
    return NextResponse.json({
      success: true,
      message: `Verify thành công (provider: ${result.provider}).`,
    });
  } catch (error) {
    console.error("POST /api/system/mail error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}
