import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

const PHONE_REGEX = /^(0|\+84)[35789]\d{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// PUT /api/suppliers/[id] — Cập nhật NCC
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(req, "supplier", "write");
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await req.json();
    const { code, name, tax_code, contact_person, phone, email, address, note, is_active } = body;

    // Check tồn tại
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy nhà cung cấp." },
        { status: 404 }
      );
    }

    // Validate phone
    if (phone && !PHONE_REGEX.test(phone)) {
      return NextResponse.json(
        { success: false, error: "Số điện thoại không hợp lệ (VD: 0912345678)." },
        { status: 400 }
      );
    }

    // Validate email
    if (email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: "Email không hợp lệ." },
        { status: 400 }
      );
    }

    // Check trùng mã NCC (nếu đổi code)
    if (code && code.trim().toUpperCase() !== existing.code) {
      const dup = await prisma.supplier.findFirst({
        where: { code: code.trim().toUpperCase(), is_active: true, id: { not: id } },
      });
      if (dup) {
        return NextResponse.json(
          { success: false, error: `Mã NCC "${code.trim()}" đã tồn tại.` },
          { status: 400 }
        );
      }
    }

    // Check trùng mã số thuế (nếu đổi)
    if (tax_code && tax_code.trim() !== existing.tax_code) {
      const dupTax = await prisma.supplier.findFirst({
        where: { tax_code: tax_code.trim(), is_active: true, id: { not: id } },
      });
      if (dupTax) {
        return NextResponse.json(
          { success: false, error: `Mã số thuế "${tax_code.trim()}" đã tồn tại.` },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        ...(code !== undefined && { code: code.trim().toUpperCase() }),
        ...(name !== undefined && { name: name.trim() }),
        ...(tax_code !== undefined && { tax_code: tax_code?.trim() || null }),
        ...(contact_person !== undefined && { contact_person: contact_person?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(note !== undefined && { note: note?.trim() || null }),
        ...(is_active !== undefined && { is_active }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /api/suppliers/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi cập nhật nhà cung cấp." },
      { status: 500 }
    );
  }
}

// DELETE /api/suppliers/[id] — Soft-delete NCC
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(req, "supplier", "write");
  if (denied) return denied;
  try {
    const { id } = await params;

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing || !existing.is_active) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy nhà cung cấp." },
        { status: 404 }
      );
    }

    // TC_SUP_007 / TC_SUP_024: chặn xóa NCC đang có phiếu nhập liên kết.
    // (Trước đây đoạn check này bị comment → xóa NCC có phiếu nhập vẫn thành công.)
    const inboundCount = await prisma.inboundRequest.count({ where: { supplier_id: id } });
    if (inboundCount > 0) {
      return NextResponse.json(
        { success: false, error: `NCC đang có ${inboundCount} phiếu nhập — không thể xóa.` },
        { status: 400 }
      );
    }

    await prisma.supplier.update({
      where: { id },
      data: { is_active: false },
    });

    return NextResponse.json({ success: true, message: "Đã xóa nhà cung cấp." });
  } catch (error) {
    console.error("DELETE /api/suppliers/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi xóa nhà cung cấp." },
      { status: 500 }
    );
  }
}
