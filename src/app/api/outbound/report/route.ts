import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

// GET /api/outbound/report — Báo cáo xuất kho theo kỳ
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "outbound", "read");
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const groupBy = searchParams.get("group_by") || "item"; // item | supplier

    // Query movements loại STAGE_OUT trong khoảng thời gian
    const where: Record<string, unknown> = { movement_type: "STAGE_OUT" };
    if (from || to) {
      where.performed_at = {};
      if (from) (where.performed_at as Record<string, unknown>).gte = new Date(from);
      if (to) (where.performed_at as Record<string, unknown>).lte = new Date(to + "T23:59:59");
    }

    const movements = await prisma.movement.findMany({
      where,
      include: {
        pallet: {
          include: {
            supplier: { select: { id: true, code: true, name: true } },
            lines: {
              include: { item_code: { select: { id: true, code: true, short_name: true, group: { select: { code: true, name: true } } } } },
            },
          },
        },
      },
      orderBy: { performed_at: "desc" },
    });

    // Aggregate
    if (groupBy === "supplier") {
      const supplierMap: Record<string, { supplier_id: string | null; supplier_name: string; total_pallets: number; total_qty_box: number; total_weight_kg: number }> = {};
      for (const m of movements) {
        const key = m.pallet.supplier_id || "none";
        if (!supplierMap[key]) {
          supplierMap[key] = {
            supplier_id: m.pallet.supplier_id,
            supplier_name: m.pallet.supplier?.name || "Không xác định",
            total_pallets: 0, total_qty_box: 0, total_weight_kg: 0,
          };
        }
        supplierMap[key].total_pallets += 1;
        supplierMap[key].total_weight_kg += Number(m.pallet.total_weight_kg);
        for (const line of m.pallet.lines) {
          supplierMap[key].total_qty_box += Number(line.qty_box);
        }
      }
      return NextResponse.json({ success: true, data: Object.values(supplierMap), total_movements: movements.length });
    } else {
      // Group by item
      const itemMap: Record<string, { item_code_id: string; item_code: string; item_name: string; group_code: string | null; group_name: string | null; total_qty_box: number; pallet_count: number }> = {};
      for (const m of movements) {
        for (const line of m.pallet.lines) {
          const key = line.item_code_id;
          if (!itemMap[key]) {
            itemMap[key] = {
              item_code_id: key,
              item_code: line.item_code.code,
              item_name: line.item_code.short_name,
              group_code: line.item_code.group?.code || null,
              group_name: line.item_code.group?.name || null,
              total_qty_box: 0, pallet_count: 0,
            };
          }
          itemMap[key].total_qty_box += Number(line.qty_box);
          itemMap[key].pallet_count += 1;
        }
      }
      return NextResponse.json({ success: true, data: Object.values(itemMap), total_movements: movements.length });
    }
  } catch (error) {
    console.error("GET /api/outbound/report error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tải báo cáo." }, { status: 500 });
  }
}
