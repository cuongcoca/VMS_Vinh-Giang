import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { guardPermission } from "@/lib/auth-server";

const PHONE_REGEX = /^(0|\+84)[35789]\d{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/inbound-temp/[id]/create-supplier
//
// Phase 4.2 — TC_STD_TMP_001 / _006: Kế toán có thể tạo NCC mới ngay từ
// trang chuẩn hóa phiếu tạm (khi phiếu chưa có NCC) và tự động link
// supplier_id vào phiếu. Tránh phải sang trang Quản lý NCC riêng.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(req, "inbound", "write");
  if (denied) return denied;
  try {
    const { id } = await params;
    const temp = await prisma.inboundTemp.findUnique({ where: { id } });
    if (!temp) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy phiếu tạm." },
        { status: 404 }
      );
    }
    if (temp.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: "Chỉ phiếu đang chờ chuẩn hóa mới thêm được NCC." },
        { status: 400 }
      );
    }
    if (temp.supplier_id) {
      return NextResponse.json(
        { success: false, error: "Phiếu đã có NCC. Vui lòng hủy liên kết trước khi tạo mới." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const code = (body.code as string)?.trim() || "";
    const name = (body.name as string)?.trim() || "";
    const tax_code = (body.tax_code as string)?.trim() || null;
    const contact_person = (body.contact_person as string)?.trim() || null;
    const phone = (body.phone as string)?.trim() || null;
    const email = (body.email as string)?.trim() || null;
    const address = (body.address as string)?.trim() || null;
    const note = (body.note as string)?.trim() || null;

    if (code.length < 2 || code.length > 40) {
      return NextResponse.json(
        { success: false, error: "Mã NCC phải từ 2 đến 40 ký tự." },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Tên NCC là bắt buộc." },
        { status: 400 }
      );
    }
    if (phone && !PHONE_REGEX.test(phone)) {
      return NextResponse.json(
        { success: false, error: "Số điện thoại không hợp lệ." },
        { status: 400 }
      );
    }
    if (email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: "Email không hợp lệ." },
        { status: 400 }
      );
    }

    // Check trùng code/tax_code
    const dupCode = await prisma.supplier.findUnique({ where: { code } });
    if (dupCode) {
      return NextResponse.json(
        { success: false, error: `Mã NCC "${code}" đã tồn tại.` },
        { status: 409 }
      );
    }
    if (tax_code) {
      const dupTax = await prisma.supplier.findFirst({ where: { tax_code } });
      if (dupTax) {
        return NextResponse.json(
          { success: false, error: `MST "${tax_code}" đã tồn tại trong hệ thống (NCC ${dupTax.code}).` },
          { status: 409 }
        );
      }
    }

    // Transaction: tạo NCC + link vào phiếu tạm
    const result = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          code,
          name,
          tax_code,
          contact_person,
          phone,
          email,
          address,
          note,
          is_active: true,
        },
      });
      const updatedTemp = await tx.inboundTemp.update({
        where: { id },
        data: { supplier_id: supplier.id },
        include: { supplier: { select: { id: true, code: true, name: true } } },
      });
      return { supplier, temp: updatedTemp };
    });

    await logAudit(req, {
      entity_type: "supplier",
      entity_id: result.supplier.id,
      action: "CREATE_SUPPLIER_FROM_TEMP",
      new_value: {
        code: result.supplier.code,
        name: result.supplier.name,
        from_inbound_temp_id: id,
        from_inbound_temp_code: temp.code,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: { supplier: result.supplier, temp: result.temp },
        message: `Đã tạo NCC ${result.supplier.code} và liên kết vào phiếu ${temp.code}.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/inbound-temp/[id]/create-supplier error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tạo NCC." },
      { status: 500 }
    );
  }
}
