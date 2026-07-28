import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CODE_PREFIX, formatYearlyCode } from "@/lib/codegen";
import { notifyByRoles } from "@/lib/notifications";
import { requirePermission, guardPermission } from "@/lib/auth-server";

// GET /api/adjustments — Danh sách phiếu điều chỉnh
// Query params: ?session_id=xxx, ?type=STOCKTAKE_RESOLVE, ?status=PENDING
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "inventory", "read");
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id") || "";
    const type = searchParams.get("type") || "";
    const status = searchParams.get("status") || "";

    const where: Record<string, unknown> = {};
    if (sessionId) where.stocktake_session_id = sessionId;
    if (type) where.type = type;
    if (status) where.status = status;

    const vouchers = await prisma.adjustmentVoucher.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        lines: {
          include: {
            item_code: { select: { code: true, short_name: true } },
            pallet: { select: { code: true } },
          },
        },
      },
    });

    const userIds = Array.from(
      new Set(
        vouchers
          .flatMap((v) => [v.created_by, v.approved_by])
          .filter((id): id is string => !!id)
      )
    );

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, full_name: true, role: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const locationIds = Array.from(
      new Set(
        vouchers
          .flatMap((v) => v.lines.map((l) => l.location_id))
          .filter((id): id is string => !!id)
      )
    );

    const locations = await prisma.location.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, code: true },
    });

    const locationMap = new Map(locations.map((l) => [l.id, l.code]));

    const data = vouchers.map((v) => ({
      ...v,
      creator_name: v.created_by ? userMap.get(v.created_by)?.full_name || null : null,
      creator_role: v.created_by ? userMap.get(v.created_by)?.role || null : null,
      approver_name: v.approved_by ? userMap.get(v.approved_by)?.full_name || null : null,
      lines: v.lines.map((l) => ({
        ...l,
        location_code: l.location_id ? locationMap.get(l.location_id) || null : null,
      })),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/adjustments error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

// POST /api/adjustments — Tạo phiếu điều chỉnh tồn
// UC-INV-09: hỗ trợ thêm type (DECREASE/INCREASE/STOCKTAKE_RESOLVE), reason_code, pallet_id, lot, note per line
export async function POST(req: NextRequest) {
  try {
    const { user } = await requirePermission(req, "inventory", "write");
    const body = await req.json();
    const { reason, type, reason_code, stocktake_session_id, lines } = body;

    if (!reason?.trim()) return NextResponse.json({ success: false, error: "Thiếu lý do." }, { status: 400 });
    if (!lines?.length) return NextResponse.json({ success: false, error: "Thiếu dòng điều chỉnh." }, { status: 400 });

    // Validate type
    const validTypes = ["DECREASE", "INCREASE", "STOCKTAKE_RESOLVE"];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json({ success: false, error: `Loại điều chỉnh không hợp lệ. Chấp nhận: ${validTypes.join(", ")}` }, { status: 400 });
    }

    // Validate reason_code
    const validReasonCodes = ["BROKEN", "LOST", "STOCKTAKE", "OTHER"];
    if (reason_code && !validReasonCodes.includes(reason_code)) {
      return NextResponse.json({ success: false, error: `Mã lý do không hợp lệ. Chấp nhận: ${validReasonCodes.join(", ")}` }, { status: 400 });
    }

    // Sinh mã: ADJ-YYYY-NNNN (CT-1: prefix DCT → ADJ, pad 3 → 4 digit theo mockup)
    const year = new Date().getFullYear();
    const count = await prisma.adjustmentVoucher.count({
      where: { code: { startsWith: `${CODE_PREFIX.ADJUSTMENT_VOUCHER}-${year}` } },
    });
    const code = formatYearlyCode(CODE_PREFIX.ADJUSTMENT_VOUCHER, year, count + 1);

    if (stocktake_session_id) {
      const session = await prisma.stocktakeSession.findUnique({
        where: { id: stocktake_session_id },
      });
      if (!session) {
        return NextResponse.json({ success: false, error: "Không tìm thấy phiên kiểm kê." }, { status: 404 });
      }
      if (session.status === "CLOSED") {
        return NextResponse.json({ success: false, error: "Phiên kiểm kê đã đóng. Không thể xử lý chênh lệch." }, { status: 400 });
      }
    }

    const voucher = await prisma.adjustmentVoucher.create({
      data: {
        code,
        reason: reason.trim(),
        type: type || null,
        reason_code: reason_code || null,
        stocktake_session_id: stocktake_session_id || null,
        created_by: user.id,
        lines: {
          create: lines.map((l: { item_code_id: string; location_id?: string; pallet_id?: string; lot?: string; note?: string; qty_before: number; qty_adjust: number; is_outside_system?: boolean; found_pallet_code?: string; expiry_date?: string }) => ({
            item_code_id: l.item_code_id,
            location_id: l.location_id || null,
            pallet_id: l.pallet_id || null,
            lot: l.lot?.trim() || null,
            note: l.note?.trim() || null,
            qty_before: l.qty_before,
            qty_adjust: l.qty_adjust,
            qty_after: l.qty_before + l.qty_adjust,
            // UC-INV-06: dòng "pallet ngoài hệ thống" → approve sẽ TẠO pallet thật
            is_outside_system: l.is_outside_system || false,
            found_pallet_code: l.found_pallet_code?.trim() || null,
            expiry_date: l.expiry_date ? new Date(l.expiry_date) : null,
          })),
        },
      },
      include: { lines: true },
    });

    // Notify KE_TOAN khi tạo phiếu điều chỉnh (cần phê duyệt)
    notifyByRoles(["KE_TOAN"], {
      type: "ADJUSTMENT_CREATED",
      title: `Phiếu điều chỉnh mới: ${code}`,
      body: `Phiếu điều chỉnh ${code} (${type || "DECREASE"}, ${voucher.lines.length} dòng). Lý do: ${reason.trim()}`,
      entity_type: "adjustment_voucher",
      entity_id: voucher.id,
      link_url: `/ketoan/adjustments/${voucher.id}`,
    }).catch((err) => console.error("notifyByRoles ADJUSTMENT_CREATED:", err));

    return NextResponse.json({ success: true, data: voucher });
  } catch (error) {
    console.error("POST /api/adjustments error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}
