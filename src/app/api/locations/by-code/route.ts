import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/locations/by-code?code=A-03-02 — resolve QR vị trí
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code")?.trim();
    if (!code) {
      return NextResponse.json({ success: false, error: "Thiếu code." }, { status: 400 });
    }

    const loc = await prisma.location.findUnique({
      where: { code },
      include: {
        pallets: {
          select: {
            id: true,
            code: true,
            status: true,
            total_lines: true,
            total_weight_kg: true,
          },
        },
      },
    });

    if (!loc) {
      return NextResponse.json(
        { success: false, error: `Vị trí "${code}" không tồn tại.` },
        { status: 404 }
      );
    }

    const currentPalletCount = loc.pallets.length;
    const isFull = loc.max_pallets ? currentPalletCount >= loc.max_pallets : false;

    return NextResponse.json({
      success: true,
      data: {
        ...loc,
        current_pallets_count: currentPalletCount,
        is_full: isFull,
      },
    });
  } catch (error) {
    console.error("GET /api/locations/by-code error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tra cứu vị trí." }, { status: 500 });
  }
}
