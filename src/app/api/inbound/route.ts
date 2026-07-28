import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { notifyByRoles } from "@/lib/notifications";
import { getRequestActor, logAudit } from "@/lib/audit";
import { CODE_PREFIX, formatYearlyCode } from "@/lib/codegen";
import { guardPermission } from "@/lib/auth-server";

// Helper: Sinh mã phiếu nhập PHN-{YYYY}-{SSSS} (sequential per year)
// Prefix theo CT-1 mockup wms_mockups_4.html v3.0.
async function generateInboundCode(): Promise<{ code: string; codeYear: number; codeSeq: number }> {
  const year = new Date().getFullYear();
  const maxSeq = await prisma.inboundRequest.aggregate({
    where: { code_year: year },
    _max: { code_seq: true },
  });
  const nextSeq = (maxSeq._max.code_seq ?? 0) + 1;
  const code = formatYearlyCode(CODE_PREFIX.INBOUND_REQUEST, year, nextSeq);
  return { code, codeYear: year, codeSeq: nextSeq };
}

// GET /api/inbound — Danh sách phiếu nhập kho + tìm kiếm + lọc + KPIs
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "inbound", "read");
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "";
    const supplierId = searchParams.get("supplier_id") || "";
    const hasDiscrepancy = searchParams.get("has_discrepancy") === "true";
    // Phase 3.1 (BUG_REPORT UC-PAL-01 row 46): filter phiếu chưa được gán pallet
    // ?has_pallet=false → chỉ trả phiếu KHÔNG có pallet liên kết (loại trừ pallet CANCELLED).
    const hasPalletParam = searchParams.get("has_pallet");
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (supplierId) where.supplier_id = supplierId;

    if (hasPalletParam === "false") {
      where.pallets = { none: { status: { not: "CANCELLED" } } };
    } else if (hasPalletParam === "true") {
      where.pallets = { some: { status: { not: "CANCELLED" } } };
    }

    if (q) {
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { invoice_no: { contains: q, mode: "insensitive" } },
        { note: { contains: q, mode: "insensitive" } },
      ];
    }

    if (from || to) {
      const createdAtFilter: Record<string, Date> = {};
      if (from) createdAtFilter.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setUTCHours(23, 59, 59, 999);
        createdAtFilter.lte = toDate;
      }
      where.created_at = createdAtFilter;
    }

    // UC-IN-05: Filter phiếu có chênh lệch — line nào có qty_received != qty_expected
    if (hasDiscrepancy) {
      const discrepancyRows = await prisma.$queryRaw<{ inbound_request_id: string }[]>`
        SELECT DISTINCT inbound_request_id FROM inbound_lines
        WHERE qty_received IS NOT NULL AND qty_received <> qty_expected
      `;
      where.id = { in: discrepancyRows.map(r => r.inbound_request_id) };
    }

    const inbounds = await prisma.inboundRequest.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        _count: { select: { lines: true } },
      },
      take: 200,
    });

    // KPIs: Đếm theo trạng thái
    const statusGroups = await prisma.inboundRequest.groupBy({
      by: ["status"],
      _count: true,
    });
    const kpis: Record<string, number> = {};
    let total = 0;
    for (const g of statusGroups) {
      kpis[g.status] = g._count;
      total += g._count;
    }
    kpis.TOTAL = total;

    // KPI: Số phiếu có chênh lệch
    const discrepancyCount = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT inbound_request_id) AS count FROM inbound_lines
      WHERE qty_received IS NOT NULL AND qty_received <> qty_expected
    `;
    kpis.HAS_DISCREPANCY = Number(discrepancyCount[0]?.count ?? 0);

    return NextResponse.json({ success: true, data: inbounds, kpis });
  } catch (error) {
    console.error("GET /api/inbound error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tải danh sách phiếu nhập kho." },
      { status: 500 }
    );
  }
}

// POST /api/inbound — Tạo phiếu nhập kho mới (tự sinh mã PHN-YYYY-SSSS)
// UC-IN-01: hỗ trợ thêm import_type, warehouse, order_date, prep_zone_ready, source
export async function POST(req: NextRequest) {
  const denied = await guardPermission(req, "inbound", "write");
  if (denied) return denied;
  try {
    const body = await req.json();
    const {
      supplier_id,
      expected_date,
      order_date,
      invoice_no,
      import_type,
      warehouse,
      source,
      prep_zone_ready,
      note,
      lines,
    } = body;

    // UC-IN-01: Số hoá đơn bắt buộc khi kế toán lập phiếu nhập.
    if (!invoice_no || !String(invoice_no).trim()) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập Số hoá đơn." },
        { status: 400 }
      );
    }

    // Validate supplier_id (nếu có)
    if (supplier_id) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplier_id },
      });
      if (!supplier || !supplier.is_active) {
        return NextResponse.json(
          { success: false, error: "Nhà cung cấp không tồn tại hoặc ngừng hoạt động." },
          { status: 400 }
        );
      }
    }

    // Validate import_type theo mockup: chỉ chấp nhận 2 giá trị
    const validImportTypes = ["Nhập từ NCC", "Hàng trả lại"];
    if (import_type && !validImportTypes.includes(import_type)) {
      return NextResponse.json(
        { success: false, error: `Loại nhập không hợp lệ. Chỉ chấp nhận: ${validImportTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate lines (nếu có)
    if (lines && Array.isArray(lines) && lines.length > 0) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.item_code_id) {
          return NextResponse.json(
            { success: false, error: `Dòng ${i + 1}: Phải chọn mã hàng.` },
            { status: 400 }
          );
        }
        // Hỗ trợ cả tên field `qty_expected` (chuẩn) và `expected_qty` (legacy UI)
        const qty = Number(line.qty_expected ?? line.expected_qty ?? 0);
        if (!qty || qty <= 0) {
          return NextResponse.json(
            { success: false, error: `Dòng ${i + 1}: Số lượng dự kiến phải > 0.` },
            { status: 400 }
          );
        }
        const itemCode = await prisma.itemCode.findUnique({
          where: { id: line.item_code_id },
        });
        if (!itemCode) {
          return NextResponse.json(
            { success: false, error: `Dòng ${i + 1}: Mã hàng không tồn tại.` },
            { status: 400 }
          );
        }
      }
    }

    // Sinh mã phiếu
    const { code, codeYear, codeSeq } = await generateInboundCode();

    const inbound = await prisma.inboundRequest.create({
      data: {
        code,
        code_year: codeYear,
        code_seq: codeSeq,
        status: "DRAFT",
        supplier_id: supplier_id || null,
        expected_date: expected_date ? new Date(expected_date) : null,
        order_date: order_date ? new Date(order_date) : null,
        invoice_no: String(invoice_no).trim(),
        import_type: import_type || "Nhập từ NCC",
        warehouse: warehouse || null,
        source: source || "MANUAL",
        prep_zone_ready: prep_zone_ready === true,
        note: note?.trim() || null,
        ...(lines && Array.isArray(lines) && lines.length > 0
          ? {
              lines: {
                create: lines.map((line: Record<string, unknown>) => ({
                  item_code_id: line.item_code_id as string,
                  qty_expected: new Prisma.Decimal(
                    Number(line.qty_expected ?? line.expected_qty)
                  ),
                  lot: (line.lot as string)?.trim() || null,
                  expiry_date: line.expiry_date ? new Date(line.expiry_date as string) : null,
                  note: (line.note as string)?.trim() || null,
                })),
              },
            }
          : {}),
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item_code: {
              select: { id: true, code: true, short_name: true, full_name: true },
            },
          },
        },
      },
    });

    // Phase 7.2 — TC_IN_REQ_027/_028: notify all THU_KHO khi Kế toán tạo
    // phiếu YC nhập. Không await fire-and-forget — không block response.
    const actor = getRequestActor(req);
    notifyByRoles(["THU_KHO"], {
      type: "INBOUND_REQUEST_CREATED",
      title: `Phiếu nhập mới: ${inbound.code}`,
      body: inbound.supplier?.name
        ? `${inbound.supplier.name} — ${inbound.lines.length} dòng hàng. Sẵn sàng tiếp nhận.`
        : `${inbound.lines.length} dòng hàng. Sẵn sàng tiếp nhận.`,
      entity_type: "inbound_request",
      entity_id: inbound.id,
      link_url: `/thukho/inbound/${inbound.id}`,
    }).catch((err) => console.error("notifyByRoles INBOUND_REQUEST_CREATED:", err));

    await logAudit(req, {
      entity_type: "inbound_request",
      entity_id: inbound.id,
      action: "CREATE_INBOUND",
      new_value: {
        code: inbound.code,
        supplier_id: inbound.supplier_id,
        line_count: inbound.lines.length,
        created_by: actor.userId,
      },
    });

    return NextResponse.json({ success: true, data: inbound }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/inbound error:", error);
    if (error instanceof Error && error.message?.includes("Unique constraint")) {
      return NextResponse.json(
        { success: false, error: "Mã phiếu nhập bị trùng — vui lòng thử lại." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Lỗi khi tạo phiếu nhập kho." },
      { status: 500 }
    );
  }
}
