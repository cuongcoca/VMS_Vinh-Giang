import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

// GET: Danh sách đơn vị tính (có search)
export async function GET(request: NextRequest) {
  const denied = await guardPermission(request, "unit", "read");
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    const units = await prisma.unitOfMeasure.findMany({
      where: {
        is_active: true,
        ...(q && {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { symbol: { contains: q, mode: "insensitive" as const } },
          ],
        }),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        symbol: true,
        is_active: true,
        created_at: true,
        _count: { select: { products: true, itemCodes: true } },
      },
    });

    return NextResponse.json({ success: true, data: units });
  } catch (error) {
    console.error("GET /api/units error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}

// POST: Thêm đơn vị tính mới
export async function POST(request: NextRequest) {
  const denied = await guardPermission(request, "unit", "write");
  if (denied) return denied;
  try {
    const body = await request.json();
    const { name, symbol } = body;

    // Validate
    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Tên đơn vị tính là bắt buộc." },
        { status: 400 }
      );
    }

    // Check trùng tên
    const existing = await prisma.unitOfMeasure.findFirst({
      where: { name: name.trim(), is_active: true },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Đơn vị tính "${name.trim()}" đã tồn tại.` },
        { status: 400 }
      );
    }

    const unit = await prisma.unitOfMeasure.create({
      data: {
        name: name.trim(),
        symbol: symbol?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, data: unit }, { status: 201 });
  } catch (error) {
    console.error("POST /api/units error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}
