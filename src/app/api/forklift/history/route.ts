import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/forklift/history — Lịch sử toàn bộ Movement của forklift
//
// Phase 6.3 (BUG_REPORT UC-FK-06_TC01, UC-FK-03_TC20, MD06 row 46):
// Trả về danh sách movement với filter từ ngày, đến ngày, loại
// (PUT_AWAY/RELOCATE/STAGE_OUT/RETURN), pallet code (search).
// Bao gồm pallet code, vị trí cũ → mới, user thực hiện, thời gian.
//
// UC-FK-06_TC02: ô tìm kiếm hợp nhất — khớp mã pallet / mã hàng (kể cả pallet
// nhiều mã hàng, join qua PalletLine) / vị trí kho (from/to location).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const type = searchParams.get("type") || ""; // PUT_AWAY | RELOCATE | STAGE_OUT | RETURN
    // UC-FK-06_TC02: tìm kiếm hợp nhất (giữ tương thích tham số cũ `pallet`)
    const searchQ = (searchParams.get("q") || searchParams.get("pallet") || "").trim();
    const todayOnly = searchParams.get("today") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

    const where: Record<string, unknown> = {};

    if (type && ["PUT_AWAY", "RELOCATE", "STAGE_OUT", "RETURN", "SHIP"].includes(type)) {
      where.movement_type = type;
    }

    if (todayOnly) {
      const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
      const startOfTodayVN = new Date(
        Date.UTC(
          nowVN.getUTCFullYear(),
          nowVN.getUTCMonth(),
          nowVN.getUTCDate(),
          0,
          0,
          0,
          0
        )
      );
      const startOfDayUTC = new Date(startOfTodayVN.getTime() - 7 * 60 * 60 * 1000);
      where.performed_at = { gte: startOfDayUTC };
    } else if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setUTCHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }
      where.performed_at = dateFilter;
    }

    // UC-FK-06_TC02: 1 ô tìm kiếm khớp mã pallet HOẶC mã hàng HOẶC vị trí kho.
    // Kết hợp AND với lọc loại + khoảng thời gian ở trên.
    if (searchQ) {
      where.OR = [
        { pallet: { code: { contains: searchQ, mode: "insensitive" } } },
        // mã hàng ghi trực tiếp trên movement (rút theo SKU, gồm cả lịch sử cũ)
        { item_code: { code: { contains: searchQ, mode: "insensitive" } } },
        { item_code: { short_name: { contains: searchQ, mode: "insensitive" } } },
        // mã hàng qua các dòng của pallet → pallet nhiều mã hàng vẫn khớp đủ
        { pallet: { lines: { some: { item_code: { code: { contains: searchQ, mode: "insensitive" } } } } } },
        { pallet: { lines: { some: { item_code: { short_name: { contains: searchQ, mode: "insensitive" } } } } } },
        // vị trí kho: khớp vị trí cũ hoặc vị trí mới (A-01-01, ...)
        { from_location: { code: { contains: searchQ, mode: "insensitive" } } },
        { to_location: { code: { contains: searchQ, mode: "insensitive" } } },
      ];
    }

    const movements = await prisma.movement.findMany({
      where,
      orderBy: { performed_at: "desc" },
      take: limit,
      include: {
        pallet: {
          select: {
            id: true,
            code: true,
            status: true,
            supplier: { select: { code: true, name: true } },
            lines: {
              select: {
                id: true,
                qty_box: true,
                lot: true,
                expiry_date: true,
                item_code: {
                  select: {
                    code: true,
                    short_name: true,
                  },
                },
              },
            },
          },
        },
        from_location: { select: { code: true, zone: true } },
        to_location: { select: { code: true, zone: true } },
        item_code: { select: { code: true, short_name: true } },
      },
    });

    // Resolve performed_by → user info
    const userIds = Array.from(
      new Set(movements.map((m) => m.performed_by).filter((v): v is string => !!v))
    );
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, full_name: true, role: true },
        })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    // UC-FK-06_TC20: nạp AuditLog đã gắn vào movement (hoàn trả) để hiển thị cũ → mới.
    const auditIds = Array.from(
      new Set(movements.map((m) => m.audit_log_id).filter((v): v is string => !!v))
    );
    const auditLogs = auditIds.length
      ? await prisma.auditLog.findMany({
          where: { id: { in: auditIds } },
          select: { id: true, action: true, old_value: true, new_value: true },
        })
      : [];
    const auditMap = Object.fromEntries(auditLogs.map((a) => [a.id, a]));

    const data = movements.map((m) => ({
      id: m.id,
      movement_type: m.movement_type,
      performed_at: m.performed_at,
      performed_by: m.performed_by,
      performed_by_name: m.performed_by ? userMap[m.performed_by]?.full_name || null : null,
      performed_by_role: m.performed_by ? userMap[m.performed_by]?.role || null : null,
      pallet: m.pallet,
      from_location: m.from_location,
      to_location: m.to_location,
      item_code: m.item_code,
      qty_box: m.qty_box,
      lot: m.lot,
      expiry_date: m.expiry_date,
      mode: m.mode,
      reason_code: m.reason_code,
      reason: m.reason,
      audit: m.audit_log_id ? auditMap[m.audit_log_id] ?? null : null,
    }));

    // KPI nhỏ
    const counts = await prisma.movement.groupBy({
      by: ["movement_type"],
      _count: true,
      ...(Object.keys(where).length > 0 ? { where } : {}),
    });
    const kpis: Record<string, number> = {
      PUT_AWAY: 0,
      RELOCATE: 0,
      STAGE_OUT: 0,
      RETURN: 0,
      total: 0,
    };
    for (const g of counts) {
      kpis[g.movement_type] = g._count;
      kpis.total += g._count;
    }

    return NextResponse.json({ success: true, data, kpis });
  } catch (error) {
    console.error("GET /api/forklift/history error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tải lịch sử luân chuyển." },
      { status: 500 }
    );
  }
}
