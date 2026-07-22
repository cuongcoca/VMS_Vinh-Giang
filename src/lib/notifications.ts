import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./prisma";
import { sendPushToUser, sendPushToRoles } from "./push-service";

export type NotificationType =
  // ─── Nhập kho (Inbound) ───
  | "INBOUND_REQUEST_CREATED"        // KT tạo phiếu YC nhập → THU_KHO
  | "INBOUND_REQUEST_SENT"           // KT gửi phiếu (DRAFT→PENDING) → THU_KHO
  | "INBOUND_RECEIVING_STARTED"      // TK bắt đầu nhận hàng → KE_TOAN
  | "INBOUND_SENT_FOR_RECONCILIATION" // TK gửi đối chiếu → KE_TOAN
  | "INBOUND_RECHECK_REQUESTED"      // KT yêu cầu kiểm lại → THU_KHO
  | "INBOUND_COMPLETED"              // KT chốt phiếu → THU_KHO
  | "INBOUND_CANCELLED"              // KT hủy phiếu → THU_KHO
  | "INBOUND_EXCEL_IMPORTED"         // KT import Excel → THU_KHO
  // ─── Nhập tạm (Inbound Temp) ───
  | "INBOUND_TEMP_CREATED"           // TK tạo phiếu tạm → KE_TOAN
  | "INBOUND_TEMP_STANDARDIZED"      // KT chuẩn hóa → THU_KHO
  | "INBOUND_TEMP_REJECTED"          // KT từ chối → THU_KHO
  // ─── Pallet ───
  | "PALLET_CONFIRMED"               // TK xác nhận → XE_NANG
  | "PALLET_CANCELLED"               // Hủy pallet → XE_NANG
  // ─── Xe nâng (Forklift) ───
  | "PALLET_PUT_AWAY"                // XN xếp vào kho → THU_KHO
  | "PALLET_RELOCATED"               // XN chuyển vị trí → THU_KHO
  | "PALLET_STAGED_OUT"              // XN chuyển ra chờ xuất → THU_KHO, KE_TOAN
  | "PALLET_SPLIT_STAGED"            // XN rút 1 phần → THU_KHO, KE_TOAN
  | "PALLET_RETURNED"                // XN hoàn trả → THU_KHO, KE_TOAN
  // ─── Xuất kho (Outbound) ───
  | "OUTBOUND_REQUEST_CREATED"       // KT tạo phiếu xuất → THU_KHO, XE_NANG
  | "OUTBOUND_PICKING_STARTED"       // Bắt đầu lấy hàng → XE_NANG
  | "OUTBOUND_SHIPPED"               // Xuất kho xong → THU_KHO, XE_NANG
  | "OUTBOUND_CANCELLED"             // Hủy phiếu xuất → THU_KHO, XE_NANG
  | "PALLET_RELEASED"                // Xuất pallet → THU_KHO
  | "OUTBOUND_REBALANCED"            // Cân lại tồn → THU_KHO
  | "STOCKTAKE_CREATED"              // Tạo phiên KK → KIEM_KE, THU_KHO
  | "STOCKTAKE_DISCREPANCY"          // Có chênh lệch → KE_TOAN, QUAN_LY
  | "STOCKTAKE_CLOSED"               // Đóng KK → KE_TOAN, QUAN_LY
  | "STOCKTAKE_RECOUNT_REQUESTED"    // Yêu cầu kiểm lại → THU_KHO
  // ─── Điều chỉnh tồn ───
  | "ADJUSTMENT_CREATED"             // Tạo phiếu DC → THU_KHO
  | "ADJUSTMENT_APPROVED"            // Duyệt DC → THU_KHO, KE_TOAN
  | "ADJUSTMENT_REJECTED"            // Từ chối DC → KE_TOAN
  // ─── Mã hàng ───
  | "ITEM_CODE_CREATED"              // TK tạo mã hàng → KE_TOAN
  | "ITEM_CODE_STANDARDIZED"         // KT chuẩn hóa → THU_KHO
  // ─── Cảnh báo hệ thống ───
  | "ALERT_EXPIRY_SOON"              // HSD sắp hết → THU_KHO, KE_TOAN
  | "ALERT_LOW_STOCK"                // Tồn kho thấp → THU_KHO, KE_TOAN
  | "OTHER";

export interface NotificationInput {
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  link_url?: string | null;
}

/**
 * Insert 1 notification cho 1 user. Không throw nếu lỗi (log + nuốt) để
 * tránh chặn nghiệp vụ chính.
 */
export async function createNotification(
  input: NotificationInput,
  client: Prisma.TransactionClient | PrismaClient = defaultPrisma
) {
  try {
    const notification = await client.notification.create({
      data: {
        user_id: input.user_id,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        entity_type: input.entity_type ?? null,
        entity_id: input.entity_id ?? null,
        link_url: input.link_url ?? null,
      },
    });

    // Push notification (fire-and-forget)
    sendPushToUser(input.user_id, {
      title: input.title,
      body: input.body ?? "",
      data: {
        type: input.type,
        entity_type: input.entity_type ?? "",
        entity_id: input.entity_id ?? "",
        link_url: input.link_url ?? "",
        notification_id: notification.id,
      },
    }).catch((err) => console.error("[Push] createNotification push error:", err));

    return notification;
  } catch (err) {
    console.error("createNotification error:", err, "input:", input);
    return null;
  }
}

/**
 * Notify tất cả user thuộc các role nhất định (vd: tất cả THU_KHO).
 * Dùng cho event broadcast — Kế toán tạo phiếu, cần notify mọi Thủ kho.
 */
export async function notifyByRoles(
  roles: string[],
  payload: Omit<NotificationInput, "user_id">,
  client: Prisma.TransactionClient | PrismaClient = defaultPrisma
) {
  try {
    const users = await client.user.findMany({
      where: { role: { in: roles as never[] }, is_locked: false },
      select: { id: true },
    });
    if (users.length === 0) return { count: 0 };
    const data = users.map((u) => ({
      user_id: u.id,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      entity_type: payload.entity_type ?? null,
      entity_id: payload.entity_id ?? null,
      link_url: payload.link_url ?? null,
    }));
    const result = await client.notification.createMany({ data });

    // Push notification cho tất cả users có role tương ứng (fire-and-forget)
    sendPushToRoles(roles, {
      title: payload.title,
      body: payload.body ?? "",
      data: {
        type: payload.type,
        entity_type: payload.entity_type ?? "",
        entity_id: payload.entity_id ?? "",
        link_url: payload.link_url ?? "",
      },
    }).catch((err) => console.error("[Push] notifyByRoles push error:", err));

    return result;
  } catch (err) {
    console.error("notifyByRoles error:", err, "roles:", roles);
    return { count: 0 };
  }
}
