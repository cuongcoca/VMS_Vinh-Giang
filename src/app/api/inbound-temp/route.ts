import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { CODE_PREFIX, formatYearlyCode } from "@/lib/codegen";
import { notifyByRoles } from "@/lib/notifications";
import { guardPermission } from "@/lib/auth-server";

// Helper: Sinh mã phiếu tạm PNT-{YYYY}-{SSSS}
// Prefix theo CT-1 mockup wms_mockups_4.html v3.0.
// Note: mockup mới muốn PNT-YYMMDD-NNN nhưng cần schema change `code_year → code_date`
// — defer Sprint B-2. Hiện giữ format YYYY-SSSS để tránh schema migration phức tạp.
async function generateTempCode(): Promise<{ code: string; codeYear: number; codeSeq: number }> {
  const year = new Date().getFullYear();
  const maxSeq = await prisma.inboundTemp.aggregate({
    where: { code_year: year },
    _max: { code_seq: true },
  });
  const nextSeq = (maxSeq._max.code_seq ?? 0) + 1;
  const code = formatYearlyCode(CODE_PREFIX.INBOUND_TEMP, year, nextSeq);
  return { code, codeYear: year, codeSeq: nextSeq };
}

// TC_TMP_IN_010: <input type="datetime-local"> gửi chuỗi "YYYY-MM-DDTHH:MM" không
// kèm timezone. Server chạy UTC nên new Date(chuỗi đó) hiểu là giờ UTC → lệch +7h
// khi hiển thị cho user VN. Coi chuỗi không-timezone là giờ Việt Nam (UTC+7).
// Chuỗi đã có Z hoặc offset (vd client gửi .toISOString()) thì giữ nguyên.
function parseVnDateTime(value: unknown): Date {
  if (value == null || value === "") return new Date();
  const s = String(value).trim();
  const bare = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2})?$/.exec(s);
  if (bare) {
    const withSeconds = bare[2] ? s : `${s}:00`;
    return new Date(`${withSeconds}+07:00`);
  }
  return new Date(s);
}

// GET /api/inbound-temp — Danh sách phiếu tạm + KPIs
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "inbound", "read");
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "";
    const supplierId = searchParams.get("supplier_id") || "";

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (supplierId) where.supplier_id = supplierId;
    if (q) {
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { note: { contains: q, mode: "insensitive" } },
      ];
    }

    const temps = await prisma.inboundTemp.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        _count: { select: { lines: true } },
      },
      take: 200,
    });

    const statusGroups = await prisma.inboundTemp.groupBy({
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

    return NextResponse.json({ success: true, data: temps, kpis });
  } catch (error) {
    console.error("GET /api/inbound-temp error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tải danh sách phiếu tạm." }, { status: 500 });
  }
}

// POST /api/inbound-temp — Tạo phiếu tạm mới
// UC-INTMP-01: hỗ trợ thêm source_type, delivered_by, received_at, reason, reason_detail, photo_urls
export async function POST(req: NextRequest) {
  const denied = await guardPermission(req, "inbound", "write");
  if (denied) return denied;
  try {
    const body = await req.json();
    const { supplier_id, note, lines, source_type, delivered_by, received_at, reason, reason_detail, photo_urls } = body;

    // TC_TMP_IN_003: các trường bắt buộc phải được validate ở server (không chỉ client),
    // tránh tạo phiếu tạm thiếu Nguồn hàng / Người giao / Lý do khi bỏ qua UI.
    if (!source_type) {
      return NextResponse.json({ success: false, error: "Vui lòng chọn nguồn hàng." }, { status: 400 });
    }
    if (!delivered_by || !String(delivered_by).trim()) {
      return NextResponse.json({ success: false, error: "Vui lòng nhập tên người giao." }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ success: false, error: "Vui lòng chọn lý do nhập đột xuất." }, { status: 400 });
    }

    if (supplier_id) {
      const supplier = await prisma.supplier.findUnique({ where: { id: supplier_id } });
      if (!supplier || !supplier.is_active) {
        return NextResponse.json({ success: false, error: "NCC không tồn tại hoặc ngừng hoạt động." }, { status: 400 });
      }
    }

    // Validate source_type theo mockup: SUPPLIER | RETURN | OTHER
    const validSourceTypes = ["SUPPLIER", "RETURN", "OTHER"];
    if (source_type && !validSourceTypes.includes(source_type)) {
      return NextResponse.json({ success: false, error: `Nguồn hàng không hợp lệ. Chỉ chấp nhận: ${validSourceTypes.join(", ")}` }, { status: 400 });
    }

    // Validate reason theo mockup
    const validReasons = ["EARLY", "NOT_READY", "UNNOTIFIED_RETURN", "NEW_SUPPLIER", "OTHER"];
    if (reason && !validReasons.includes(reason)) {
      return NextResponse.json({ success: false, error: `Lý do không hợp lệ. Chỉ chấp nhận: ${validReasons.join(", ")}` }, { status: 400 });
    }

    // reason_detail bắt buộc khi reason=OTHER
    if (reason === "OTHER" && !reason_detail?.trim()) {
      return NextResponse.json({ success: false, error: "Vui lòng điền chi tiết lý do khi chọn 'Khác'." }, { status: 400 });
    }

    const { code, codeYear, codeSeq } = await generateTempCode();

    const temp = await prisma.inboundTemp.create({
      data: {
        code,
        code_year: codeYear,
        code_seq: codeSeq,
        status: "PENDING",
        supplier_id: supplier_id || null,
        source_type: source_type || null,
        delivered_by: delivered_by?.trim() || null,
        received_at: parseVnDateTime(received_at),
        reason: reason || null,
        reason_detail: reason_detail?.trim() || null,
        photo_urls: Array.isArray(photo_urls) ? photo_urls.filter((u: unknown) => typeof u === "string" && (u as string).trim()) : [],
        note: note?.trim() || null,
        ...(lines && Array.isArray(lines) && lines.length > 0
          ? {
              lines: {
                create: lines.map((line: Record<string, unknown>) => ({
                  item_code_id: line.item_code_id as string,
                  qty_box: new Prisma.Decimal(Number(line.qty_box)),
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
        lines: { include: { item_code: { select: { id: true, code: true, short_name: true } } } },
      },
    });

    // Notify KE_TOAN khi thủ kho tạo phiếu tạm
    notifyByRoles(["KE_TOAN"], {
      type: "INBOUND_TEMP_CREATED",
      title: `Phiếu tạm mới: ${temp.code}`,
      body: temp.supplier?.name
        ? `Thủ kho tạo phiếu tạm ${temp.code} — NCC: ${temp.supplier.name}, ${temp.lines.length} dòng hàng.`
        : `Thủ kho tạo phiếu tạm ${temp.code} — ${temp.lines.length} dòng hàng.`,
      entity_type: "inbound_temp",
      entity_id: temp.id,
      link_url: `/ketoan/inbound-temp/${temp.id}`,
    }).catch((err) => console.error("notifyByRoles INBOUND_TEMP_CREATED:", err));

    return NextResponse.json({ success: true, data: temp }, { status: 201 });
  } catch (error) {
    console.error("POST /api/inbound-temp error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tạo phiếu tạm." }, { status: 500 });
  }
}
