import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestActor, logAudit } from "@/lib/audit";
import { notifyByRoles } from "@/lib/notifications";
import { guardPermission } from "@/lib/auth-server";
import { buildMovementSnapshot } from "@/lib/movement-snapshot";

// POST /api/forklift/relocate — Chuyển pallet sang vị trí mới (UC-FK-03)
//
// Phase 6.1 (BUG_REPORT UC-FK-03_TC20 + Not Run TC01/08/09/10/12/18):
//   - Audit log đầy đủ qua helper (role/IP/UA) — trước fix không có audit
//     khi chuyển vị trí → TC20 ghi nhận "Hệ thống chưa xây dựng tính năng".
//   - Validate QR format vị trí đích.
//   - Hỗ trợ tra location bằng code (QR scan).
export async function POST(req: NextRequest) {
  const denied = await guardPermission(req, "forklift", "write");
  if (denied) return denied;
  try {
    const body = await req.json();
    const { pallet_id, new_location_id: newLocIdInput, new_location_code, reason } = body;

    if (!pallet_id) {
      return NextResponse.json({ success: false, error: "Thiếu pallet_id." }, { status: 400 });
    }
    if (!newLocIdInput && !new_location_code) {
      return NextResponse.json(
        { success: false, error: "Thiếu vị trí đích — chọn từ danh sách hoặc quét QR." },
        { status: 400 }
      );
    }

    if (new_location_code && !/^[A-Z]+-\d{2}-\d{2}$/.test(String(new_location_code).trim().toUpperCase())) {
      return NextResponse.json(
        { success: false, error: `Mã vị trí "${new_location_code}" không hợp lệ. Định dạng: X-NN-NN.` },
        { status: 400 }
      );
    }

    const pallet = await prisma.pallet.findUnique({ where: { id: pallet_id } });
    if (!pallet) return NextResponse.json({ success: false, error: "Không tìm thấy pallet." }, { status: 404 });
    if (pallet.status !== "IN_STORAGE") {
      return NextResponse.json(
        { success: false, error: `Pallet phải đang trong kho. Hiện tại: "${pallet.status}".` },
        { status: 400 }
      );
    }
    if (!pallet.location_id) {
      return NextResponse.json({ success: false, error: "Pallet chưa có vị trí hiện tại." }, { status: 400 });
    }

    const oldLocationId = pallet.location_id;
    const newLocation = newLocIdInput
      ? await prisma.location.findUnique({
          where: { id: newLocIdInput },
          include: {
            pallets: {
              where: { status: { in: ["IN_STORAGE", "IN_STAGING"] } },
              select: { id: true, total_weight_kg: true },
            },
          },
        })
      : await prisma.location.findUnique({
          where: { code: String(new_location_code).trim().toUpperCase() },
          include: {
            pallets: {
              where: { status: { in: ["IN_STORAGE", "IN_STAGING"] } },
              select: { id: true, total_weight_kg: true },
            },
          },
        });
    if (!newLocation) {
      return NextResponse.json(
        { success: false, error: new_location_code ? `Mã vị trí "${new_location_code}" không tồn tại.` : "Vị trí mới không tồn tại." },
        { status: 404 }
      );
    }
    if (oldLocationId === newLocation.id) {
      return NextResponse.json({ success: false, error: "Vị trí mới trùng vị trí cũ." }, { status: 400 });
    }
    if (newLocation.status === "MAINTENANCE") {
      return NextResponse.json(
        { success: false, error: `Vị trí "${newLocation.code}" đang bảo trì.` },
        { status: 400 }
      );
    }
    if (!newLocation.is_active) {
      return NextResponse.json(
        { success: false, error: `Vị trí "${newLocation.code}" không hoạt động.` },
        { status: 400 }
      );
    }
    if (newLocation.type !== "STORAGE") {
      return NextResponse.json(
        { success: false, error: `Vị trí "${newLocation.code}" không phải vị trí chứa (${newLocation.type}).` },
        { status: 400 }
      );
    }

    // VALIDATE CAPACITY tại vị trí MỚI
    const currentPalletCount = newLocation.pallets.length;
    const currentWeightKg = newLocation.pallets.reduce((s, p) => s + Number(p.total_weight_kg), 0);
    const palletWeightKg = Number(pallet.total_weight_kg);

    if (newLocation.max_pallets != null && currentPalletCount >= newLocation.max_pallets) {
      return NextResponse.json(
        {
          success: false,
          error: `Vị trí "${newLocation.code}" đã đủ ${currentPalletCount}/${newLocation.max_pallets} pallet — không nhận thêm.`,
        },
        { status: 400 }
      );
    }
    if (newLocation.max_weight_kg != null) {
      const maxWeight = Number(newLocation.max_weight_kg);
      const afterWeight = currentWeightKg + palletWeightKg;
      if (afterWeight > maxWeight) {
        return NextResponse.json(
          {
            success: false,
            error: `Pallet ${palletWeightKg}kg vượt sức chứa của vị trí "${newLocation.code}" (đang ${currentWeightKg}kg + thêm ${palletWeightKg}kg = ${afterWeight}kg > ${maxWeight}kg cho phép).`,
          },
          { status: 400 }
        );
      }
    }

    const oldLocation = await prisma.location.findUnique({
      where: { id: oldLocationId },
      include: {
        pallets: {
          where: { status: { in: ["IN_STORAGE", "IN_STAGING"] }, id: { not: pallet_id } },
          select: { id: true },
        },
      },
    });
    const actor = getRequestActor(req);

    // Sau khi chuyển: vị trí cũ → EMPTY nếu hết pallet; vị trí mới → FULL nếu đầy slot, ngược lại USING
    const oldRemaining = oldLocation?.pallets.length || 0;
    const newOldStatus = oldRemaining === 0 ? "EMPTY" : "USING";
    const newPalletCount = currentPalletCount + 1;
    const newNewStatus =
      newLocation.max_pallets != null && newPalletCount >= newLocation.max_pallets ? "FULL" : "USING";

    const updatedPallet = await prisma.$transaction(async (tx) => {
      const p = await tx.pallet.update({
        where: { id: pallet_id },
        data: { location_id: newLocation.id },
      });
      await tx.location.update({ where: { id: oldLocationId }, data: { status: newOldStatus } });
      await tx.location.update({ where: { id: newLocation.id }, data: { status: newNewStatus } });
      // WVG-179: ledger snapshot — 1 movement / mỗi dòng pallet (đủ item/lot/qty).
      const lines = await tx.palletLine.findMany({
        where: { pallet_id },
        select: { item_code_id: true, lot: true, expiry_date: true, qty_box: true, qty_unit: true },
      });
      await tx.movement.createMany({
        data: buildMovementSnapshot(
          {
            pallet_id,
            movement_type: "RELOCATE",
            from_location_id: oldLocationId,
            to_location_id: newLocation.id,
            performed_by: actor.userId ?? null,
            reason: reason || null,
          },
          lines
        ),
      });
      return p;
    });

    await logAudit(req, {
      entity_type: "pallet",
      entity_id: pallet_id,
      action: "RELOCATE",
      old_value: { location_code: oldLocation?.code || null },
      new_value: { location_code: newLocation.code, location_zone: newLocation.zone },
      reason: reason || null,
    });

    // Notify THU_KHO khi xe nâng chuyển vị trí pallet
    notifyByRoles(["THU_KHO"], {
      type: "PALLET_RELOCATED",
      title: `Pallet chuyển vị trí: ${pallet.code}`,
      body: `Xe nâng đã chuyển pallet ${pallet.code}: ${oldLocation?.code || "?"} → ${newLocation.code}.`,
      entity_type: "pallet",
      entity_id: pallet_id,
      link_url: `/thukho/pallet/${pallet_id}`,
    }).catch((err) => console.error("notifyByRoles PALLET_RELOCATED:", err));

    return NextResponse.json({
      success: true,
      data: updatedPallet,
      message: `Pallet ${pallet.code}: ${oldLocation?.code || "?"} → ${newLocation.code}`,
    });
  } catch (error) {
    console.error("POST /api/forklift/relocate error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi chuyển vị trí." }, { status: 500 });
  }
}
