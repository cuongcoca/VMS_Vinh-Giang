import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { notifyByRoles } from "@/lib/notifications";
import { requirePermission, apiErrorResponse } from "@/lib/auth-server";
import { buildUserIdentitySet } from "@/lib/item-code-guard";
import { prevalidateImportLines, type LinePlan } from "@/lib/import-item-validate";
import { warehouseDateParts } from "@/lib/warehouse-date";

// Helper: Sinh mã phiếu nhập PHN-{YYYY}-{SSSS}
async function generateInboundCode(): Promise<{ code: string; codeYear: number; codeSeq: number }> {
  // WVG-98: năm theo giờ kho GMT+7 (không lệch ở ranh giới năm gần nửa đêm VN).
  const year = warehouseDateParts().year;
  const maxSeq = await prisma.inboundRequest.aggregate({
    where: { code_year: year },
    _max: { code_seq: true },
  });
  const nextSeq = (maxSeq._max.code_seq ?? 0) + 1;
  const code = `PHN-${year}-${String(nextSeq).padStart(4, "0")}`;
  return { code, codeYear: year, codeSeq: nextSeq };
}

interface ConfirmLine {
  item_code_id?: string;
  excel_code?: string;
  excel_name?: string;
  qty_expected: number;
  lot?: string;
  expiry_date?: string;
  create_temp_code?: boolean;
}

// POST /api/inbound/import-excel/confirm — Xác nhận mapping & tạo phiếu nhập
export async function POST(req: NextRequest) {
  let userId: string;
  try {
    const ctx = await requirePermission(req, "inbound", "write");
    userId = ctx.user.id;
  } catch (e) {
    return apiErrorResponse(e);
  }
  try {
    const body = await req.json();
    const { supplier_id, expected_date, invoice_no, note, lines, import_type, warehouse } = body;

    // Validate lines bắt buộc
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { success: false, error: "Phải có ít nhất 1 dòng hàng." },
        { status: 400 }
      );
    }

    // UC-IN-01: Số hoá đơn bắt buộc khi kế toán lập phiếu nhập.
    if (!invoice_no || !String(invoice_no).trim()) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập Số hoá đơn." },
        { status: 400 }
      );
    }

    // Validate supplier (nếu có)
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

    // WVG-63: nạp danh tính tài khoản để chặn account lọt thành mã hàng.
    const userIdentitySet = buildUserIdentitySet(
      await prisma.user.findMany({
        select: { email: true, phone: true, username: true, full_name: true },
      })
    );

    // ── Giai đoạn A: PRE-VALIDATE TOÀN batch (KHÔNG ghi) — gom HẾT lỗi trả 1 lần ──
    const { errors, plan, tempCodes } = prevalidateImportLines(lines, userIdentitySet);

    // Kiểm tra tồn tại cho dòng đã map sẵn mã (đọc DB — vẫn TRƯỚC khi ghi).
    const mappedIds = [
      ...new Set(
        plan.filter((p): p is Extract<LinePlan, { kind: "mapped" }> => p.kind === "mapped").map((p) => p.item_code_id)
      ),
    ];
    if (mappedIds.length) {
      const found = await prisma.itemCode.findMany({ where: { id: { in: mappedIds } }, select: { id: true } });
      const foundSet = new Set(found.map((f) => f.id));
      lines.forEach((l: ConfirmLine, idx: number) => {
        if (l.item_code_id && !l.create_temp_code && !foundSet.has(l.item_code_id)) {
          errors.push(`Dòng ${idx + 1}: Mã hàng không tồn tại (id: ${l.item_code_id}).`);
        }
      });
    }

    // Có bất kỳ lỗi nào → trả 400 DUY NHẤT, KHÔNG tạo bất kỳ record nào.
    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: errors.length === 1 ? errors[0] : `${errors.length} lỗi cần sửa trước khi tạo phiếu: ${errors.join(" | ")}`,
          errors,
        },
        { status: 400 }
      );
    }

    // Sinh mã phiếu (đọc seq; trùng hiếm sẽ bắt ở unique 409 phía dưới).
    const { code, codeYear, codeSeq } = await generateInboundCode();

    // ── Giai đoạn B: 1 TRANSACTION — tạo mã tạm (dedupe) + phiếu + dòng, ALL-OR-NOTHING ──
    const inbound = await prisma.$transaction(async (tx) => {
      // Tạo/khớp mã tạm DISTINCT trong batch → map code → id (tránh trùng chính batch).
      const codeToId = new Map<string, string>();
      for (const tempCode of tempCodes) {
        const existing = await tx.itemCode.findUnique({ where: { code: tempCode } });
        if (existing) { codeToId.set(tempCode, existing.id); continue; }
        const p = plan.find((x): x is Extract<LinePlan, { kind: "temp" }> => x.kind === "temp" && x.temp_code === tempCode);
        const created = await tx.itemCode.create({
          data: {
            code: tempCode,
            short_name: p?.temp_name || tempCode,
            status: "pending",
            note: "Tạo tự động từ import Excel",
            created_by: userId,
          },
        });
        codeToId.set(tempCode, created.id);
      }

      const lineData = plan.map((p) => ({
        item_code_id: p.kind === "temp" ? codeToId.get(p.temp_code)! : p.item_code_id,
        qty_expected: new Prisma.Decimal(p.qty_expected),
        lot: p.lot?.trim() || null,
        expiry_date: p.expiry_date ? new Date(p.expiry_date) : null,
      }));

      return tx.inboundRequest.create({
        data: {
          code,
          code_year: codeYear,
          code_seq: codeSeq,
          status: "DRAFT",
          supplier_id: supplier_id || null,
          expected_date: expected_date ? new Date(expected_date) : null,
          invoice_no: String(invoice_no).trim(),
          import_type: import_type || null,
          warehouse: warehouse || null,
          note: note?.trim() || null,
          lines: { create: lineData },
        },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          lines: {
            include: {
              item_code: { select: { id: true, code: true, short_name: true, full_name: true, status: true } },
            },
          },
        },
      });
    });

    // Notify THU_KHO khi tạo phiếu nhập từ Excel
    notifyByRoles(["THU_KHO"], {
      type: "INBOUND_EXCEL_IMPORTED",
      title: `Phiếu nhập từ Excel: ${inbound.code}`,
      body: `Đã tạo phiếu nhập ${inbound.code} từ file Excel (${inbound.lines.length} dòng hàng).`,
      entity_type: "inbound_request",
      entity_id: inbound.id,
      link_url: `/thukho/inbound/${inbound.id}`,
    }).catch((err) => console.error("notifyByRoles INBOUND_EXCEL_IMPORTED:", err));

    return NextResponse.json({ success: true, data: inbound }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/inbound/import-excel/confirm error:", error);
    if (error instanceof Error && error.message?.includes("Unique constraint")) {
      return NextResponse.json(
        { success: false, error: "Mã phiếu nhập hoặc mã hàng bị trùng — vui lòng thử lại." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Lỗi khi tạo phiếu nhập từ Excel." },
      { status: 500 }
    );
  }
}
