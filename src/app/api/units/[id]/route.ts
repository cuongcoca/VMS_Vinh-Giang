import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

interface Params {
  params: Promise<{ id: string }>;
}

// GET: Chi tiết đơn vị tính
export async function GET(request: NextRequest, { params }: Params) {
  const denied = await guardPermission(request, "unit", "read");
  if (denied) return denied;
  try {
    const { id } = await params;
    const unit = await prisma.unitOfMeasure.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        symbol: true,
        is_active: true,
        created_at: true,
        _count: { select: { products: true, itemCodes: true } },
      },
    });

    if (!unit) {
      return NextResponse.json(
        { success: false, error: "Đơn vị tính không tồn tại." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: unit });
  } catch (error) {
    console.error("GET /api/units/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}

// PUT: Cập nhật đơn vị tính
export async function PUT(request: NextRequest, { params }: Params) {
  const denied = await guardPermission(request, "unit", "write");
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, symbol, is_active } = body;

    // Check tồn tại
    const existing = await prisma.unitOfMeasure.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Đơn vị tính không tồn tại." },
        { status: 404 }
      );
    }

    // Validate tên
    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json(
        { success: false, error: "Tên đơn vị tính không được để trống." },
        { status: 400 }
      );
    }

    // Check trùng tên (trừ chính nó)
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.unitOfMeasure.findFirst({
        where: { name: name.trim(), is_active: true, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: `Đơn vị tính "${name.trim()}" đã tồn tại.` },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.unitOfMeasure.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(symbol !== undefined && { symbol: symbol?.trim() || null }),
        ...(is_active !== undefined && { is_active }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /api/units/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}

// DELETE: Xóa đơn vị tính (soft-delete hoặc check in-use)
export async function DELETE(request: NextRequest, { params }: Params) {
  const denied = await guardPermission(request, "unit", "write");
  if (denied) return denied;
  try {
    const { id } = await params;

    const unit = await prisma.unitOfMeasure.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true, itemCodes: true } },
      },
    });

    if (!unit) {
      return NextResponse.json(
        { success: false, error: "Đơn vị tính không tồn tại." },
        { status: 404 }
      );
    }

    // Check đang sử dụng (giống logic service gốc: kiểm tra SP và SKUs/Mã hàng)
    const totalUsed = unit._count.products + unit._count.itemCodes;
    if (totalUsed > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Đơn vị tính đang được sử dụng (${unit._count.products} sản phẩm, ${unit._count.itemCodes} mã hàng).`,
        },
        { status: 400 }
      );
    }

    // Soft delete bằng cách set is_active = false
    await prisma.unitOfMeasure.update({
      where: { id },
      data: { is_active: false },
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("DELETE /api/units/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}
