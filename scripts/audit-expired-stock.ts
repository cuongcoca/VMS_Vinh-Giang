// WVG-239 — Reconciliation READ-ONLY: liệt kê các lô ĐÃ HẾT HẠN còn nằm trong tồn.
// Vì "blocked" tính động (không persist), reconciliation = báo cáo để ops xử lý tiêu
// huỷ qua quy trình Điều chỉnh (Adjustment DECREASE). KHÔNG ghi/sửa dữ liệu.
//
// Chạy (từ thư mục dự án): npx tsx scripts/audit-expired-stock.ts
import { prisma } from "../src/lib/prisma";
import { STOCK_PALLET_STATUSES } from "../src/lib/inventory-constants";
import { expiryCutoff } from "../src/lib/inventory-expiry";

async function main() {
  const cutoff = expiryCutoff();
  console.log(`WVG-239 — Lô hết hạn còn trong tồn (mốc < ${cutoff.toISOString().slice(0, 10)} giờ VN)\n`);

  const rows = await prisma.palletLine.findMany({
    where: {
      pallet: { status: { in: STOCK_PALLET_STATUSES } },
      expiry_date: { not: null, lt: cutoff },
    },
    select: {
      qty_box: true,
      lot: true,
      expiry_date: true,
      item_code: { select: { code: true, short_name: true } },
      pallet: { select: { code: true, status: true, location: { select: { code: true } } } },
    },
    orderBy: { expiry_date: "asc" },
  });

  if (rows.length === 0) {
    console.log("✓ Không có lô hết hạn nào trong tồn.");
    return;
  }

  let totalQty = 0;
  for (const r of rows) {
    const qty = Number(r.qty_box || 0);
    totalQty += qty;
    console.log(
      `- ${r.item_code.code} (${r.item_code.short_name}) · lô ${r.lot || "—"} · HSD ${r.expiry_date?.toISOString().slice(0, 10)} · ${qty} thùng · pallet ${r.pallet.code} [${r.pallet.status}] · vị trí ${r.pallet.location?.code || "—"}`
    );
  }
  console.log(`\nTổng: ${rows.length} dòng · ${totalQty} thùng hết hạn (bị chặn xuất). Xử lý qua Điều chỉnh giảm (DECREASE).`);
}

main()
  .catch((e) => { console.error("Lỗi:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
