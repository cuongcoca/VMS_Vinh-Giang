import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/audit-logs — Nhật ký hoạt động
// Trả thêm:
//   - entity_code: mã thân thiện thay UUID (vd: PL260528.001 thay vì f55ab717)
//   - performed_by_name + role: thay vì chỉ ID
export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    const entityType = req.nextUrl.searchParams.get("entity_type");

    const where: Record<string, unknown> = {};
    if (from || to) {
      where.performed_at = {};
      if (from) (where.performed_at as Record<string, unknown>).gte = new Date(from);
      if (to) (where.performed_at as Record<string, unknown>).lte = new Date(to + "T23:59:59Z");
    }
    if (entityType) where.entity_type = entityType;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { performed_at: "desc" },
      take: 200,
    });

    // Resolve entity codes — batch query theo entity_type
    const byType: Record<string, string[]> = {};
    for (const l of logs) {
      if (!byType[l.entity_type]) byType[l.entity_type] = [];
      byType[l.entity_type].push(l.entity_id);
    }

    const entityCodeMap = new Map<string, string>(); // key = `${type}|${id}` → code
    const resolvers: Promise<void>[] = [];

    if (byType.pallet?.length) {
      resolvers.push(
        prisma.pallet
          .findMany({ where: { id: { in: byType.pallet } }, select: { id: true, code: true } })
          .then((rows) => rows.forEach((r) => entityCodeMap.set(`pallet|${r.id}`, r.code)))
      );
    }
    if (byType.pallet_line?.length) {
      resolvers.push(
        prisma.palletLine
          .findMany({
            where: { id: { in: byType.pallet_line } },
            select: { id: true, pallet: { select: { code: true } } },
          })
          .then((rows) =>
            rows.forEach((r) => entityCodeMap.set(`pallet_line|${r.id}`, r.pallet.code))
          )
      );
    }
    if (byType.inbound_request?.length) {
      resolvers.push(
        prisma.inboundRequest
          .findMany({ where: { id: { in: byType.inbound_request } }, select: { id: true, code: true } })
          .then((rows) => rows.forEach((r) => entityCodeMap.set(`inbound_request|${r.id}`, r.code)))
      );
    }
    if (byType.inbound_temp?.length) {
      resolvers.push(
        prisma.inboundTemp
          .findMany({ where: { id: { in: byType.inbound_temp } }, select: { id: true, code: true } })
          .then((rows) => rows.forEach((r) => entityCodeMap.set(`inbound_temp|${r.id}`, r.code)))
      );
    }
    if (byType.outbound_request?.length) {
      resolvers.push(
        prisma.outboundRequest
          .findMany({ where: { id: { in: byType.outbound_request } }, select: { id: true, code: true } })
          .then((rows) =>
            rows.forEach((r) => entityCodeMap.set(`outbound_request|${r.id}`, r.code))
          )
      );
    }
    if (byType.adjustment_voucher?.length || byType.adjustment?.length) {
      const ids = [...(byType.adjustment_voucher || []), ...(byType.adjustment || [])];
      resolvers.push(
        prisma.adjustmentVoucher
          .findMany({ where: { id: { in: ids } }, select: { id: true, code: true } })
          .then((rows) =>
            rows.forEach((r) => {
              entityCodeMap.set(`adjustment_voucher|${r.id}`, r.code);
              entityCodeMap.set(`adjustment|${r.id}`, r.code);
            })
          )
      );
    }
    if (byType.stocktake_session?.length) {
      resolvers.push(
        prisma.stocktakeSession
          .findMany({
            where: { id: { in: byType.stocktake_session } },
            select: { id: true, code: true },
          })
          .then((rows) =>
            rows.forEach((r) => entityCodeMap.set(`stocktake_session|${r.id}`, r.code))
          )
      );
    }
    if (byType.location?.length) {
      resolvers.push(
        prisma.location
          .findMany({ where: { id: { in: byType.location } }, select: { id: true, code: true } })
          .then((rows) => rows.forEach((r) => entityCodeMap.set(`location|${r.id}`, r.code)))
      );
    }
    if (byType.item_code?.length) {
      resolvers.push(
        prisma.itemCode
          .findMany({ where: { id: { in: byType.item_code } }, select: { id: true, code: true } })
          .then((rows) => rows.forEach((r) => entityCodeMap.set(`item_code|${r.id}`, r.code)))
      );
    }
    if (byType.product?.length) {
      resolvers.push(
        prisma.product
          .findMany({ where: { id: { in: byType.product } }, select: { id: true, sku: true } })
          .then((rows) => rows.forEach((r) => entityCodeMap.set(`product|${r.id}`, r.sku)))
      );
    }
    if (byType.supplier?.length) {
      resolvers.push(
        prisma.supplier
          .findMany({ where: { id: { in: byType.supplier } }, select: { id: true, code: true } })
          .then((rows) => rows.forEach((r) => entityCodeMap.set(`supplier|${r.id}`, r.code)))
      );
    }
    if (byType.user?.length) {
      resolvers.push(
        prisma.user
          .findMany({ where: { id: { in: byType.user } }, select: { id: true, full_name: true } })
          .then((rows) => rows.forEach((r) => entityCodeMap.set(`user|${r.id}`, r.full_name)))
      );
    }

    // Resolve performed_by users
    const userIds = Array.from(
      new Set(logs.map((l) => l.performed_by).filter((v): v is string => !!v))
    );
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, full_name: true, role: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    await Promise.all(resolvers);

    const enriched = logs.map((l) => {
      const u = l.performed_by ? userMap.get(l.performed_by) : null;
      return {
        ...l,
        entity_code: entityCodeMap.get(`${l.entity_type}|${l.entity_id}`) || null,
        performed_by_name: u?.full_name || null,
        // performed_by_role có thể đã được lưu trong AuditLog (Phase 2), fallback dùng user.role hiện tại
        performed_by_role: l.performed_by_role || u?.role || null,
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error("GET /api/audit-logs error:", error);
    const msg = error instanceof Error ? error.message : "Lỗi";
    return NextResponse.json({ success: false, error: `Lỗi: ${msg}` }, { status: 500 });
  }
}
