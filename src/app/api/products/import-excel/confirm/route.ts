import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { guardPermission } from "@/lib/auth-server";

interface ProductImportItem {
  sku: string;
  barcode: string;
  name: string;
  short_name: string;
  group_name: string;
  unit_name: string;
  specification: string;
  weight_per_box: number | null;
  volume_per_box: number | null;
  manage_lot: boolean;
  manage_expiry: boolean;
  status: string;
}

export async function POST(req: NextRequest) {
  const denied = await guardPermission(req, "item_code", "write");
  if (denied) return denied;
  try {
    const body = await req.json();
    const { products } = body as { products: ProductImportItem[] };

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ success: false, error: "Không có danh sách sản phẩm để import." }, { status: 400 });
    }

    // Lọc bỏ dòng lỗi ERROR
    const validProducts = products.filter(p => p.sku && p.name && p.status !== "ERROR");

    if (validProducts.length === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy sản phẩm hợp lệ để import." }, { status: 400 });
    }

    let successCount = 0;

    // Chạy tuần tự trong transaction để an toàn dữ liệu và đồng bộ
    await prisma.$transaction(async (tx) => {
      for (const p of validProducts) {
        // 1. Xử lý nhóm sản phẩm (Group)
        let groupId: string | null = null;
        if (p.group_name?.trim()) {
          const groupNameNormalized = p.group_name.trim();
          
          // Tìm xem group đã tồn tại chưa
          const existingGroup = await tx.productGroup.findUnique({
            where: { name: groupNameNormalized }
          });
          
          if (existingGroup) {
            groupId = existingGroup.id;
          } else {
            // Tạo mới group
            const newGroup = await tx.productGroup.create({
              data: {
                name: groupNameNormalized,
                description: "Tự tạo tự động từ import Excel sản phẩm"
              }
            });
            groupId = newGroup.id;
          }
        }

        // 2. Xử lý Đơn vị tính (Unit)
        let unitId: string | null = null;
        if (p.unit_name?.trim()) {
          const unitNameNormalized = p.unit_name.trim();
          
          // Tìm xem ĐVT đã tồn tại chưa
          const existingUnit = await tx.unitOfMeasure.findUnique({
            where: { name: unitNameNormalized }
          });
          
          if (existingUnit) {
            unitId = existingUnit.id;
          } else {
            // Tạo mới ĐVT
            const newUnit = await tx.unitOfMeasure.create({
              data: {
                name: unitNameNormalized,
                symbol: unitNameNormalized.substring(0, 10)
              }
            });
            unitId = newUnit.id;
          }
        }

        // 3. Upsert sản phẩm
        const barcodeVal = p.barcode?.trim() || null;
        
        // Kiểm tra barcode trùng ở sản phẩm khác để tránh crash Unique constraint
        let finalBarcode: string | null = barcodeVal;
        if (barcodeVal) {
          const barcodeConflict = await tx.product.findFirst({
            where: {
              barcode: barcodeVal,
              sku: { not: p.sku.trim() } // Trùng với sku khác
            }
          });
          if (barcodeConflict) {
            console.warn(`Cảnh báo: Barcode "${barcodeVal}" bị trùng với sản phẩm khác. Sẽ gán null cho sản phẩm SKU "${p.sku}".`);
            finalBarcode = null;
          }
        }

        const upsertedProduct = await tx.product.upsert({
          where: { sku: p.sku.trim() },
          update: {
            name: p.name.trim(),
            barcode: finalBarcode,
            short_name: p.short_name?.trim() || null,
            group_id: groupId,
            unit_id: unitId,
            specification: p.specification?.trim() || null,
            weight_per_box: p.weight_per_box !== null ? new Prisma.Decimal(p.weight_per_box) : null,
            volume_per_box: p.volume_per_box !== null ? new Prisma.Decimal(p.volume_per_box) : null,
            manage_lot: p.manage_lot,
            manage_expiry: p.manage_expiry,
          },
          create: {
            sku: p.sku.trim(),
            name: p.name.trim(),
            barcode: finalBarcode,
            short_name: p.short_name?.trim() || null,
            group_id: groupId,
            unit_id: unitId,
            specification: p.specification?.trim() || null,
            weight_per_box: p.weight_per_box !== null ? new Prisma.Decimal(p.weight_per_box) : null,
            volume_per_box: p.volume_per_box !== null ? new Prisma.Decimal(p.volume_per_box) : null,
            manage_lot: p.manage_lot,
            manage_expiry: p.manage_expiry,
            is_active: true
          }
        });

        // Ghi Audit log — dùng UUID id từ upsert, không dùng SKU string
        await tx.auditLog.create({
          data: {
            entity_type: "product",
            entity_id: upsertedProduct.id,
            action: p.status === "WARNING" ? "UPDATE_BY_IMPORT" : "CREATE_BY_IMPORT",
            old_value: (p.status === "WARNING" ? { sku: p.sku } : Prisma.DbNull) as Prisma.InputJsonValue,
            new_value: { sku: p.sku, name: p.name, barcode: finalBarcode } as Prisma.InputJsonValue,
            reason: "Import hàng loạt từ Excel",
          }
        });

        successCount++;
      }
    });

    return NextResponse.json({
      success: true,
      message: `Đã import/cập nhật thành công ${successCount} sản phẩm.`,
      count: successCount
    });
  } catch (error) {
    console.error("POST /api/products/import-excel/confirm error:", error);
    return NextResponse.json({ success: false, error: "Lỗi hệ thống khi ghi dữ liệu sản phẩm." }, { status: 500 });
  }
}
