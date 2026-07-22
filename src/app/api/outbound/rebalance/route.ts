import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifyByRoles } from "@/lib/notifications";

// POST /api/outbound/rebalance — Cân lại tồn khu chờ xuất (trừ SL đã xuất)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adjustments, file_name, source, export_date } = body;
    // adjustments: Array<{ pallet_line_id: string, qty_out: number }>

    if (!adjustments || !Array.isArray(adjustments) || adjustments.length === 0) {
      return NextResponse.json({ success: false, error: "Thiếu dữ liệu điều chỉnh." }, { status: 400 });
    }

    const results = [];

    for (const adj of adjustments) {
      const { pallet_line_id, qty_out } = adj;
      if (!pallet_line_id || !qty_out || Number(qty_out) <= 0) continue;

      const line = await prisma.palletLine.findUnique({
        where: { id: pallet_line_id },
        include: { pallet: { select: { id: true, code: true, status: true } } },
      });
      if (!line) continue;
      if (line.pallet.status !== "IN_STAGING") continue;

      const currentQty = Number(line.qty_box);
      const outQty = Number(qty_out);
      const newQty = Math.max(0, currentQty - outQty);

      await prisma.palletLine.update({
        where: { id: pallet_line_id },
        data: { qty_box: newQty },
      });

      // Ghi audit log — UC-OUT-05_TC17: kèm user (performed_by) + tên file + nguồn + ngày xuất
      await logAudit(req, {
        entity_type: "pallet_line",
        entity_id: pallet_line_id,
        action: "REBALANCE",
        old_value: { qty_box: currentQty },
        new_value: { qty_box: newQty, qty_out: outQty, file_name: file_name ?? null, source: source ?? null, export_date: export_date ?? null },
        reason: `Cân lại tồn: ${currentQty} - ${outQty} = ${newQty}${file_name ? ` (file: ${file_name})` : ""}`,
      });

      results.push({
        pallet_line_id,
        pallet_code: line.pallet.code,
        old_qty: currentQty,
        qty_out: outQty,
        new_qty: newQty,
      });
    }

    // Kiểm tra pallet nào hết hàng → RELEASED
    const palletIds = [...new Set(results.map(r => {
      // Tìm lại pallet_id từ line
      return r.pallet_code;
    }))];
    // Check each affected pallet
    for (const r of results) {
      const line = await prisma.palletLine.findUnique({
        where: { id: r.pallet_line_id },
        select: { pallet_id: true },
      });
      if (!line) continue;

      const remainingLines = await prisma.palletLine.aggregate({
        where: { pallet_id: line.pallet_id },
        _sum: { qty_box: true },
      });
      const totalRemaining = Number(remainingLines._sum?.qty_box || 0);
      if (totalRemaining <= 0) {
        await prisma.pallet.update({
          where: { id: line.pallet_id },
          data: { status: "RELEASED" },
        });
      }
    }

    // Notify THU_KHO, KE_TOAN khi cân lại tồn xuất
    if (results.length > 0) {
      notifyByRoles(["THU_KHO", "KE_TOAN"], {
        type: "OUTBOUND_REBALANCED",
        title: `Cân lại tồn xuất: ${results.length} dòng`,
        body: `Đã cân lại ${results.length} dòng hàng từ khu chờ xuất${file_name ? ` (file: ${file_name})` : ""}.`,
        entity_type: "outbound_rebalance",
        entity_id: results[0]?.pallet_line_id || "batch",
      }).catch((err) => console.error("notifyByRoles OUTBOUND_REBALANCED:", err));
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `Đã cân lại ${results.length} dòng hàng.`,
    });
  } catch (error) {
    console.error("POST /api/outbound/rebalance error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi cân lại tồn." }, { status: 500 });
  }
}
