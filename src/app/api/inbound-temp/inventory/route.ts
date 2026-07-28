import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

// UC-INTMP-03: Theo dõi tồn tạm
// Trả về flat list các dòng (line) thuộc phiếu PENDING + KPIs.
// Severity:
//   - overdue: days_on_hand > 3
//   - warning: days_on_hand 2..3
//   - new: days_on_hand < 2
const OVERDUE_THRESHOLD = 3;

export async function GET(req: Request) {
  const denied = await guardPermission(req, "inbound", "read");
  if (denied) return denied;
  try {
    const temps = await prisma.inboundTemp.findMany({
      where: { status: "PENDING" },
      orderBy: { created_at: "desc" },
      include: {
        lines: {
          include: {
            item_code: { select: { id: true, code: true, short_name: true } },
          },
        },
      },
    });

    const now = Date.now();
    type Severity = "overdue" | "warning" | "new";
    const items: Array<{
      line_id: string;
      temp_id: string;       // Phase 4.3 — TC017/_018: cần id để link sang chi tiết
      pnt_code: string;
      item_code: string;
      item_name: string;
      qty: number;
      lot: string | null;
      expiry_date: string | null;
      days_on_hand: number;
      severity: Severity;
      received_at: string;
    }> = [];

    let totalQty = 0;
    let overdueCount = 0;
    const distinctItemCodes = new Set<string>();
    let tempsWithItems = 0; // Số phiếu thực sự có dòng hàng

    for (const temp of temps) {
      // Guard: created_at có thể null hoặc invalid date trong một số record cũ
      const createdAt = temp.created_at ? new Date(temp.created_at) : null;
      const createdAtMs = createdAt && !isNaN(createdAt.getTime()) ? createdAt.getTime() : now;
      const days = Math.floor((now - createdAtMs) / 86400000);
      const severity: Severity =
        days > OVERDUE_THRESHOLD ? "overdue" : days >= 2 ? "warning" : "new";
      if (days > OVERDUE_THRESHOLD) overdueCount++;

      // Bỏ qua phiếu rỗng (không có dòng hàng)
      if (!temp.lines || temp.lines.length === 0) continue;
      tempsWithItems++;

      for (const line of temp.lines) {
        const qty = Number(line.qty_box);
        totalQty += qty;
        distinctItemCodes.add(line.item_code_id);

        // Guard: parse expiry_date an toàn
        const expiryDate = line.expiry_date ? new Date(line.expiry_date) : null;
        const expiryIso = expiryDate && !isNaN(expiryDate.getTime()) ? expiryDate.toISOString() : null;

        // Guard: parse received_at an toàn
        const receivedIso = createdAt && !isNaN(createdAt.getTime()) ? createdAt.toISOString() : new Date().toISOString();

        items.push({
          line_id: line.id,
          temp_id: temp.id,
          pnt_code: temp.code,
          item_code: line.item_code.code,
          item_name: line.item_code.short_name,
          qty,
          lot: line.lot,
          expiry_date: expiryIso,
          days_on_hand: days,
          severity,
          received_at: receivedIso,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          total_pending: tempsWithItems,          // Phếu có hàng thực sự (hiển thị chính)
          total_pending_all: temps.length,        // Tất cả phiếu PENDING (kể cả rỗng)
          empty_temps: temps.length - tempsWithItems, // Phếu rỗng chưa nhập hàng
          distinct_item_codes: distinctItemCodes.size,
          total_qty: totalQty,
          overdue_count: overdueCount,
        },
        items,
      },
    });
  } catch (error) {
    console.error("GET /api/inbound-temp/inventory error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tải dữ liệu tồn tạm." },
      { status: 500 }
    );
  }
}
