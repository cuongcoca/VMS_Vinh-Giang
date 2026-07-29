import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { notifyByRoles } from "@/lib/notifications";
import { requirePermission, apiErrorResponse } from "@/lib/auth-server";
import { buildUserIdentitySet, assertNotAccount } from "@/lib/item-code-guard";
import { warehouseDateParts } from "@/lib/warehouse-date";

// Regex mã hàng — đồng bộ với POST /api/item-codes (chặn ký tự lạ, kể cả '@').
const ITEM_CODE_RE = /^[A-Za-z0-9\-_./]+$/;

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

    // WVG-63: nạp danh tính tài khoản 1 lần để chặn account lọt thành mã hàng.
    // (Chỉ cần khi có dòng tạo mã tạm — nhưng users nhỏ nên nạp luôn cho gọn.)
    const needAccountGuard = lines.some(
      (l: ConfirmLine) => l.create_temp_code && !l.item_code_id
    );
    const userIdentitySet = needAccountGuard
      ? buildUserIdentitySet(
          await prisma.user.findMany({
            select: { email: true, phone: true, username: true, full_name: true },
          })
        )
      : new Set<string>();

    // Xử lý từng dòng: tạo ItemCode tạm nếu cần
    const processedLines: {
      item_code_id: string;
      qty_expected: number;
      lot?: string;
      expiry_date?: string;
    }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line: ConfirmLine = lines[i];

      // Validate qty
      if (!line.qty_expected || Number(line.qty_expected) <= 0) {
        return NextResponse.json(
          { success: false, error: `Dòng ${i + 1}: Số lượng dự kiến phải > 0.` },
          { status: 400 }
        );
      }

      let itemCodeId = line.item_code_id;

      // Nếu create_temp_code = true và chưa có item_code_id → tạo ItemCode tạm
      if (line.create_temp_code && !itemCodeId) {
        const tempCode = line.excel_code?.trim();
        const tempName = line.excel_name?.trim();

        if (!tempCode) {
          return NextResponse.json(
            { success: false, error: `Dòng ${i + 1}: Cần excel_code để tạo mã hàng tạm.` },
            { status: 400 }
          );
        }

        // WVG-63: chặn ký tự lạ + dữ liệu tài khoản (email/SĐT/trùng account)
        // để account không lọt thành mã hàng khi import nhầm file/sheet.
        if (!ITEM_CODE_RE.test(tempCode)) {
          return NextResponse.json(
            { success: false, error: `Dòng ${i + 1}: Mã hàng "${tempCode}" chứa ký tự không hợp lệ (chỉ chữ, số, - _ . /).` },
            { status: 400 }
          );
        }
        const codeAcctErr = assertNotAccount(tempCode, userIdentitySet, "Mã hàng");
        if (codeAcctErr) {
          return NextResponse.json(
            { success: false, error: `Dòng ${i + 1}: ${codeAcctErr}` },
            { status: 400 }
          );
        }
        const nameAcctErr = assertNotAccount(tempName, userIdentitySet, "Tên hàng");
        if (nameAcctErr) {
          return NextResponse.json(
            { success: false, error: `Dòng ${i + 1}: ${nameAcctErr}` },
            { status: 400 }
          );
        }

        // Kiểm tra đã tồn tại chưa (tránh trùng code)
        const existing = await prisma.itemCode.findUnique({
          where: { code: tempCode },
        });

        if (existing) {
          // Nếu đã tồn tại → dùng luôn
          itemCodeId = existing.id;
        } else {
          // Tạo ItemCode tạm với status = 'pending' — GHI created_by để truy vết.
          const tempItem = await prisma.itemCode.create({
            data: {
              code: tempCode,
              short_name: tempName || tempCode,
              status: "pending",
              note: "Tạo tự động từ import Excel",
              created_by: userId,
            },
          });
          itemCodeId = tempItem.id;
        }
      }

      // Kiểm tra item_code_id cuối cùng
      if (!itemCodeId) {
        return NextResponse.json(
          { success: false, error: `Dòng ${i + 1}: Thiếu mã hàng (item_code_id hoặc create_temp_code).` },
          { status: 400 }
        );
      }

      // Xác minh item_code tồn tại
      const itemCode = await prisma.itemCode.findUnique({ where: { id: itemCodeId } });
      if (!itemCode) {
        return NextResponse.json(
          { success: false, error: `Dòng ${i + 1}: Mã hàng không tồn tại (id: ${itemCodeId}).` },
          { status: 400 }
        );
      }

      processedLines.push({
        item_code_id: itemCodeId,
        qty_expected: Number(line.qty_expected),
        lot: line.lot,
        expiry_date: line.expiry_date,
      });
    }

    // Sinh mã phiếu
    const { code, codeYear, codeSeq } = await generateInboundCode();

    // Tạo phiếu nhập + dòng hàng
    const inbound = await prisma.inboundRequest.create({
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
        lines: {
          create: processedLines.map((pl) => ({
            item_code_id: pl.item_code_id,
            qty_expected: new Prisma.Decimal(pl.qty_expected),
            lot: pl.lot?.trim() || null,
            expiry_date: pl.expiry_date ? new Date(pl.expiry_date) : null,
          })),
        },
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item_code: {
              select: {
                id: true,
                code: true,
                short_name: true,
                full_name: true,
                status: true,
              },
            },
          },
        },
      },
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
