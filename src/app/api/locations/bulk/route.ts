import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LocationType, LocationStatus } from "@prisma/client";
import { requirePermission, apiErrorResponse } from "@/lib/auth-server";

const ZONE_REGEX = /^[A-Z]{1,3}$/;

function formatCode(zone: string, rack: number, level: number) {
  const rackStr = rack.toString().padStart(2, "0");
  const levelStr = level.toString().padStart(2, "0");
  return `${zone}-${rackStr}-${levelStr}`;
}

export async function POST(request: NextRequest) {
  try { await requirePermission(request, "location", "write"); } catch (e) { return apiErrorResponse(e); }
  try {
    const body = await request.json();
    const {
      zone,
      rackFrom,
      rackTo,
      levelFrom,
      levelTo,
      type,
      max_weight_kg,
      max_pallets,
      note
    } = body;

    // Validate inputs
    if (!zone) {
      return NextResponse.json(
        { success: false, error: "Khu vực (Zone) là bắt buộc." },
        { status: 400 }
      );
    }

    const cleanZone = zone.trim().toUpperCase();
    if (!ZONE_REGEX.test(cleanZone)) {
      return NextResponse.json(
        { success: false, error: "Khu vực phải là chữ cái in hoa (1-3 ký tự)." },
        { status: 400 }
      );
    }

    const rFrom = parseInt(rackFrom, 10);
    const rTo = parseInt(rackTo, 10);
    const lFrom = parseInt(levelFrom, 10);
    const lTo = parseInt(levelTo, 10);

    if (isNaN(rFrom) || isNaN(rTo) || isNaN(lFrom) || isNaN(lTo)) {
      return NextResponse.json(
        { success: false, error: "Dải Kệ và Tầng phải là chữ số hợp lệ." },
        { status: 400 }
      );
    }

    if (rFrom < 1 || rTo < 1 || lFrom < 1 || lTo < 1) {
      return NextResponse.json(
        { success: false, error: "Số Kệ và số Tầng phải bắt đầu từ 1." },
        { status: 400 }
      );
    }

    if (rFrom > rTo) {
      return NextResponse.json(
        { success: false, error: "Kệ bắt đầu không thể lớn hơn Kệ kết thúc." },
        { status: 400 }
      );
    }

    if (lFrom > lTo) {
      return NextResponse.json(
        { success: false, error: "Tầng bắt đầu không thể lớn hơn Tầng kết thúc." },
        { status: 400 }
      );
    }

    // Giới hạn số lượng vị trí tối đa trong một lần tạo để tránh timeout (VD: tối đa 500 ô)
    const totalToCreate = (rTo - rFrom + 1) * (lTo - lFrom + 1);
    if (totalToCreate > 500) {
      return NextResponse.json(
        { success: false, error: "Mỗi lượt tạo hàng loạt không quá 500 vị trí để tránh treo hệ thống." },
        { status: 400 }
      );
    }

    // Lấy danh sách các vị trí đã tồn tại
    const existingLocations = await prisma.location.findMany({
      where: {
        zone: cleanZone,
        is_active: true
      },
      select: { code: true }
    });
    const existingCodesSet = new Set(existingLocations.map((l) => l.code));

    const created: string[] = [];
    const skipped: string[] = [];
    const dataToInsert = [];

    // Duyệt qua dải Kệ và Tầng để tạo
    for (let r = rFrom; r <= rTo; r++) {
      for (let l = lFrom; l <= lTo; l++) {
        const code = formatCode(cleanZone, r, l);
        if (existingCodesSet.has(code)) {
          skipped.push(code);
        } else {
          dataToInsert.push({
            code,
            zone: cleanZone,
            rack: r.toString().padStart(2, "0"),
            level: l.toString().padStart(2, "0"),
            type: type || LocationType.STORAGE,
            status: LocationStatus.EMPTY,
            max_weight_kg: max_weight_kg ? parseFloat(max_weight_kg) : null,
            max_pallets: max_pallets ? parseInt(max_pallets, 10) : null,
            note: note ? note.trim() : null
          });
          created.push(code);
        }
      }
    }

    if (dataToInsert.length > 0) {
      await prisma.location.createMany({
        data: dataToInsert
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        total: totalToCreate,
        created,
        skipped
      }
    });
  } catch (error) {
    console.error("POST /api/locations/bulk error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống khi tạo vị trí kho hàng loạt." },
      { status: 500 }
    );
  }
}
