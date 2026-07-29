import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";
import { availableLineWhere, expiryCutoff } from "@/lib/inventory-expiry";

export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "forklift", "read");
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId") || "";

    if (!productId) {
      return NextResponse.json({ success: true, data: [] });
    }

    const lines = await prisma.palletLine.findMany({
      where: {
        item_code_id: productId,
        pallet: { status: "IN_STORAGE" },
        qty_box: { gt: 0 },
        // WVG-239: lô đã hết hạn bị chặn xuất → không gợi ý pick.
        ...availableLineWhere(expiryCutoff()),
      },
      include: {
        pallet: {
          include: {
            location: { select: { id: true, code: true } },
          },
        },
      },
      orderBy: { expiry_date: { sort: "asc", nulls: "last" } },
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const suggestions = lines.map((line, idx) => {
      let daysToExpiry: number | null = null;
      let warningLevel: "CRITICAL" | "WARN" | "NONE" = "NONE";

      if (line.expiry_date) {
        const exp = new Date(line.expiry_date);
        const diffTime = exp.getTime() - today.getTime();
        daysToExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (daysToExpiry <= 7) {
          warningLevel = "CRITICAL";
        } else if (daysToExpiry <= 30) {
          warningLevel = "WARN";
        }
      }

      return {
        palletId: line.pallet_id,
        palletCode: line.pallet.code,
        locationId: line.pallet.location_id,
        locationCode: line.pallet.location?.code || "Không xác định",
        lineId: line.id,
        lot: line.lot,
        expiryDate: line.expiry_date ? line.expiry_date.toISOString().split("T")[0] : null,
        qtyUnitAvailable: Number(line.qty_unit),
        weightKg: Number(line.weight_kg),
        warningLevel,
        daysToExpiry,
        priority: idx + 1,
      };
    });

    return NextResponse.json({ success: true, data: suggestions });
  } catch (error) {
    console.error("GET /api/forklift/fefo-suggestions error:", error);
    return NextResponse.json({ success: false, error: "Lỗi tải gợi ý FEFO." }, { status: 500 });
  }
}
