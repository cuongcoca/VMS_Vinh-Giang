import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestActor, logAudit } from "@/lib/audit";
import { notifyByRoles } from "@/lib/notifications";
import { guardPermission } from "@/lib/auth-server";

// POST /api/forklift/put-away — Đưa pallet vào vị trí (CONFIRMED → IN_STORAGE)
//
// Phase 6.1 (BUG_REPORT UC-FK-02_TC01 + Not Run TC05/06/15/18):
//   - Audit log qua helper (role/IP/UA) — TC_FK_02_18.
//   - Validate format mã QR vị trí (X-NN-NN) — TC_FK_02_06 sai format.
//   - Set performed_by trên Movement từ JWT.
//   - Hỗ trợ tra location_id từ location_code (QR scan trả code, không phải id).
export async function POST(req: NextRequest) {
  const denied = await guardPermission(req, "forklift", "write");
  if (denied) return denied;
  try {
    const body = await req.json();
    const { pallet_id, location_id: locIdInput, location_code } = body;

    if (!pallet_id) {
      return NextResponse.json({ success: false, error: "Thiếu pallet_id." }, { status: 400 });
    }
    if (!locIdInput && !location_code) {
      return NextResponse.json(
        { success: false, error: "Thiếu location_id hoặc location_code." },
        { status: 400 }
      );
    }

    // TC_FK_02_06: validate format code khi user dùng QR/manual nhập
    if (location_code && !/^[A-Z]+-\d{2}-\d{2}$/.test(String(location_code).trim().toUpperCase())) {
      return NextResponse.json(
        { success: false, error: `Mã vị trí "${location_code}" không hợp lệ. Định dạng đúng: X-NN-NN (vd: A-03-02).` },
        { status: 400 }
      );
    }

    const pallet = await prisma.pallet.findUnique({ where: { id: pallet_id } });
    if (!pallet) return NextResponse.json({ success: false, error: "Không tìm thấy pallet." }, { status: 404 });
    if (pallet.status !== "CONFIRMED") {
      return NextResponse.json(
        { success: false, error: `Pallet phải ở trạng thái "Đã xác nhận". Hiện tại: "${pallet.status}".` },
        { status: 400 }
      );
    }

    // Resolve location: ưu tiên location_id, fallback location_code
    const location = locIdInput
      ? await prisma.location.findUnique({
          where: { id: locIdInput },
          include: {
            pallets: {
              where: { status: { in: ["IN_STORAGE", "IN_STAGING"] } },
              select: { id: true, total_weight_kg: true },
            },
          },
        })
      : await prisma.location.findUnique({
          where: { code: String(location_code).trim().toUpperCase() },
          include: {
            pallets: {
              where: { status: { in: ["IN_STORAGE", "IN_STAGING"] } },
              select: { id: true, total_weight_kg: true },
            },
          },
        });
    if (!location) {
      return NextResponse.json(
        { success: false, error: location_code ? `Mã vị trí "${location_code}" không tồn tại.` : "Không tìm thấy vị trí." },
        { status: 404 }
      );
    }
    // Bảo trì / khóa → reject
    if (location.status === "MAINTENANCE") {
      return NextResponse.json(
        { success: false, error: `Vị trí "${location.code}" đang bảo trì, không thể xếp.` },
        { status: 400 }
      );
    }
    if (!location.is_active) {
      return NextResponse.json(
        { success: false, error: `Vị trí "${location.code}" không hoạt động.` },
        { status: 400 }
      );
    }
    if (location.type !== "STORAGE") {
      return NextResponse.json(
        { success: false, error: `Vị trí "${location.code}" không phải vị trí chứa (${location.type}).` },
        { status: 400 }
      );
    }

    // VALIDATE CAPACITY — không cho phép vượt số pallet & cân nặng
    const currentPalletCount = location.pallets.length;
    const currentWeightKg = location.pallets.reduce((s, p) => s + Number(p.total_weight_kg), 0);
    const palletWeightKg = Number(pallet.total_weight_kg);

    if (location.max_pallets != null && currentPalletCount >= location.max_pallets) {
      return NextResponse.json(
        {
          success: false,
          error: `Vị trí "${location.code}" đã đủ ${currentPalletCount}/${location.max_pallets} pallet — không nhận thêm.`,
        },
        { status: 400 }
      );
    }
    if (location.max_weight_kg != null) {
      const maxWeight = Number(location.max_weight_kg);
      const afterWeight = currentWeightKg + palletWeightKg;
      if (afterWeight > maxWeight) {
        return NextResponse.json(
          {
            success: false,
            error: `Pallet ${palletWeightKg}kg vượt sức chứa của vị trí "${location.code}" (đang ${currentWeightKg}kg + thêm ${palletWeightKg}kg = ${afterWeight}kg > ${maxWeight}kg cho phép).`,
          },
          { status: 400 }
        );
      }
    }

    const actor = getRequestActor(req);
    const location_id = location.id;

    // Sau khi đặt pallet: nếu đầy slot → status FULL; ngược lại → USING
    const newPalletCount = currentPalletCount + 1;
    const newLocationStatus =
      location.max_pallets != null && newPalletCount >= location.max_pallets ? "FULL" : "USING";

    // Transaction: cập nhật pallet + location + tạo movement
    const updatedPallet = await prisma.$transaction(async (tx) => {
      const p = await tx.pallet.update({
        where: { id: pallet_id },
        data: { status: "IN_STORAGE", location_id },
      });
      await tx.location.update({
        where: { id: location_id },
        data: { status: newLocationStatus },
      });
      await tx.movement.create({
        data: {
          pallet_id,
          movement_type: "PUT_AWAY",
          to_location_id: location_id,
          performed_by: actor.userId ?? undefined,
        },
      });
      return p;
    });

    await logAudit(req, {
      entity_type: "pallet",
      entity_id: pallet_id,
      action: "PUT_AWAY",
      old_value: { status: "CONFIRMED" },
      new_value: {
        status: "IN_STORAGE",
        location_code: location.code,
        location_zone: location.zone,
        location_after_count: newPalletCount,
        location_after_status: newLocationStatus,
        pallet_weight_kg: palletWeightKg,
        location_weight_after: currentWeightKg + palletWeightKg,
      },
    });

    // Notify THU_KHO khi xe nâng xếp pallet vào vị trí (CONFIRMED → IN_STORAGE)
    notifyByRoles(["THU_KHO"], {
      type: "PALLET_PUT_AWAY",
      title: `Pallet đã xếp: ${pallet.code}`,
      body: `Xe nâng đã xếp pallet ${pallet.code} vào vị trí ${location.code}.`,
      entity_type: "pallet",
      entity_id: pallet_id,
      link_url: `/thukho/pallet/${pallet_id}`,
    }).catch((err) => console.error("notifyByRoles PALLET_PUT_AWAY:", err));

    return NextResponse.json({
      success: true,
      data: updatedPallet,
      message: `Pallet ${pallet.code} đã xếp vào vị trí ${location.code}.`,
    });
  } catch (error) {
    console.error("POST /api/forklift/put-away error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi xếp pallet." }, { status: 500 });
  }
}
