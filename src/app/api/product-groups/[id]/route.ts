import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

// GET: Chi tiết nhóm hàng
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const group = await prisma.productGroup.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        is_active: true,
        created_at: true,
        _count: { select: { products: true, itemCodes: true } },
      },
    });

    if (!group) {
      return NextResponse.json(
        { success: false, error: "Nhóm hàng không tồn tại." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: group });
  } catch (error) {
    console.error("GET /api/product-groups/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}

// PUT: Cập nhật nhóm hàng
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, is_active } = body;

    // Check tồn tại
    const existing = await prisma.productGroup.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Nhóm hàng không tồn tại." },
        { status: 404 }
      );
    }

    // Validate tên
    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json(
        { success: false, error: "Tên nhóm hàng không được để trống." },
        { status: 400 }
      );
    }

    // Check trùng tên (trừ chính nó)
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.productGroup.findFirst({
        where: { name: name.trim(), is_active: true, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: `Nhóm hàng "${name.trim()}" đã tồn tại.` },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.productGroup.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(is_active !== undefined && { is_active }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /api/product-groups/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}

// DELETE: Xóa nhóm hàng (soft-delete: set is_active = false)
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const group = await prisma.productGroup.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true, itemCodes: true } },
      },
    });

    if (!group) {
      return NextResponse.json(
        { success: false, error: "Nhóm hàng không tồn tại." },
        { status: 404 }
      );
    }

    // Check đang sử dụng
    const totalUsed = group._count.products + group._count.itemCodes;
    if (totalUsed > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Không thể xóa — nhóm "${group.name}" đang được sử dụng bởi ${group._count.products} sản phẩm và ${group._count.itemCodes} mã hàng.`,
        },
        { status: 400 }
      );
    }

    // Soft delete
    await prisma.productGroup.update({
      where: { id },
      data: { is_active: false },
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("DELETE /api/product-groups/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}
