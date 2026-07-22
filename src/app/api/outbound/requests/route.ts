import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { notifyByRoles } from "@/lib/notifications";

// Helper: sinh mã PYX-YYYY-NNNN
async function generateCode(): Promise<{ code: string; codeYear: number; codeSeq: number }> {
  const year = new Date().getFullYear();
  const maxSeq = await prisma.outboundRequest.aggregate({
    where: { code_year: year },
    _max: { code_seq: true },
  });
  const nextSeq = (maxSeq._max.code_seq ?? 0) + 1;
  return { code: `PYX-${year}-${String(nextSeq).padStart(4, "0")}`, codeYear: year, codeSeq: nextSeq };
}

// GET /api/outbound/requests — Danh sách phiếu PYX
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const q = searchParams.get("q") || "";

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { customer: { contains: q, mode: "insensitive" } },
        { note: { contains: q, mode: "insensitive" } },
      ];
    }

    const requests = await prisma.outboundRequest.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        _count: { select: { lines: true } },
        lines: { include: { item_code: { select: { code: true, short_name: true } } } },
      },
      take: 200,
    });

    const statusGroups = await prisma.outboundRequest.groupBy({ by: ["status"], _count: true });
    const kpis: Record<string, number> = {};
    let total = 0;
    for (const g of statusGroups) { kpis[g.status] = g._count; total += g._count; }
    kpis.TOTAL = total;

    return NextResponse.json({ success: true, data: requests, kpis });
  } catch (error) {
    console.error("GET /api/outbound/requests error:", error);
    return NextResponse.json({ success: false, error: "Lỗi tải danh sách phiếu PYX." }, { status: 500 });
  }
}

// POST /api/outbound/requests — Tạo phiếu PYX mới
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer, ship_date, note, lines } = body;

    if (!customer?.trim()) {
      return NextResponse.json({ success: false, error: "Thiếu tên khách hàng." }, { status: 400 });
    }
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ success: false, error: "Phiếu phải có ít nhất 1 dòng hàng." }, { status: 400 });
    }

    // Validate lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.item_code_id) {
        return NextResponse.json({ success: false, error: `Dòng ${i + 1}: thiếu mã hàng.` }, { status: 400 });
      }
      if (!line.qty_requested || Number(line.qty_requested) <= 0) {
        return NextResponse.json({ success: false, error: `Dòng ${i + 1}: SL yêu cầu phải > 0.` }, { status: 400 });
      }
    }

    const { code, codeYear, codeSeq } = await generateCode();

    const created = await prisma.outboundRequest.create({
      data: {
        code, code_year: codeYear, code_seq: codeSeq,
        status: "PENDING",
        customer: customer.trim(),
        ship_date: ship_date ? new Date(ship_date) : null,
        note: note?.trim() || null,
        lines: {
          create: lines.map((line: Record<string, unknown>) => ({
            item_code_id: line.item_code_id as string,
            pallet_id: (line.pallet_id as string) || null,
            qty_requested: new Prisma.Decimal(Number(line.qty_requested)),
            note: (line.note as string)?.trim() || null,
          })),
        },
      },
      include: { lines: { include: { item_code: { select: { code: true, short_name: true } } } } },
    });

    // Notify THU_KHO, XE_NANG khi tạo phiếu xuất
    notifyByRoles(["THU_KHO", "XE_NANG"], {
      type: "OUTBOUND_REQUEST_CREATED",
      title: `Phiếu xuất mới: ${created.code}`,
      body: `Phiếu xuất ${created.code} cho khách ${customer.trim()} (${created.lines.length} dòng hàng).`,
      entity_type: "outbound_request",
      entity_id: created.id,
      link_url: `/thukho/outbound/${created.id}`,
    }).catch((err) => console.error("notifyByRoles OUTBOUND_REQUEST_CREATED:", err));

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/outbound/requests error:", error);
    return NextResponse.json({ success: false, error: "Lỗi tạo phiếu PYX." }, { status: 500 });
  }
}
