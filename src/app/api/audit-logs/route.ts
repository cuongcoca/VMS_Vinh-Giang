import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

// WVG-49 / UC-SYS-03: mask giá trị nhạy cảm trong old/new_value trước khi trả về
// (không rò password hash / token / otp / secret trên Nhật ký). Che ở READ — dữ liệu
// gốc trong DB giữ nguyên, chỉ ẩn khi hiển thị.
const SENSITIVE_KEY_RE = /pass|password_hash|token|secret|otp|hash|salt|api[_-]?key/i;
function maskSensitive(val: unknown): unknown {
  if (val === null || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(maskSensitive);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY_RE.test(k) ? "***" : maskSensitive(v);
  }
  return out;
}

// GET /api/audit-logs — Nhật ký hoạt động (chỉ QUẢN LÝ — audit:read).
// Query: from,to (ngày, biên GMT+7), entity_type, action, actor (tên/vai substring),
//        page (>=1), limit (<=200). Trả { data, total, page, limit }.
// Enrich: entity_code (mã thân thiện), performed_by_name + role.
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "audit", "read");
  if (denied) return denied;
  try {
    const sp = req.nextUrl.searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    const entityType = sp.get("entity_type");
    const action = sp.get("action");
    const actor = sp.get("actor")?.trim();
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") || "50", 10) || 50));

    const where: Record<string, unknown> = {};
    // Biên ngày theo GMT+7 (kho): from = đầu ngày, to = cuối ngày local (+07:00).
    if (from || to) {
      where.performed_at = {};
      if (from) (where.performed_at as Record<string, unknown>).gte = new Date(`${from}T00:00:00+07:00`);
      if (to) (where.performed_at as Record<string, unknown>).lte = new Date(`${to}T23:59:59.999+07:00`);
    }
    if (entityType) where.entity_type = entityType;
    if (action) where.action = action;
    // Lọc theo người thực hiện (tên) — server-side để đúng khi phân trang.
    if (actor) {
      const matched = await prisma.user.findMany({
        where: { full_name: { contains: actor, mode: "insensitive" } },
        select: { id: true },
      });
      where.performed_by = { in: matched.map((u) => u.id) };
    }

    const total = await prisma.auditLog.count({ where });
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { performed_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
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
        old_value: maskSensitive(l.old_value), // WVG-49: che nhạy cảm khi hiển thị
        new_value: maskSensitive(l.new_value),
        entity_code: entityCodeMap.get(`${l.entity_type}|${l.entity_id}`) || null,
        performed_by_name: u?.full_name || null,
        // performed_by_role có thể đã được lưu trong AuditLog (Phase 2), fallback dùng user.role hiện tại
        performed_by_role: l.performed_by_role || u?.role || null,
      };
    });

    return NextResponse.json({ success: true, data: enriched, total, page, limit });
  } catch (error) {
    console.error("GET /api/audit-logs error:", error);
    const msg = error instanceof Error ? error.message : "Lỗi";
    return NextResponse.json({ success: false, error: `Lỗi: ${msg}` }, { status: 500 });
  }
}
