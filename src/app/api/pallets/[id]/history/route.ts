import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

// GET /api/pallets/[id]/history — Lịch sử thay đổi pallet
//
// Phase 3.5 (BUG_REPORT UC-PAL-06):
//   - TC_HISTORY_PAL_006/_014: hiển thị lịch sử vị trí (Movement) chi tiết
//     ngoài AuditLog (vị trí cũ → vị trí mới).
//   - TC_HISTORY_PAL_017: tất cả role xem được — không gate role ở API.
//   - TC_EDIT_PAL_008/_018: hiển thị reason + người thực hiện + role + IP.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(req, "pallet", "read");
  if (denied) return denied;
  try {
    const { id } = await params;

    const pallet = await prisma.pallet.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, zone: true } },
        inbound_request: { select: { id: true, code: true } },
      },
    });
    if (!pallet) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy pallet." },
        { status: 404 }
      );
    }

    // Audit logs cho pallet
    const logs = await prisma.auditLog.findMany({
      where: { entity_type: "pallet", entity_id: id },
      orderBy: { performed_at: "desc" },
    });

    // Movements (vị trí cũ → vị trí mới)
    const movements = await prisma.movement.findMany({
      where: { pallet_id: id },
      include: {
        from_location: { select: { id: true, code: true, zone: true } },
        to_location: { select: { id: true, code: true, zone: true } },
        item_code: { select: { id: true, code: true, short_name: true } },
      },
      orderBy: { performed_at: "desc" },
    });

    // Resolve performed_by → user info (gộp users 1 query)
    // Gộp cả performed_by của Movement + người tạo pallet để hiển thị tên ở mọi event.
    const userIds = Array.from(
      new Set(
        [
          ...logs.map((l) => l.performed_by),
          ...movements.map((m) => m.performed_by),
          pallet.created_by,
        ].filter((v): v is string => !!v)
      )
    );
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, full_name: true, role: true },
        })
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    type Event = {
      id: string;
      kind: "audit" | "movement" | "created";
      action: string;
      label: string;
      old_value: unknown;
      new_value: unknown;
      reason: string | null;
      // detail: mô tả thay đổi đã việt hóa (vd "Đang đếm → Đã xác nhận")
      detail: string | null;
      // status_from/status_to: chuyển trạng thái (nếu có) — TC_HISTORY_PAL_013
      status_from: string | null;
      status_to: string | null;
      performed_by: string | null;
      performed_by_name: string | null;
      performed_by_role: string | null;
      ip_address: string | null;
      performed_at: Date;
      // Movement-only fields
      from_location?: { code: string; zone: string } | null;
      to_location?: { code: string; zone: string } | null;
    };

    const events: Event[] = [];

    for (const log of logs) {
      const user = log.performed_by ? userMap[log.performed_by] : null;
      // TC_HISTORY_PAL_013/_015/_018/_020: trích trạng thái cũ → mới từ audit value
      const oldStatus = extractStatus(log.old_value);
      const newStatus = extractStatus(log.new_value);
      const detail =
        oldStatus && newStatus && oldStatus !== newStatus
          ? `${PAL_STATUS_LABEL[oldStatus] || oldStatus} → ${PAL_STATUS_LABEL[newStatus] || newStatus}`
          : newStatus
            ? PAL_STATUS_LABEL[newStatus] || newStatus
            : null;
      events.push({
        id: log.id,
        kind: "audit",
        action: log.action,
        label: AUDIT_ACTION_LABEL[log.action] || log.action,
        old_value: log.old_value,
        new_value: log.new_value,
        reason: log.reason,
        detail,
        status_from: oldStatus,
        status_to: newStatus,
        performed_by: log.performed_by,
        performed_by_name: user?.full_name || null,
        performed_by_role: log.performed_by_role || user?.role || null,
        ip_address: log.ip_address,
        performed_at: log.performed_at,
      });
    }

    for (const m of movements) {
      const fromCode = m.from_location?.code || null;
      const toCode = m.to_location?.code || null;
      // TC_HISTORY_PAL_014/_015/_018/_020: mô tả vị trí cũ → vị trí mới rõ ràng
      const locDetail =
        fromCode && toCode
          ? `${fromCode} → ${toCode}`
          : toCode
            ? `→ ${toCode}`
            : fromCode
              ? `${fromCode} →`
              : null;
      const mvUser = m.performed_by ? userMap[m.performed_by] : null;
      events.push({
        id: `mv_${m.id}`,
        kind: "movement",
        action: m.movement_type,
        label: MOVEMENT_LABEL[m.movement_type] || m.movement_type,
        old_value: m.from_location ? { location: m.from_location.code } : null,
        new_value: m.to_location ? { location: m.to_location.code } : null,
        reason: m.reason || null,
        detail: locDetail,
        status_from: null,
        status_to: null,
        performed_by: m.performed_by ?? null,
        performed_by_name: mvUser?.full_name || null,
        performed_by_role: mvUser?.role || null,
        ip_address: null,
        performed_at: m.performed_at,
        from_location: m.from_location
          ? { code: m.from_location.code, zone: m.from_location.zone }
          : null,
        to_location: m.to_location
          ? { code: m.to_location.code, zone: m.to_location.zone }
          : null,
      });
    }

    // Event "Tạo pallet" — chỉ add nếu chưa có audit CREATE_PALLET (tránh duplicate)
    const hasCreateAudit = logs.some(
      (l) => l.action === "CREATE_PALLET" || l.action === "CREATE"
    );
    if (!hasCreateAudit) {
      events.push({
        id: "created",
        kind: "created",
        action: "CREATE",
        label: "Tạo pallet",
        old_value: null,
        new_value: { code: pallet.code, status: "EMPTY" },
        reason: `Tạo pallet ${pallet.code}`,
        detail: PAL_STATUS_LABEL.EMPTY,
        status_from: null,
        status_to: "EMPTY",
        performed_by: pallet.created_by,
        performed_by_name: pallet.created_by ? userMap[pallet.created_by]?.full_name || null : null,
        performed_by_role: pallet.created_by ? userMap[pallet.created_by]?.role || null : null,
        ip_address: null,
        performed_at: pallet.created_at,
      });
    }

    events.sort(
      (a, b) =>
        new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime()
    );

    return NextResponse.json({
      success: true,
      data: events,
      pallet: {
        id: pallet.id,
        code: pallet.code,
        status: pallet.status,
        supplier: pallet.supplier,
        location: pallet.location,
        inbound_request: pallet.inbound_request,
      },
    });
  } catch (error) {
    console.error("GET /api/pallets/[id]/history error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tải lịch sử." },
      { status: 500 }
    );
  }
}

const AUDIT_ACTION_LABEL: Record<string, string> = {
  CREATE_PALLET: "Tạo pallet",
  ADD_PALLET_LINE: "Thêm dòng hàng",
  EDIT_PALLET_LINE: "Sửa dòng hàng",
  DELETE_PALLET_LINE: "Xóa dòng hàng",
  CONFIRM_PALLET: "Xác nhận pallet",
  UNLOCK_PALLET: "Mở khóa pallet để sửa",
  CANCEL_PALLET: "Hủy pallet",
};

const MOVEMENT_LABEL: Record<string, string> = {
  PUT_AWAY: "Đưa vào vị trí",
  RELOCATE: "Chuyển vị trí",
  STAGE_OUT: "Sang khu chờ xuất",
  RETURN: "Hoàn trả vị trí",
  SHIP: "Xuất kho",
  ADJUST: "Điều chỉnh",
  PICK: "Lấy hàng",
};

// Nhãn trạng thái pallet đã việt hóa — dùng để render lịch sử chuyển trạng thái.
const PAL_STATUS_LABEL: Record<string, string> = {
  EMPTY: "Chưa kích hoạt",
  COUNTING: "Đang thêm hàng",
  CONFIRMED: "Đã xác nhận",
  IN_STORAGE: "Trong kho",
  IN_STAGING: "Khu chờ xuất",
  SHIPPED: "Đã xuất",
  CANCELLED: "Đã hủy",
};

// Trích status từ old_value/new_value của AuditLog (Json | null).
function extractStatus(value: unknown): string | null {
  if (value && typeof value === "object" && "status" in value) {
    const s = (value as { status?: unknown }).status;
    return typeof s === "string" ? s : null;
  }
  return null;
}
