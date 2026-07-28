import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";
import { guardPermission } from "@/lib/auth-server";

// GET /api/pallets/[id]/qr-png?size=400 — QR PNG cho 1 pallet
// Content = pallet.code (plain text).
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(req, "pallet", "read");
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const size = Math.min(Math.max(Number(req.nextUrl.searchParams.get("size") || 600), 100), 1200);

    const pal = await prisma.pallet.findUnique({
      where: { id },
      select: { code: true },
    });
    if (!pal) {
      return new NextResponse("Not found", { status: 404 });
    }

    const buffer = await QRCode.toBuffer(pal.code, {
      width: size,
      margin: 3,
      errorCorrectionLevel: "H", // Cao nhất — chịu được mờ/bám bụi tới 30%
    });

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": `inline; filename="qr-${pal.code}.png"`,
      },
    });
  } catch (error) {
    console.error("GET /api/pallets/[id]/qr-png error:", error);
    return new NextResponse("Server error", { status: 500 });
  }
}
