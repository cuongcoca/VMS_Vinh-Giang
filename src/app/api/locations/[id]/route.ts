import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LocationType, LocationStatus } from "@prisma/client";
import { guardPermission } from "@/lib/auth-server";

const ZONE_REGEX = /^[A-Z]{1,3}$/;
const RACK_REGEX = /^\d{1,3}$/;
const LEVEL_REGEX = /^\d{1,2}$/;

function formatCode(zone: string, rack: string, level: string) {
  return `${zone}-${rack.padStart(2, "0")}-${level.padStart(2, "0")}`;
}

// GET: Chi tiết một vị trí kho
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(request, "location", "read");
  if (denied) return denied;
  try {
    const { id } = await params;
    const location = await prisma.location.findFirst({
      where: { id, is_active: true }
    });

    if (!location) {
      return NextResponse.json(
        { success: false, error: "Vị trí kho không tồn tại hoặc đã bị ẩn." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: location });
  } catch (error) {
    console.error("GET /api/locations/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống khi lấy chi tiết vị trí." },
      { status: 500 }
    );
  }
}

// PUT: Cập nhật thông tin vị trí kho
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(request, "location", "write");
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await request.json();
    const { zone, rack, level, type, status, max_weight_kg, max_pallets, note } = body;

    // Kiểm tra tồn tại
    const existing = await prisma.location.findFirst({
      where: { id, is_active: true }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Vị trí kho không tồn tại hoặc đã bị ẩn." },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (zone !== undefined || rack !== undefined || level !== undefined) {
      const targetZone = (zone !== undefined ? zone : existing.zone).trim().toUpperCase();
      const targetRack = (rack !== undefined ? rack : existing.rack).toString().trim();
      const targetLevel = (level !== undefined ? level : existing.level).toString().trim();

      if (!ZONE_REGEX.test(targetZone)) {
        return NextResponse.json(
          { success: false, error: "Khu vực phải là chữ cái in hoa (1-3 ký tự)." },
          { status: 400 }
        );
      }
      if (!RACK_REGEX.test(targetRack)) {
        return NextResponse.json(
          { success: false, error: "Kệ phải là chữ số (1-3 ký tự)." },
          { status: 400 }
        );
      }
      if (!LEVEL_REGEX.test(targetLevel)) {
        return NextResponse.json(
          { success: false, error: "Tầng phải là chữ số (1-2 ký tự)." },
          { status: 400 }
        );
      }

      const code = formatCode(targetZone, targetRack, targetLevel);

      // Kiểm tra trùng code với vị trí khác
      if (code !== existing.code) {
        const codeDup = await prisma.location.findFirst({
          where: {
            code,
            id: { not: id },
            is_active: true
          }
        });
        if (codeDup) {
          return NextResponse.json(
            { success: false, error: `Mã vị trí "${code}" đã được sử dụng bởi vị trí khác.` },
            { status: 400 }
          );
        }
      }

      updateData.code = code;
      updateData.zone = targetZone;
      updateData.rack = targetRack.padStart(2, "0");
      updateData.level = targetLevel.padStart(2, "0");
    }

    if (type !== undefined) {
      updateData.type = type as LocationType;
    }
    if (status !== undefined) {
      updateData.status = status as LocationStatus;
    }
    if (max_weight_kg !== undefined) {
      updateData.max_weight_kg = max_weight_kg !== null ? parseFloat(max_weight_kg) : null;
    }
    if (max_pallets !== undefined) {
      updateData.max_pallets = max_pallets !== null ? parseInt(max_pallets, 10) : null;
    }
    if (note !== undefined) {
      updateData.note = note !== null ? note.trim() : null;
    }

    const updated = await prisma.location.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /api/locations/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống khi cập nhật vị trí." },
      { status: 500 }
    );
  }
}

// DELETE: Soft-delete vị trí kho
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(request, "location", "write");
  if (denied) return denied;
  try {
    const { id } = await params;

    const existing = await prisma.location.findFirst({
      where: { id, is_active: true }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Vị trí kho không tồn tại hoặc đã bị xóa." },
        { status: 404 }
      );
    }

    // TODO: Khi có các bảng Pallet/Inventory, cần check xem vị trí này có đang chứa hàng không (in-use check)
    // Hiện tại do các module khác chưa triển khai, chỉ thực hiện soft-delete.
    
    await prisma.location.update({
      where: { id },
      data: { is_active: false }
    });

    return NextResponse.json({ success: true, message: "Xóa vị trí kho thành công." });
  } catch (error) {
    console.error("DELETE /api/locations/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống khi xóa vị trí kho." },
      { status: 500 }
    );
  }
}
