import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/system/config — Lấy cấu hình
export async function GET() {
  try {
    const configs = await prisma.systemConfig.findMany({ orderBy: { key: "asc" } });
    return NextResponse.json({ success: true, data: configs });
  } catch (error) {
    console.error("GET /api/system/config error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

// PUT /api/system/config — Cập nhật cấu hình
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, value, label } = body;
    if (!key?.trim()) return NextResponse.json({ success: false, error: "Thiếu key." }, { status: 400 });

    const config = await prisma.systemConfig.upsert({
      where: { key: key.trim() },
      update: { value: String(value), label: label || null },
      create: { key: key.trim(), value: String(value), label: label || null },
    });
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error("PUT /api/system/config error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}
