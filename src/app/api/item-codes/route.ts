import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiErrorResponse } from "@/lib/auth-server";
import { validateSpecification } from "@/lib/spec-validate";
import { notifyByRoles } from "@/lib/notifications";

// GET: Danh sách mã hàng (search, filter status, paging, sort)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = (url.searchParams.get("search") || url.searchParams.get("q"))?.trim() || "";
    const status = url.searchParams.get("status") || ""; // pending, standardized
    const groupId = url.searchParams.get("groupId") || "";
    // UC-PAL-02: filter theo PHN → chỉ trả ItemCode thuộc InboundLine của phiếu đó.
    // Dùng khi thủ kho thêm dòng vào pallet đã link PHN — tránh chọn nhầm hàng từ phiếu khác.
    const inboundRequestId = url.searchParams.get("inbound_request_id") || "";
    // Hướng A: scope "open" → trả mã thuộc BẤT KỲ phiếu đang mở (PENDING/RECEIVING/RECONCILING),
    // kèm danh sách phiếu mở chứa mã đó (để màn thêm hàng chọn dòng thuộc phiếu nào).
    const inboundScope = url.searchParams.get("inbound_scope") || "";
    const sortBy = url.searchParams.get("sortBy") || "created_at";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
        { short_name: { contains: search, mode: "insensitive" } },
        { full_name: { contains: search, mode: "insensitive" } },
        // Cho phép search theo barcode EAN-13 (lưu ở products.barcode, join qua product_id)
        { product: { barcode: { contains: search, mode: "insensitive" } } },
        { product: { sku: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status === "pending" || status === "standardized") {
      where.status = status;
    }

    if (groupId) {
      where.group_id = groupId;
    }

    if (inboundRequestId) {
      // ItemCode phải có ít nhất 1 InboundLine thuộc phiếu này
      where.inboundLines = { some: { inbound_request_id: inboundRequestId } };
    } else if (inboundScope === "open") {
      // Mã thuộc bất kỳ phiếu đang mở (chưa chốt/hủy).
      where.inboundLines = {
        some: { inbound_request: { status: { in: ["PENDING", "RECEIVING", "RECONCILING"] } } },
      };
    }

    const allowedSortFields = ["code", "short_name", "created_at", "updated_at", "status"];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : "created_at";
    const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";

    const [items, total] = await Promise.all([
      prisma.itemCode.findMany({
        where,
        include: {
          unit: { select: { id: true, name: true, symbol: true } },
          group: { select: { id: true, name: true } },
          product: { select: { id: true, sku: true, name: true, barcode: true } },
          creator: { select: { id: true, full_name: true } },
          standardizer: { select: { id: true, full_name: true } },
        },
        orderBy: { [safeSortBy]: safeSortOrder },
        skip,
        take: limit,
      }),
      prisma.itemCode.count({ where }),
    ]);

    // Đếm thêm stats
    const [pendingCount, standardizedCount] = await Promise.all([
      prisma.itemCode.count({ where: { status: "pending" } }),
      prisma.itemCode.count({ where: { status: "standardized" } }),
    ]);

    // UC-PAL-02+ (fix 1 phiếu — nhiều pallet): khi lọc theo phiếu nhập, đính kèm
    // "còn lại theo phiếu" cho mỗi mã = tổng SL dự kiến của mã trong phiếu
    // − tổng đã lên các pallet (chưa hủy) của phiếu. Giúp màn thêm hàng vào pallet
    // gợi ý đúng số còn phải xếp, tránh nhập trùng/thiếu.
    let data: unknown[] = items;
    if (inboundRequestId) {
      const [expectedRows, palletRows] = await Promise.all([
        prisma.inboundLine.groupBy({
          by: ["item_code_id"],
          where: { inbound_request_id: inboundRequestId },
          _sum: { qty_expected: true },
        }),
        prisma.palletLine.groupBy({
          by: ["item_code_id"],
          where: {
            pallet: {
              inbound_request_id: inboundRequestId,
              status: { not: "CANCELLED" },
            },
          },
          _sum: { qty_box: true },
        }),
      ]);
      const expMap = new Map(
        expectedRows.map((r) => [r.item_code_id, Number(r._sum.qty_expected || 0)])
      );
      const palMap = new Map(
        palletRows.map((r) => [r.item_code_id, Number(r._sum.qty_box || 0)])
      );
      data = items.map((it) => {
        const exp = expMap.get(it.id) || 0;
        const onPallet = palMap.get(it.id) || 0;
        return {
          ...it,
          phn_qty_expected: exp,
          phn_qty_on_pallet: onPallet,
          phn_qty_remaining: exp - onPallet,
        };
      });
    } else if (inboundScope === "open" && items.length > 0) {
      // Hướng A: mỗi mã kèm danh sách phiếu ĐANG MỞ chứa nó, mỗi phiếu có
      // "còn lại" = tổng dự kiến của mã trong phiếu − tổng đã lên các dòng
      // gán về phiếu đó (theo dòng, không theo pallet gốc).
      const itemIds = items.map((it) => it.id);
      const [expectedRows, onLineRows] = await Promise.all([
        prisma.inboundLine.findMany({
          where: {
            item_code_id: { in: itemIds },
            inbound_request: { status: { in: ["PENDING", "RECEIVING", "RECONCILING"] } },
          },
          select: {
            item_code_id: true,
            qty_expected: true,
            inbound_request: { select: { id: true, code: true, invoice_no: true } },
          },
        }),
        prisma.palletLine.groupBy({
          by: ["item_code_id", "inbound_request_id"],
          where: {
            item_code_id: { in: itemIds },
            inbound_request_id: { not: null },
            pallet: { status: { not: "CANCELLED" } },
          },
          _sum: { qty_box: true },
        }),
      ]);
      // Map (item, phn) → đã lên
      const onLineMap = new Map<string, number>();
      for (const r of onLineRows) {
        onLineMap.set(`${r.item_code_id}|${r.inbound_request_id}`, Number(r._sum.qty_box || 0));
      }
      // Gom phiếu mở theo mã
      type OpenPhn = { id: string; code: string; invoice_no: string | null; qty_expected: number; qty_on_pallet: number; qty_remaining: number };
      const byItem = new Map<string, OpenPhn[]>();
      for (const row of expectedRows) {
        const phn = row.inbound_request;
        const exp = Number(row.qty_expected);
        const onPallet = onLineMap.get(`${row.item_code_id}|${phn.id}`) || 0;
        const list = byItem.get(row.item_code_id) || [];
        // Cùng mã có thể có nhiều dòng trong 1 phiếu → cộng dồn dự kiến.
        const existing = list.find((x) => x.id === phn.id);
        if (existing) {
          existing.qty_expected += exp;
          existing.qty_remaining = existing.qty_expected - existing.qty_on_pallet;
        } else {
          list.push({ id: phn.id, code: phn.code, invoice_no: phn.invoice_no, qty_expected: exp, qty_on_pallet: onPallet, qty_remaining: exp - onPallet });
          byItem.set(row.item_code_id, list);
        }
      }
      data = items.map((it) => ({ ...it, open_phns: byItem.get(it.id) || [] }));
    }

    return NextResponse.json({
      success: true,
      data,
      stats: { pending: pendingCount, standardized: standardizedCount, total: pendingCount + standardizedCount },
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/item-codes error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}

// POST: Tạo mã hàng mới (Thủ kho — TC_001_001 → TC_001_015)
export async function POST(req: Request) {
  try { await requireAuth(req); } catch (e) { return apiErrorResponse(e); }
  try {
    const body = await req.json();
    let { code, barcode, short_name, unit_id, specification, units_per_box, weight_per_box, photo_url, note } = body;

    // Trim (TC_001_008)
    if (code) code = code.trim();
    if (barcode) barcode = barcode.trim();
    if (short_name) short_name = short_name.trim();
    if (specification) specification = specification.trim();
    if (note) note = note.trim();

    // L2 fix: units_per_box validate (default = 1)
    const unitsPerBoxNum = units_per_box != null && units_per_box !== "" ? parseInt(units_per_box, 10) : 1;
    if (isNaN(unitsPerBoxNum) || unitsPerBoxNum < 1) {
      return NextResponse.json(
        { success: false, error: "Số lẻ/thùng phải là số nguyên >= 1.", field: "units_per_box" },
        { status: 400 }
      );
    }

    // === Validate bắt buộc ===
    // TC_001_002: `code` (Mã hàng theo chứng từ) KHÔNG bắt buộc cho luồng tạo nhanh của Thủ kho —
    // chỉ bắt buộc khi Kế toán chuẩn hóa. Nếu Thủ kho không nhập, hệ thống tự sinh TEMP-* để
    // thỏa NOT NULL + @unique trên schema; Kế toán đổi sang mã thật ở bước chuẩn hóa (PUT).
    if (!code) {
      const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14); // YYYYMMDDHHmmss
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      code = `TEMP-${ts}-${rand}`;
    }
    // TC_001_003: Tên rút gọn bắt buộc
    if (!short_name) {
      return NextResponse.json(
        { success: false, error: "Tên rút gọn là bắt buộc.", field: "short_name" },
        { status: 400 }
      );
    }
    // TC_001_004: ĐVT bắt buộc
    if (!unit_id) {
      return NextResponse.json(
        { success: false, error: "Đơn vị tính là bắt buộc.", field: "unit_id" },
        { status: 400 }
      );
    }
    // L2 fix: specification giờ optional (mô tả kích thước); units_per_box thay thế

    // TC_001_006: Validate ký tự đặc biệt mã hàng
    if (!/^[A-Za-z0-9\-_./]+$/.test(code)) {
      return NextResponse.json(
        { success: false, error: "Mã hàng chỉ được chứa chữ, số, dấu gạch ngang, gạch dưới, dấu chấm, dấu /.", field: "code" },
        { status: 400 }
      );
    }

    // TC_001_007: Max length
    if (code.length > 100) {
      return NextResponse.json(
        { success: false, error: "Mã hàng không vượt quá 100 ký tự.", field: "code" },
        { status: 400 }
      );
    }
    if (short_name.length > 100) {
      return NextResponse.json(
        { success: false, error: "Tên rút gọn không vượt quá 100 ký tự.", field: "short_name" },
        { status: 400 }
      );
    }

    // Validate trọng lượng >= 0
    if (weight_per_box != null && weight_per_box !== "") {
      const wNum = parseFloat(weight_per_box);
      if (isNaN(wNum) || wNum < 0) {
        return NextResponse.json(
          { success: false, error: "Trọng lượng / thùng phải là số >= 0.", field: "weight_per_box" },
          { status: 400 }
        );
      }
    }

    // TC_001_012: Quy cách không hợp lệ → chặn lưu (đồng bộ với validate phía UI)
    const specError = validateSpecification(specification);
    if (specError) {
      return NextResponse.json(
        { success: false, error: specError, field: "specification" },
        { status: 400 }
      );
    }

    // TC_001_005: Check trùng mã
    const existing = await prisma.itemCode.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Mã hàng "${code}" đã tồn tại trong hệ thống.`, field: "code" },
        { status: 409 }
      );
    }

    const itemCode = await prisma.itemCode.create({
      data: {
        code,
        barcode: barcode || null,
        short_name,
        unit_id: unit_id || null,
        specification: specification || null,
        units_per_box: unitsPerBoxNum,
        weight_per_box: weight_per_box != null && weight_per_box !== "" ? parseFloat(weight_per_box) : null,
        photo_url: photo_url || null,
        note: note || null,
        status: "pending",
      },
      include: {
        unit: { select: { id: true, name: true, symbol: true } },
        group: { select: { id: true, name: true } },
        creator: { select: { id: true, full_name: true } },
      },
    });

    // Notify KE_TOAN khi thủ kho tạo mã hàng (cần chuẩn hóa) — giữ tính năng Push của 42
    notifyByRoles(["KE_TOAN"], {
      type: "ITEM_CODE_CREATED",
      title: `Mã hàng mới: ${itemCode.code}`,
      body: `Thủ kho tạo mã hàng ${itemCode.code} (${itemCode.short_name}). Vui lòng chuẩn hóa.`,
      entity_type: "item_code",
      entity_id: itemCode.id,
      link_url: `/ketoan/item-codes/${itemCode.id}`,
    }).catch((err) => console.error("notifyByRoles ITEM_CODE_CREATED:", err));

    return NextResponse.json({ success: true, data: itemCode }, { status: 201 });
  } catch (error) {
    console.error("POST /api/item-codes error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
