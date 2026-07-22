import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PHONE_REGEX = /^(0|\+84)[35789]\d{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/suppliers — Danh sách + tìm kiếm
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";

    const where: Record<string, unknown> = { is_active: true };
    if (q) {
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { tax_code: { contains: q, mode: "insensitive" } },
        { contact_person: { contains: q, mode: "insensitive" } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { code: "asc" },
      // TC_SUP_001: màn Quản lý NCC cần cột "Số phiếu nhập" → đếm InboundRequest của NCC.
      include: { _count: { select: { inboundRequests: true } } },
    });

    return NextResponse.json({ success: true, data: suppliers });
  } catch (error) {
    console.error("GET /api/suppliers error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tải danh sách nhà cung cấp." },
      { status: 500 }
    );
  }
}

// POST /api/suppliers — Tạo mới NCC
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, name, tax_code, contact_person, phone, email, address, note } = body;

    // Validate bắt buộc
    if (!code || typeof code !== "string" || code.trim().length < 2 || code.trim().length > 40) {
      return NextResponse.json(
        { success: false, error: "Mã NCC phải từ 2 đến 40 ký tự." },
        { status: 400 }
      );
    }
    if (!name || typeof name !== "string" || name.trim().length < 1) {
      return NextResponse.json(
        { success: false, error: "Tên NCC là bắt buộc." },
        { status: 400 }
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

    // Check trùng mã NCC
    const existingCode = await prisma.supplier.findFirst({
      where: { code: code.trim(), is_active: true },
    });
    if (existingCode) {
      return NextResponse.json(
        { success: false, error: `Mã NCC "${code.trim()}" đã tồn tại.` },
        { status: 400 }
      );
    }

    // Check trùng mã số thuế (nếu có)
    if (tax_code) {
      const existingTax = await prisma.supplier.findFirst({
        where: { tax_code: tax_code.trim(), is_active: true },
      });
      if (existingTax) {
        return NextResponse.json(
          { success: false, error: `Mã số thuế "${tax_code.trim()}" đã tồn tại.` },
          { status: 400 }
        );
      }
    }

    const supplier = await prisma.supplier.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        tax_code: tax_code?.trim() || null,
        contact_person: contact_person?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        note: note?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, data: supplier });
  } catch (error) {
    console.error("POST /api/suppliers error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tạo nhà cung cấp." },
      { status: 500 }
    );
  }
}
