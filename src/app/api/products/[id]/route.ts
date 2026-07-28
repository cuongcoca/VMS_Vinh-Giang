import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recalcPalletLinesByItemCode } from "@/lib/pallet-recalc";
import { requirePermission, guardPermission, apiErrorResponse, ApiError } from "@/lib/auth-server";

// GET: Chi tiết sản phẩm
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(req, "item_code", "read");
  if (denied) return denied;
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, symbol: true } },
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Sản phẩm không tồn tại." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    console.error("GET /api/products/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}

// PUT: Sửa sản phẩm
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TC_PERMISSION_005: verify token (gồm hạn dùng exp) + quyền trước khi sửa.
    // Token hết hạn/không hợp lệ → requireAuth ném 401 → client redirect /auth.
    await requirePermission(req, "item_code", "special");

    const { id } = await params;
    const body = await req.json();
    let {
      sku, barcode, name, short_name, group_id, unit_id,
      specification, units_per_box, weight_per_box, volume_per_box,
      manage_lot, manage_expiry, min_stock, max_stock, is_active,
    } = body;

    // Trim (TC_ADD_004)
    if (sku) sku = sku.trim();
    if (barcode) barcode = barcode.trim();
    if (name) name = name.trim();
    if (short_name) short_name = short_name.trim();
    if (specification) specification = specification.trim();

    // Check exists
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Sản phẩm không tồn tại." },
        { status: 404 }
      );
    }

    // === Validate bắt buộc ===
    if (sku !== undefined && !sku) {
      return NextResponse.json(
        { success: false, error: "Mã SKU là bắt buộc.", field: "sku" },
        { status: 400 }
      );
    }
    if (name !== undefined && !name) {
      return NextResponse.json(
        { success: false, error: "Tên sản phẩm là bắt buộc.", field: "name" },
        { status: 400 }
      );
    }
    if (short_name !== undefined && !short_name) {
      return NextResponse.json(
        { success: false, error: "Tên rút gọn là bắt buộc.", field: "short_name" },
        { status: 400 }
      );
    }
    if (unit_id !== undefined && !unit_id) {
      return NextResponse.json(
        { success: false, error: "Đơn vị tính là bắt buộc.", field: "unit_id" },
        { status: 400 }
      );
    }
    // L2 fix: specification giờ optional (mô tả kích thước); units_per_box là field chính
    if (units_per_box !== undefined && units_per_box !== null && units_per_box !== "") {
      const n = parseInt(units_per_box, 10);
      if (isNaN(n) || n < 1) {
        return NextResponse.json(
          { success: false, error: "Số lẻ/thùng phải là số nguyên >= 1.", field: "units_per_box" },
          { status: 400 }
        );
      }
    }
    if (weight_per_box !== undefined && (weight_per_box == null || weight_per_box === "")) {
      return NextResponse.json(
        { success: false, error: "Trọng lượng / thùng là bắt buộc.", field: "weight_per_box" },
        { status: 400 }
      );
    }

    // === Validate số >= 0 (TC_ADD_009) ===
    if (weight_per_box !== undefined && weight_per_box !== null && weight_per_box !== "") {
      const wNum = parseFloat(weight_per_box);
      if (isNaN(wNum) || wNum < 0) {
        return NextResponse.json(
          { success: false, error: "Trọng lượng / thùng phải là số >= 0.", field: "weight_per_box" },
          { status: 400 }
        );
      }
    }
    if (volume_per_box !== undefined && volume_per_box !== null && volume_per_box !== "") {
      const vNum = parseFloat(volume_per_box);
      if (isNaN(vNum) || vNum < 0) {
        return NextResponse.json(
          { success: false, error: "Thể tích / thùng phải là số >= 0.", field: "volume_per_box" },
          { status: 400 }
        );
      }
    }

    // === Check SKU trùng (TC_MD_002) ===
    if (sku && sku !== existing.sku) {
      const dupSku = await prisma.product.findUnique({ where: { sku } });
      if (dupSku) {
        return NextResponse.json(
          { success: false, error: `Mã SKU "${sku}" đã tồn tại.`, field: "sku" },
          { status: 409 }
        );
      }
    }

    // === Check Barcode trùng (TC_MD_004) ===
    if (barcode && barcode !== existing.barcode) {
      const dupBarcode = await prisma.product.findUnique({ where: { barcode } });
      if (dupBarcode) {
        return NextResponse.json(
          { success: false, error: `Mã vạch "${barcode}" đã tồn tại.`, field: "barcode" },
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (sku !== undefined) updateData.sku = sku;
    if (barcode !== undefined) updateData.barcode = barcode || null;
    if (name !== undefined) updateData.name = name;
    if (short_name !== undefined) updateData.short_name = short_name || null;
    if (group_id !== undefined) updateData.group_id = group_id || null;
    if (unit_id !== undefined) updateData.unit_id = unit_id || null;
    if (specification !== undefined) updateData.specification = specification || null;
    if (units_per_box !== undefined && units_per_box !== null && units_per_box !== "") {
      updateData.units_per_box = parseInt(units_per_box, 10);
    }
    if (weight_per_box !== undefined) updateData.weight_per_box = weight_per_box != null && weight_per_box !== "" ? parseFloat(weight_per_box) : null;
    if (volume_per_box !== undefined) updateData.volume_per_box = volume_per_box != null && volume_per_box !== "" ? parseFloat(volume_per_box) : null;
    if (manage_lot !== undefined) updateData.manage_lot = manage_lot;
    if (manage_expiry !== undefined) updateData.manage_expiry = manage_expiry;
    if (min_stock !== undefined) updateData.min_stock = min_stock;
    if (max_stock !== undefined) updateData.max_stock = max_stock;
    if (is_active !== undefined) updateData.is_active = is_active;

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        group: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, symbol: true } },
      },
    });

    // Cascade: sync ItemCode link + recalc pallet line nếu weight_per_box hoặc units_per_box đổi
    let cascadeInfo: { lines_updated: number; pallets_updated: number; pallet_codes: string[] } | null = null;
    const weightChanged = weight_per_box !== undefined && Number(weight_per_box) !== Number(existing.weight_per_box);
    const unitsChanged = units_per_box !== undefined && parseInt(units_per_box, 10) !== existing.units_per_box;

    if (weightChanged || unitsChanged) {
      // Tìm tất cả ItemCode link Product này
      const linkedItemCodes = await prisma.itemCode.findMany({
        where: { product_id: id },
        select: { id: true },
      });

      // Sync field xuống ItemCode
      const itemCodeUpdate: Prisma.ItemCodeUpdateInput = {};
      if (weightChanged) {
        itemCodeUpdate.weight_per_box = weight_per_box != null && weight_per_box !== "" ? parseFloat(weight_per_box) : null;
      }
      if (unitsChanged) {
        itemCodeUpdate.units_per_box = parseInt(units_per_box, 10);
      }
      if (Object.keys(itemCodeUpdate).length > 0) {
        await prisma.itemCode.updateMany({
          where: { product_id: id },
          data: itemCodeUpdate as Prisma.ItemCodeUpdateManyMutationInput,
        });
      }

      // Recalc pallet line cho từng ItemCode link
      const totals: { lines_updated: number; pallets_updated: number; pallet_codes: string[] } = {
        lines_updated: 0, pallets_updated: 0, pallet_codes: [],
      };
      for (const ic of linkedItemCodes) {
        const r = await recalcPalletLinesByItemCode(prisma, ic.id, {
          new_weight_per_box: weightChanged && weight_per_box != null && weight_per_box !== "" ? parseFloat(weight_per_box) : undefined,
          new_units_per_box: unitsChanged ? parseInt(units_per_box, 10) : undefined,
        });
        totals.lines_updated += r.lines_updated;
        totals.pallets_updated += r.pallets_updated;
        totals.pallet_codes.push(...r.pallet_codes);
      }
      totals.pallet_codes = Array.from(new Set(totals.pallet_codes));
      cascadeInfo = totals;
    }

    return NextResponse.json({
      success: true,
      data: updated,
      cascade: cascadeInfo,
    });
  } catch (error) {
    if (error instanceof ApiError) return apiErrorResponse(error);
    console.error("PUT /api/products/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}

// DELETE: Xóa sản phẩm (TC_MD_016, TC_MD_017)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TC_MD_008 (lỗ hổng bảo mật): trước đây DELETE không verify token server-side
    // → gọi trực tiếp API (kể cả không cookie/không token) vẫn xoá được sản phẩm.
    // Yêu cầu đăng nhập + quyền Quản lý (super-role ADMIN/MANAGER/STAFF tự pass).
    await requirePermission(req, "item_code", "special");

    const { id } = await params;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Sản phẩm không tồn tại." },
        { status: 404 }
      );
    }

    // TODO: Kiểm tra ràng buộc (pallet, phiếu nhập) khi có module Pallet/Inbound
    // const palletCount = await prisma.palletItem.count({ where: { product_id: id } });
    // if (palletCount > 0) {
    //   return NextResponse.json(
    //     { success: false, error: "Không thể xóa. Sản phẩm đang có trong pallet/phiếu nhập." },
    //     { status: 409 }
    //   );
    // }

    await prisma.product.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Đã xóa sản phẩm." });
  } catch (error) {
    if (error instanceof ApiError) return apiErrorResponse(error);
    console.error("DELETE /api/products/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}
