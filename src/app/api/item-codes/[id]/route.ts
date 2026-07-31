import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalcPalletLinesByItemCode } from "@/lib/pallet-recalc";
import { notifyByRoles } from "@/lib/notifications";
import { guardPermission, requirePermission, apiErrorResponse } from "@/lib/auth-server";
import { logAudit } from "@/lib/audit";

// UC-MD-02 (MD02-RBAC-01/03): chỉ Kế toán chuẩn hóa; Quản lý xử lý ngoại lệ. Thủ kho KHÔNG.
const CAN_STANDARDIZE = ["KE_TOAN", "QUAN_LY"];

// GET: Chi tiết mã hàng
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(req, "item_code", "read");
  if (denied) return denied;
  try {
    const { id } = await params;
    const itemCode = await prisma.itemCode.findUnique({
      where: { id },
      include: {
        unit: { select: { id: true, name: true, symbol: true } },
        group: { select: { id: true, name: true } },
        product: { select: { id: true, sku: true, name: true } },
        creator: { select: { id: true, full_name: true } },
        standardizer: { select: { id: true, full_name: true } },
      },
    });

    if (!itemCode) {
      return NextResponse.json(
        { success: false, error: "Mã hàng không tồn tại." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: itemCode });
  } catch (error) {
    console.error("GET /api/item-codes/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}

// PUT: Cập nhật / Chuẩn hóa mã hàng (Kế toán — TC_STANDARD_001 → TC_STANDARD_012)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await requirePermission(req, "item_code", "write"); } catch (e) { return apiErrorResponse(e); }
  try {
    const { id } = await params;
    const body = await req.json();
    let {
      code, barcode, short_name, full_name, unit_id, specification, units_per_box,
      weight_per_box, group_id, product_id, photo_url, note,
      status,
    } = body;

    // Trim
    if (code) code = code.trim();
    if (barcode) barcode = barcode.trim();
    if (short_name) short_name = short_name.trim();
    if (full_name) full_name = full_name.trim();
    if (specification) specification = specification.trim();
    if (note) note = note.trim();

    const existing = await prisma.itemCode.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Mã hàng không tồn tại." },
        { status: 404 }
      );
    }

    // Validate required
    if (code !== undefined && !code) {
      return NextResponse.json(
        { success: false, error: "Mã hàng là bắt buộc.", field: "code" },
        { status: 400 }
      );
    }
    if (short_name !== undefined && !short_name) {
      return NextResponse.json(
        { success: false, error: "Tên rút gọn là bắt buộc.", field: "short_name" },
        { status: 400 }
      );
    }

    // TC_STANDARD_008: Check mã trùng khi sửa
    if (code && code !== existing.code) {
      const dup = await prisma.itemCode.findUnique({ where: { code } });
      if (dup) {
        return NextResponse.json(
          { success: false, error: `Mã hàng "${code}" đã tồn tại.`, field: "code" },
          { status: 409 }
        );
      }
    }

    // Validate code format
    if (code && !/^[A-Za-z0-9\-_./]+$/.test(code)) {
      return NextResponse.json(
        { success: false, error: "Mã hàng chỉ được chứa chữ, số, dấu gạch ngang, gạch dưới, dấu chấm, dấu /.", field: "code" },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (code !== undefined) updateData.code = code;
    if (barcode !== undefined) updateData.barcode = barcode || null;
    if (short_name !== undefined) updateData.short_name = short_name;
    if (full_name !== undefined) updateData.full_name = full_name || null;
    if (unit_id !== undefined) updateData.unit_id = unit_id || null;
    if (specification !== undefined) updateData.specification = specification || null;
    if (units_per_box !== undefined && units_per_box !== null && units_per_box !== "") {
      const n = parseInt(units_per_box, 10);
      if (isNaN(n) || n < 1) {
        return NextResponse.json(
          { success: false, error: "Số lẻ/thùng phải là số nguyên >= 1.", field: "units_per_box" },
          { status: 400 }
        );
      }
      updateData.units_per_box = n;
    }
    if (weight_per_box !== undefined) updateData.weight_per_box = weight_per_box != null && weight_per_box !== "" ? parseFloat(weight_per_box) : null;
    if (group_id !== undefined) updateData.group_id = group_id || null;
    if (product_id !== undefined) updateData.product_id = product_id || null;
    if (photo_url !== undefined) updateData.photo_url = photo_url || null;
    if (note !== undefined) updateData.note = note || null;

    // TC_STANDARD_001: Chuẩn hóa → chuyển status
    const isStandardizing = status === "standardized" && existing.status === "pending";
    if (isStandardizing) {
      // MD02-RBAC-01/03: chỉ Kế toán (Quản lý ngoại lệ) được chuyển Chờ xử lý → Đã chuẩn hóa.
      // Thủ kho có item_code:write để tạo/sửa mã Chờ xử lý nhưng KHÔNG được tự chuẩn hóa.
      if (!CAN_STANDARDIZE.includes(ctx.user.role)) {
        return NextResponse.json(
          { success: false, error: "Chỉ Kế toán được chuẩn hóa mã hàng." },
          { status: 403 }
        );
      }
      // TC_STANDARD_006: Validate fields bắt buộc khi chuẩn hóa
      const finalFullName = full_name !== undefined ? full_name : existing.full_name;
      if (!finalFullName) {
        return NextResponse.json(
          { success: false, error: "Tên đầy đủ là bắt buộc khi chuẩn hóa.", field: "full_name" },
          { status: 400 }
        );
      }
      updateData.status = "standardized";
      updateData.standardized_at = new Date();
      updateData.standardized_by = ctx.user.id; // UC-MD-02: truy vết Kế toán chuẩn hóa
    } else if (status !== undefined) {
      updateData.status = status;
    }

    // Auto-tạo Product khi chuẩn hóa mà chưa link Product nào → ItemCode standardized
    // sẽ xuất hiện ở /wms/master-data thông qua Product mới được tạo.
    // Re-use nếu Product với sku trùng đã tồn tại (idempotent khi chạy lại).
    const updated = await prisma.$transaction(async (tx) => {
      const finalProductId = product_id !== undefined ? (product_id || null) : existing.product_id;

      if (isStandardizing && !finalProductId) {
        const finalCode = (code !== undefined ? code : existing.code) as string;
        const finalShortName = (short_name !== undefined ? short_name : existing.short_name) as string;
        const finalFullName = (full_name !== undefined ? full_name : existing.full_name) as string;
        const finalUnitId = unit_id !== undefined ? (unit_id || null) : existing.unit_id;
        const finalGroupId = group_id !== undefined ? (group_id || null) : existing.group_id;
        const finalSpec = specification !== undefined ? (specification || null) : existing.specification;
        const finalWeight = weight_per_box !== undefined
          ? (weight_per_box != null && weight_per_box !== "" ? parseFloat(weight_per_box) : null)
          : existing.weight_per_box;
        const finalBarcode = barcode !== undefined ? (barcode || null) : existing.barcode;

        if (finalCode.length > 50) {
          throw new Error(`Mã hàng dài ${finalCode.length} ký tự, vượt giới hạn SKU 50 ký tự. Vui lòng chọn 1 Product có sẵn để liên kết, hoặc rút gọn mã hàng.`);
        }

        const existingProduct = await tx.product.findUnique({ where: { sku: finalCode } });
        if (existingProduct) {
          updateData.product_id = existingProduct.id;
        } else {
          const newProduct = await tx.product.create({
            data: {
              sku: finalCode,
              barcode: finalBarcode,
              name: finalFullName,
              short_name: finalShortName,
              unit_id: finalUnitId,
              group_id: finalGroupId,
              specification: finalSpec,
              weight_per_box: finalWeight,
            },
          });
          updateData.product_id = newProduct.id;
        }
      }

      return tx.itemCode.update({
        where: { id },
        data: updateData,
        include: {
          unit: { select: { id: true, name: true, symbol: true } },
          group: { select: { id: true, name: true } },
          product: { select: { id: true, sku: true, name: true, barcode: true } },
          creator: { select: { id: true, full_name: true } },
          standardizer: { select: { id: true, full_name: true } },
        },
      });
    });

    // Cascade: recalc pallet_line.weight_kg + qty_unit nếu weight_per_box hoặc units_per_box đổi
    let cascadeInfo: { lines_updated: number; pallets_updated: number; pallet_codes: string[] } | null = null;
    const newWeight = weight_per_box != null && weight_per_box !== "" ? parseFloat(weight_per_box) : null;
    const oldWeight = existing.weight_per_box != null ? Number(existing.weight_per_box) : null;
    const weightChanged = weight_per_box !== undefined && newWeight !== oldWeight;
    const newUnits = units_per_box != null && units_per_box !== "" ? parseInt(units_per_box, 10) : null;
    const unitsChanged = units_per_box !== undefined && newUnits !== null && newUnits !== existing.units_per_box;

    if (weightChanged || unitsChanged) {
      cascadeInfo = await recalcPalletLinesByItemCode(prisma, id, {
        new_weight_per_box: weightChanged ? newWeight : undefined,
        new_units_per_box: unitsChanged ? (newUnits as number) : undefined,
      });
    }

    // Notify THU_KHO khi kế toán chuẩn hóa mã hàng
    if (isStandardizing) {
      notifyByRoles(["THU_KHO"], {
        type: "ITEM_CODE_STANDARDIZED",
        title: `Mã hàng đã chuẩn hóa: ${updated.code}`,
        body: `Kế toán đã chuẩn hóa mã hàng ${updated.code} (${updated.short_name}).`,
        entity_type: "item_code",
        entity_id: id,
        link_url: `/thukho/item-codes/${id}`,
      }).catch((err) => console.error("notifyByRoles ITEM_CODE_STANDARDIZED:", err));
    }

    // UC-MD-02: audit chuẩn hóa / cập nhật mã hàng — best-effort.
    await logAudit(req, {
      entity_type: "item_code",
      entity_id: id,
      action: isStandardizing ? "STANDARDIZE_ITEM_CODE" : "UPDATE_ITEM_CODE",
      old_value: { code: existing.code, short_name: existing.short_name, full_name: existing.full_name, group_id: existing.group_id, product_id: existing.product_id, status: existing.status },
      new_value: { code: updated.code, short_name: updated.short_name, full_name: updated.full_name, group_id: updated.group_id, product_id: updated.product_id, status: updated.status },
      reason: isStandardizing
        ? `${ctx.user.full_name} chuẩn hóa mã hàng ${updated.code} (Chờ xử lý → Đã chuẩn hóa)`
        : `${ctx.user.full_name} cập nhật mã hàng ${updated.code}`,
    });

    return NextResponse.json({ success: true, data: updated, cascade: cascadeInfo });
  } catch (error) {
    console.error("PUT /api/item-codes/[id] error:", error);
    const msg = error instanceof Error ? error.message : "";
    if (msg.startsWith("Mã hàng dài")) {
      return NextResponse.json({ success: false, error: msg, field: "code" }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}

// DELETE: Xóa mã hàng (chỉ khi pending)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await requirePermission(req, "item_code", "write"); } catch (e) { return apiErrorResponse(e); }
  try {
    const { id } = await params;
    const existing = await prisma.itemCode.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Mã hàng không tồn tại." },
        { status: 404 }
      );
    }

    if (existing.status === "standardized") {
      return NextResponse.json(
        { success: false, error: "Không thể xóa mã hàng đã chuẩn hóa." },
        { status: 409 }
      );
    }

    await prisma.itemCode.delete({ where: { id } });
    // UC-MD-02: audit xóa mã hàng (chỉ khi Chờ xử lý) — best-effort.
    await logAudit(req, {
      entity_type: "item_code",
      entity_id: id,
      action: "DELETE_ITEM_CODE",
      old_value: { code: existing.code, short_name: existing.short_name, status: existing.status },
      new_value: null,
      reason: `${ctx.user.full_name} xóa mã hàng ${existing.code} (Chờ xử lý)`,
    });
    return NextResponse.json({ success: true, message: "Đã xóa mã hàng." });
  } catch (error) {
    console.error("DELETE /api/item-codes/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}
