import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

export async function POST(req: NextRequest) {
  const denied = await guardPermission(req, "forklift", "write");
  if (denied) return denied;
  try {
    const body = await req.json();
    const { pallet_id, driver_id } = body;

    if (!pallet_id || !driver_id) {
      return NextResponse.json(
        { success: false, error: "Thiếu pallet_id hoặc driver_id." },
        { status: 400 }
      );
    }

    // 1. Check if pallet exists and has status CONFIRMED
    const pallet = await prisma.pallet.findUnique({
      where: { id: pallet_id },
    });
    if (!pallet) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy pallet." },
        { status: 404 }
      );
    }
    if (pallet.status !== "CONFIRMED") {
      return NextResponse.json(
        {
          success: false,
          error: `Pallet không ở trạng thái "Chờ nhập". Trạng thái hiện tại: ${pallet.status}`,
        },
        { status: 400 }
      );
    }

    // 2. Check if driver (user) exists and has role XE_NANG
    const driver = await prisma.user.findUnique({
      where: { id: driver_id },
    });
    if (!driver) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy tài xế." },
        { status: 404 }
      );
    }
    if (driver.role !== "XE_NANG") {
      return NextResponse.json(
        {
          success: false,
          error: "Người dùng được chọn không phải tài xế xe nâng.",
        },
        { status: 400 }
      );
    }

    // 3. Create a movement record to mark it as assigned (In Progress / Đang di chuyển).
    // WVG-179: đây là marker GIAO VIỆC (chưa move vật lý, đích chưa xác định) → bổ sung
    // nguồn (from_location) + actor + reason. Move vật lý thực tế (put-away/relocate)
    // ghi snapshot đầy đủ item/lot/qty theo từng dòng ở route tương ứng.
    const movement = await prisma.movement.create({
      data: {
        pallet_id,
        movement_type: "PUT_AWAY",
        from_location_id: pallet.location_id ?? null,
        performed_by: driver_id,
        reason: `Giao việc bởi Admin cho tài xế ${driver.full_name}`,
      },
    });

    // 4. Create audit log
    await prisma.auditLog.create({
      data: {
        entity_type: "pallet",
        entity_id: pallet_id,
        action: "ASSIGN_DRIVER",
        old_value: { status: "CONFIRMED" },
        new_value: {
          status: "CONFIRMED",
          assigned_to: driver.full_name,
          movement_id: movement.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã giao việc cho tài xế ${driver.full_name} thành công.`,
      data: movement,
    });
  } catch (error) {
    console.error("POST /api/forklift/web/assign error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống khi phân công việc." },
      { status: 500 }
    );
  }
}
