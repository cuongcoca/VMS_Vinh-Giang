import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";
import { guardPermission } from "@/lib/auth-server";

// GET /api/locations/[id]/qr-png?size=400 — QR PNG cho 1 vị trí
// Content = location.code (plain text, theo quyết định Phase 1).
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(req, "location", "read");
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const size = Math.min(Math.max(Number(req.nextUrl.searchParams.get("size") || 600), 100), 1200);

    const loc = await prisma.location.findUnique({
      where: { id },
      select: { code: true },
    });
    if (!loc) {
      return new NextResponse("Not found", { status: 404 });
    }

    const buffer = await QRCode.toBuffer(loc.code, {
      width: size,
      margin: 3,
      errorCorrectionLevel: "H", // Cao nhất — chịu được mờ/bám bụi tới 30%
    });

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": `inline; filename="qr-${loc.code}.png"`,
      },
    });
  } catch (error) {
    console.error("GET /api/locations/[id]/qr-png error:", error);
    return new NextResponse("Server error", { status: 500 });
  }
}
