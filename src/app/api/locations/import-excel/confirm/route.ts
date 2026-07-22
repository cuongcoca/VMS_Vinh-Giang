import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, LocationType, LocationStatus } from "@prisma/client";
import { requireAuth, apiErrorResponse } from "@/lib/auth-server";

// UC-MD-05 / TC_LOC_001: Import vị trí kho từ Excel (bước 2 — ghi dữ liệu).
// Mã code là unique toàn cục: dòng trùng mã sẽ cập nhật cấu hình (type / tải / pallet
// / ghi chú) nhưng GIỮ NGUYÊN trạng thái vận hành; dòng mới tạo với trạng thái Trống.

interface LocationImportItem {
  code: string;
  zone: string;
  rack: string;
  level: string;
  type: LocationType;
  max_weight_kg: number | null;
  max_pallets: number | null;
  note: string;
  status: string;
}

function formatCode(zone: string, rack: string, level: string) {
  return `${zone}-${rack.padStart(2, "0")}-${level.padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  let auth;
  try { auth = await requireAuth(req); } catch (e) { return apiErrorResponse(e); }
  try {
    const body = await req.json();
    const { locations } = body as { locations: LocationImportItem[] };

    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      return NextResponse.json({ success: false, error: "Không có danh sách vị trí để import." }, { status: 400 });
    }

    // Loại bỏ dòng lỗi (ERROR) và dòng thiếu trường bắt buộc.
    const valid = locations.filter((l) => l.zone && l.rack && l.level && l.status !== "ERROR");
    if (valid.length === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy vị trí hợp lệ để import." }, { status: 400 });
    }

    let createdCount = 0;
    let updatedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const l of valid) {
        const zone = l.zone.toString().trim().toUpperCase();
        const rack = l.rack.toString().trim().padStart(2, "0");
        const level = l.level.toString().trim().padStart(2, "0");
        const code = formatCode(zone, rack, level);
        const type =
          l.type && (Object.values(LocationType) as string[]).includes(l.type) ? l.type : LocationType.STORAGE;
        const weight =
          l.max_weight_kg !== null && l.max_weight_kg !== undefined ? new Prisma.Decimal(l.max_weight_kg) : null;
        const pallets = l.max_pallets !== null && l.max_pallets !== undefined ? l.max_pallets : null;
        const note = l.note?.toString().trim() || null;

        // Dùng findUnique (không lọc is_active) vì code unique toàn cục — mã đã ẩn
        // vẫn chiếm chỗ và cần được kích hoạt lại thay vì tạo trùng gây lỗi ràng buộc.
        const existing = await tx.location.findUnique({ where: { code } });

        if (existing) {
          const updated = await tx.location.update({
            where: { code },
            data: { zone, rack, level, type, max_weight_kg: weight, max_pallets: pallets, note, is_active: true },
          });
          updatedCount++;
          await tx.auditLog.create({
            data: {
              entity_type: "location",
              entity_id: updated.id,
              action: "UPDATE_BY_IMPORT",
              old_value: { code: existing.code, type: existing.type } as Prisma.InputJsonValue,
              new_value: { code, type, max_weight_kg: l.max_weight_kg, max_pallets: pallets, note } as Prisma.InputJsonValue,
              reason: "Import hàng loạt vị trí kho từ Excel",
              performed_by: auth.user.id,
              performed_by_role: auth.user.role,
            },
          });
        } else {
          const created = await tx.location.create({
            data: {
              code,
              zone,
              rack,
              level,
              type,
              status: LocationStatus.EMPTY,
              max_weight_kg: weight,
              max_pallets: pallets,
              note,
            },
          });
          createdCount++;
          await tx.auditLog.create({
            data: {
              entity_type: "location",
              entity_id: created.id,
              action: "CREATE_BY_IMPORT",
              new_value: { code, type, max_weight_kg: l.max_weight_kg, max_pallets: pallets, note } as Prisma.InputJsonValue,
              reason: "Import hàng loạt vị trí kho từ Excel",
              performed_by: auth.user.id,
              performed_by_role: auth.user.role,
            },
          });
        }
      }
    });

    const total = createdCount + updatedCount;
    return NextResponse.json({
      success: true,
      message: `Đã import thành công ${total} vị trí (tạo mới ${createdCount}, cập nhật ${updatedCount}).`,
      count: total,
      created: createdCount,
      updated: updatedCount,
    });
  } catch (error) {
    console.error("POST /api/locations/import-excel/confirm error:", error);
    return NextResponse.json({ success: false, error: "Lỗi hệ thống khi ghi dữ liệu vị trí." }, { status: 500 });
  }
}
