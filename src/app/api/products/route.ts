import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Danh sách sản phẩm (search, filter, sort, paging)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const groupId = url.searchParams.get("groupId") || "";
    const status = url.searchParams.get("status") || ""; // active, inactive
    const sortBy = url.searchParams.get("sortBy") || "created_at";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Build where conditions
    const where: Record<string, unknown> = {};

    // Search (TC_MD_001-004, TC_MD_007-008)
    if (search) {
      where.OR = [
        { sku: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { short_name: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter nhóm hàng (TC_MD_005)
    if (groupId) {
      where.group_id = groupId;
    }

    // Filter trạng thái (TC_MD_006)
    if (status === "active") {
      where.is_active = true;
    } else if (status === "inactive") {
      where.is_active = false;
    }

    // Validate sortBy
    const allowedSortFields = ["sku", "name", "created_at", "updated_at"];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "created_at";
    const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";

    // Query (TC_MD_009 — phân trang, TC_MD_010 — sorting)
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          group: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true, symbol: true } },
        },
        orderBy: { [safeSortBy]: safeSortOrder },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}

// POST: Thêm sản phẩm mới
export async function POST(req: Request) {
  try {
    const body = await req.json();
    let {
      sku, barcode, name, short_name, group_id, unit_id,
      specification, units_per_box, weight_per_box, volume_per_box,
      manage_lot, manage_expiry, min_stock, max_stock, is_active,
    } = body;

    // Trim tất cả trường text (TC_ADD_004)
    if (sku) sku = sku.trim();
    if (barcode) barcode = barcode.trim();
    if (name) name = name.trim();
    if (short_name) short_name = short_name.trim();
    if (specification) specification = specification.trim();

    // === Validate bắt buộc theo docx (6 trường *) ===
    // TC_ADD_005: SKU bắt buộc
    if (!sku) {
      return NextResponse.json(
        { success: false, error: "Mã SKU là bắt buộc.", field: "sku" },
        { status: 400 }
      );
    }
    // TC_ADD_006: Tên đầy đủ bắt buộc
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Tên sản phẩm là bắt buộc.", field: "name" },
        { status: 400 }
      );
    }
    // TC_ADD_006: Tên rút gọn bắt buộc (theo docx)
    if (!short_name) {
      return NextResponse.json(
        { success: false, error: "Tên rút gọn là bắt buộc.", field: "short_name" },
        { status: 400 }
      );
    }
    // TC_ADD_006: ĐVT bắt buộc (theo docx)
    if (!unit_id) {
      return NextResponse.json(
        { success: false, error: "Đơn vị tính là bắt buộc.", field: "unit_id" },
        { status: 400 }
      );
    }
    // Specification giờ optional (chỉ mô tả kích thước). units_per_box là field chính cho quy đổi.
    // Validate units_per_box (default 1 nếu không nhập)
    const unitsPerBoxNum = units_per_box != null && units_per_box !== "" ? parseInt(units_per_box, 10) : 1;
    if (isNaN(unitsPerBoxNum) || unitsPerBoxNum < 1) {
      return NextResponse.json(
        { success: false, error: "Số lẻ/thùng phải là số nguyên >= 1.", field: "units_per_box" },
        { status: 400 }
      );
    }
    // TC_ADD_006: Trọng lượng/thùng bắt buộc (theo docx)
    if (weight_per_box == null || weight_per_box === "") {
      return NextResponse.json(
        { success: false, error: "Trọng lượng / thùng là bắt buộc.", field: "weight_per_box" },
        { status: 400 }
      );
    }

    // Validate SKU format
    if (sku.length > 50) {
      return NextResponse.json(
        { success: false, error: "Mã SKU không được vượt quá 50 ký tự." },
        { status: 400 }
      );
    }

    // === Validate số >= 0 (TC_ADD_009, TC_ADD_010) ===
    const weightNum = parseFloat(weight_per_box);
    if (isNaN(weightNum) || weightNum < 0) {
      return NextResponse.json(
        { success: false, error: "Trọng lượng / thùng phải là số >= 0.", field: "weight_per_box" },
        { status: 400 }
      );
    }
    if (volume_per_box != null && volume_per_box !== "") {
      const volNum = parseFloat(volume_per_box);
      if (isNaN(volNum) || volNum < 0) {
        return NextResponse.json(
          { success: false, error: "Thể tích / thùng phải là số >= 0.", field: "volume_per_box" },
          { status: 400 }
        );
      }
    }

    // === Check SKU trùng (TC_ADD_008) ===
    const existingSku = await prisma.product.findUnique({
      where: { sku },
    });
    if (existingSku) {
      return NextResponse.json(
        { success: false, error: `Mã SKU "${sku}" đã tồn tại trong hệ thống.`, field: "sku" },
        { status: 409 }
      );
    }

    // === Check Barcode trùng (TC_ADD_008) ===
    if (barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode },
      });
      if (existingBarcode) {
        return NextResponse.json(
          { success: false, error: `Mã vạch "${barcode}" đã tồn tại trong hệ thống.`, field: "barcode" },
          { status: 409 }
        );
      }
    }

    // Create Product + auto-sync ItemCode (Phương án A)
    // Lý do: các module nghiệp vụ (inbound, pallet, FEFO, stage-out, kiểm kê, adjustments)
    // đều search trên bảng `item_codes`, KHÔNG search `products`. Nếu chỉ tạo Product
    // mà không tạo ItemCode tương ứng → SP không findable. Tạo cả 2 trong 1 transaction.
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sku,
          barcode: barcode || null,
          name,
          short_name: short_name || null,
          group_id: group_id || null,
          unit_id: unit_id || null,
          specification: specification || null,
          units_per_box: unitsPerBoxNum,
          weight_per_box: weight_per_box != null ? parseFloat(weight_per_box) : null,
          volume_per_box: volume_per_box != null && volume_per_box !== "" ? parseFloat(volume_per_box) : null,
          manage_lot: manage_lot || false,
          manage_expiry: manage_expiry || false,
          min_stock: min_stock || 0,
          max_stock: max_stock != null ? max_stock : null,
          // TC_ADD_007: lưu đúng trạng thái người dùng chọn (trước đây bỏ qua
          // field này → Prisma dùng @default(true) → SP mới luôn "Đang hoạt động").
          is_active: typeof is_active === "boolean" ? is_active : true,
        },
        include: {
          group: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true, symbol: true } },
        },
      });

      // Sync ItemCode: nếu đã tồn tại (code=sku) thì link product_id + nâng status; nếu chưa thì tạo mới.
      const existing = await tx.itemCode.findUnique({ where: { code: sku } });
      const itemCodeData = {
        short_name: short_name || name,
        full_name: name,
        unit_id: unit_id || null,
        specification: specification || null,
        units_per_box: unitsPerBoxNum,
        weight_per_box: product.weight_per_box,
        group_id: group_id || null,
        product_id: product.id,
        status: "standardized",
        standardized_at: new Date(),
      };

      const itemCode = existing
        ? await tx.itemCode.update({ where: { id: existing.id }, data: itemCodeData })
        : await tx.itemCode.create({ data: { code: sku, ...itemCodeData } });

      return { product, item_code: itemCode };
    });

    return NextResponse.json({ success: true, data: result.product, item_code: result.item_code }, { status: 201 });
  } catch (error) {
    console.error("POST /api/products error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
