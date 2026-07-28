import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

// GET /api/movements — Lịch sử luân chuyển pallet (UC-FK-06)
// Query: pallet_id, type (movement_type), from (date), to (date), q (search pallet/mã hàng), limit
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "movement", "read");
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const palletId = searchParams.get("pallet_id") || "";
    const movementType = searchParams.get("type") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit") || 200), 500);

    const where: Record<string, unknown> = {};
    if (palletId) where.pallet_id = palletId;
    if (movementType) where.movement_type = movementType;
    if (from || to) {
      where.performed_at = {};
      if (from) (where.performed_at as Record<string, unknown>).gte = new Date(from);
      if (to) (where.performed_at as Record<string, unknown>).lte = new Date(to + "T23:59:59");
    }
    // UC-FK-06_TC02: tìm theo mã pallet / mã hàng / vị trí kho.
    if (q) {
      where.OR = [
        { pallet: { code: { contains: q, mode: "insensitive" } } },
        // mã hàng trực tiếp trên movement (rút theo SKU, gồm cả lịch sử cũ)
        { item_code: { code: { contains: q, mode: "insensitive" } } },
        { item_code: { short_name: { contains: q, mode: "insensitive" } } },
        // mã hàng qua các dòng của pallet → pallet nhiều mã hàng vẫn khớp đủ
        { pallet: { lines: { some: { item_code: { code: { contains: q, mode: "insensitive" } } } } } },
        { pallet: { lines: { some: { item_code: { short_name: { contains: q, mode: "insensitive" } } } } } },
        // vị trí kho: khớp vị trí cũ hoặc vị trí mới (A-01-01, ...)
        { from_location: { code: { contains: q, mode: "insensitive" } } },
        { to_location: { code: { contains: q, mode: "insensitive" } } },
      ];
    }

    const movements = await prisma.movement.findMany({
      where,
      orderBy: { performed_at: "desc" },
      take: limit,
      include: {
        pallet: { select: { id: true, code: true, status: true } },
        from_location: { select: { id: true, code: true, zone: true } },
        to_location: { select: { id: true, code: true, zone: true } },
        item_code: { select: { id: true, code: true, short_name: true } },
      },
    });

    // Batch fetch users (performed_by không có Prisma relation)
    const userIds = Array.from(
      new Set(movements.map((m) => m.performed_by).filter((x): x is string => !!x))
    );
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, full_name: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

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
    const auditMap = new Map(auditLogs.map((a) => [a.id, a]));

    const data = movements.map((m) => ({
      ...m,
      performer: m.performed_by ? userMap.get(m.performed_by) || null : null,
      audit: m.audit_log_id ? auditMap.get(m.audit_log_id) ?? null : null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/movements error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tải lịch sử." }, { status: 500 });
  }
}
