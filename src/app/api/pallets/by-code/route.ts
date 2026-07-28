import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

// GET /api/pallets/by-code?code=PL260506.005 — resolve QR pallet
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "pallet", "read");
  if (denied) return denied;
  try {
    const code = req.nextUrl.searchParams.get("code")?.trim();
    if (!code) {
      return NextResponse.json({ success: false, error: "Thiếu code." }, { status: 400 });
    }

    const pallet = await prisma.pallet.findUnique({
      where: { code },
      include: {
        location: { select: { id: true, code: true, zone: true, rack: true, level: true } },
        supplier: { select: { id: true, code: true, name: true } },
        inbound_request: { select: { id: true, code: true } },
        parent: { select: { id: true, code: true } },
        lines: {
          include: {
            item_code: {
              select: {
                id: true,
                code: true,
                short_name: true,
                unit: { select: { id: true, name: true, symbol: true } },
              },
            },
          },
        },
      },
    });

    if (!pallet) {
      return NextResponse.json(
        { success: false, error: `Pallet "${code}" không tồn tại.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: pallet });
  } catch (error) {
    console.error("GET /api/pallets/by-code error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tra cứu pallet." }, { status: 500 });
  }
}
