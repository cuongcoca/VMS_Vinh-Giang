/**
 * Cascade recalc pallet_line.weight_kg + qty_unit + pallet.total_weight_kg
 * khi ItemCode thay đổi `weight_per_box` hoặc `units_per_box`.
 *
 * Chỉ recalc các pallet ở status ACTIVE (chưa chốt sổ):
 *   EMPTY, COUNTING, CONFIRMED, IN_STORAGE, IN_STAGING
 * Không đụng RELEASED / CANCELLED (đã đóng sổ kế toán).
 */
import { Prisma, PrismaClient } from "@prisma/client";

const ACTIVE_PALLET_STATUSES = [
  "EMPTY",
  "COUNTING",
  "CONFIRMED",
  "IN_STORAGE",
  "IN_STAGING",
] as const;

export type RecalcResult = {
  lines_updated: number;
  pallets_updated: number;
  pallet_codes: string[];
};

export async function recalcPalletLinesByItemCode(
  prisma: PrismaClient | Prisma.TransactionClient,
  itemCodeId: string,
  opts: {
    new_weight_per_box?: number | null;
    new_units_per_box?: number;
  }
): Promise<RecalcResult> {
  const { new_weight_per_box, new_units_per_box } = opts;
  if (new_weight_per_box == null && new_units_per_box == null) {
    return { lines_updated: 0, pallets_updated: 0, pallet_codes: [] };
  }

  // Tìm tất cả pallet_line dùng item_code này + pallet status active
  const lines = await prisma.palletLine.findMany({
    where: {
      item_code_id: itemCodeId,
      pallet: { status: { in: [...ACTIVE_PALLET_STATUSES] } },
    },
    select: {
      id: true,
      qty_box: true,
      pallet_id: true,
      pallet: { select: { id: true, code: true } },
    },
  });

  if (lines.length === 0) {
    return { lines_updated: 0, pallets_updated: 0, pallet_codes: [] };
  }

  // Update từng line
  for (const line of lines) {
    const data: Prisma.PalletLineUpdateInput = {};
    if (new_weight_per_box != null) {
      data.weight_kg = new Prisma.Decimal(Number(line.qty_box) * new_weight_per_box);
    }
    if (new_units_per_box != null) {
      data.qty_unit = new Prisma.Decimal(Number(line.qty_box) * new_units_per_box);
    }
    await prisma.palletLine.update({ where: { id: line.id }, data });
  }

  // Recalc total_weight_kg cho từng pallet bị ảnh hưởng
  const affectedPalletIds = Array.from(new Set(lines.map((l) => l.pallet_id)));
  for (const palletId of affectedPalletIds) {
    const agg = await prisma.palletLine.aggregate({
      where: { pallet_id: palletId },
      _sum: { weight_kg: true },
    });
    await prisma.pallet.update({
      where: { id: palletId },
      data: { total_weight_kg: agg._sum.weight_kg ?? new Prisma.Decimal(0) },
    });
  }

  const palletCodes = Array.from(new Set(lines.map((l) => l.pallet.code)));

  return {
    lines_updated: lines.length,
    pallets_updated: affectedPalletIds.length,
    pallet_codes: palletCodes,
  };
}
