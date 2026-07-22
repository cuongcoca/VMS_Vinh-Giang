/**
 * Map enum DB → label tiếng Việt cho hiển thị UI.
 * Dùng xuyên suốt cả desktop + mobile để đồng bộ ngôn ngữ.
 *
 * Quy ước:
 * - `LABEL` = chuỗi hiển thị
 * - `BADGE_TONE` = "neutral" | "info" | "success" | "warning" | "error" để Badge component map màu
 */

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "error";

// ─── Pallet ──────────────────────────────────────────────────
export const PALLET_STATUS_LABEL: Record<string, string> = {
  EMPTY: "Đang thêm hàng",
  COUNTING: "Đang thêm hàng",
  CONFIRMED: "Đã xác nhận",
  IN_STORAGE: "Đã vào vị trí",
  IN_STAGING: "Ở khu chờ xuất",
  RELEASED: "Đã rời kho",
  CANCELLED: "Đã hủy",
};

export const PALLET_STATUS_TONE: Record<string, BadgeTone> = {
  EMPTY: "neutral",
  COUNTING: "warning",
  CONFIRMED: "info",
  IN_STORAGE: "success",
  IN_STAGING: "info",
  RELEASED: "neutral",
  CANCELLED: "error",
};

// ─── Location ────────────────────────────────────────────────
// Phase 5.1 (BUG_REPORT MD02 UC-MD-05): mapping label theo mockup khách hàng.
//   - USING: "Đang dùng" (trước là "Đang chứa")
//   - MAINTENANCE: "Khóa SD" (trước là "Bảo trì")
//   - NEEDS_CHECK: "Chờ kiểm kê" (trước là "Cần kiểm tra lại")
//   - CHECK_AGAIN (mới): "Cần kiểm tra lại"
//   - RESERVED + WAITING_OUTBOUND giữ nguyên cho luồng outbound nội bộ
export const LOCATION_STATUS_LABEL: Record<string, string> = {
  EMPTY: "Trống",
  USING: "Đang dùng",
  FULL: "Đầy",
  PARTIAL: "Còn một phần",
  MAINTENANCE: "Khóa SD",
  RESERVED: "Đã đặt trước",
  WAITING_OUTBOUND: "Chờ xuất",
  NEEDS_CHECK: "Chờ kiểm kê",
  CHECK_AGAIN: "Cần kiểm tra lại",
};

export const LOCATION_STATUS_TONE: Record<string, BadgeTone> = {
  EMPTY: "neutral",
  USING: "info",
  FULL: "error",
  PARTIAL: "warning",
  MAINTENANCE: "neutral",
  RESERVED: "info",
  WAITING_OUTBOUND: "warning",
  NEEDS_CHECK: "warning",
  CHECK_AGAIN: "error",
};

export const LOCATION_TYPE_LABEL: Record<string, string> = {
  STORAGE: "Vị trí chứa",
  INBOUND_STAGING: "Khu chờ nhập",
  OUTBOUND_STAGING: "Khu chờ xuất",
  STOCKTAKE: "Khu kiểm kê",
};

// ─── Inbound Request (PHN) ───────────────────────────────────
export const INBOUND_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ tiếp nhận",
  RECEIVING: "Đang nhập",
  RECONCILING: "Đang đối chiếu",
  COMPLETED: "Đã chốt",
  CANCELLED: "Đã hủy",
};

export const INBOUND_STATUS_TONE: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  PENDING: "warning",
  RECEIVING: "info",
  RECONCILING: "info",
  COMPLETED: "success",
  CANCELLED: "error",
};

// ─── Inbound Temp (PNT) ──────────────────────────────────────
export const INBOUND_TEMP_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ chuẩn hóa",
  STANDARDIZED: "Đã chuẩn hóa",
  REJECTED: "Từ chối",
};

export const INBOUND_TEMP_STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "warning",
  STANDARDIZED: "success",
  REJECTED: "error",
};

export const INBOUND_TEMP_SOURCE_LABEL: Record<string, string> = {
  SUPPLIER: "Nhà cung cấp",
  RETURN: "Hàng trả lại",
  OTHER: "Khác",
};

export const INBOUND_TEMP_REASON_LABEL: Record<string, string> = {
  EARLY: "Hàng về sớm",
  NOT_READY: "Chưa kịp lập phiếu",
  UNNOTIFIED_RETURN: "Hàng trả lại không báo trước",
  NEW_SUPPLIER: "NCC mới chưa khai báo",
  OTHER: "Khác",
};

// ─── Movement ────────────────────────────────────────────────
export const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  PUT_AWAY: "Đưa vào vị trí",
  RELOCATE: "Chuyển vị trí",
  STAGE_OUT: "Sang khu chờ xuất",
  RETURN: "Hoàn trả vị trí",
};

export const MOVEMENT_TYPE_TONE: Record<string, BadgeTone> = {
  PUT_AWAY: "success",
  RELOCATE: "info",
  STAGE_OUT: "warning",
  RETURN: "error",
};

export const MOVEMENT_TYPE_ICON: Record<string, string> = {
  PUT_AWAY: "📍",
  RELOCATE: "🔄",
  STAGE_OUT: "🚚",
  RETURN: "↩️",
};

export const MOVEMENT_MODE_LABEL: Record<string, string> = {
  FULL: "Rút nguyên pallet",
  PARTIAL: "Rút một phần",
};

export const MOVEMENT_REASON_CODE_LABEL: Record<string, string> = {
  PARTIAL_PICKED_RETURN: "Đã xuất một phần, trả lại số còn lại",
  PALLET_SPLIT: "Đổi pallet, tách dòng",
  WRONG_DETECT: "Phát hiện sai SL/Lô khi chuẩn bị xuất",
  OTHER: "Khác (xem ghi chú)",
};

// ─── Stocktake ───────────────────────────────────────────────
export const STOCKTAKE_TYPE_LABEL: Record<string, string> = {
  BY_LOCATION: "Theo vị trí",
  BY_ITEM: "Theo mã hàng",
};

export const STOCKTAKE_STATUS_LABEL: Record<string, string> = {
  OPEN: "Mở",
  COUNTING: "Đang đếm",
  RECONCILING: "Đang xử lý chênh",
  CLOSED: "Đã đóng",
};

// ─── Adjustment ──────────────────────────────────────────────
export const ADJUSTMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
};

export const ADJUSTMENT_STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "error",
};

export const ADJUSTMENT_TYPE_LABEL: Record<string, string> = {
  DECREASE: "Giảm tồn (hỏng/mất)",
  INCREASE: "Tăng tồn (thừa)",
  STOCKTAKE_RESOLVE: "Điều chỉnh sau kiểm kê",
};

export const ADJUSTMENT_REASON_CODE_LABEL: Record<string, string> = {
  BROKEN: "Hỏng/Vỡ",
  LOST: "Mất",
  STOCKTAKE: "Kiểm kê chấp nhận chênh lệch",
  OTHER: "Khác",
};

// ─── Outbound Request (PYX) ──────────────────────────────────
export const OUTBOUND_REQUEST_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ xuất",
  PICKING: "Đang lấy hàng",
  SHIPPED: "Đã xuất",
  CANCELLED: "Hủy",
};

export const OUTBOUND_REQUEST_STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "warning",
  PICKING: "info",
  SHIPPED: "success",
  CANCELLED: "error",
};

// ─── Outbound Rebalance ──────────────────────────────────────
export const OUTBOUND_REBALANCE_STATUS_LABEL: Record<string, string> = {
  PARSED: "Đã đọc file",
  PREVIEWED: "Đã xem trước",
  APPLIED: "Đã áp dụng",
  REJECTED: "Đã hủy",
};

export const OUTBOUND_REBALANCE_LINE_STATUS_LABEL: Record<string, string> = {
  MATCHED: "Khớp",
  OVER_STOCK: "SL vượt — xem lại",
  EXHAUSTED: "Xuất hết — gỡ pallet",
};

export const OUTBOUND_REBALANCE_LINE_STATUS_TONE: Record<string, BadgeTone> = {
  MATCHED: "success",
  OVER_STOCK: "error",
  EXHAUSTED: "info",
};

// ─── Role ────────────────────────────────────────────────────
export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  STAFF: "Nhân viên",
  QUAN_LY: "Quản lý",
  KE_TOAN: "Kế toán kho",
  THU_KHO: "Thủ kho",
  XE_NANG: "Xe nâng",
  KIEM_KE: "Người kiểm kê",
};

export const ROLE_SHORT_LABEL: Record<string, string> = {
  ADMIN: "ADM",
  MANAGER: "QL",
  STAFF: "NV",
  QUAN_LY: "QL",
  KE_TOAN: "KT",
  THU_KHO: "TK",
  XE_NANG: "XN",
  KIEM_KE: "KK",
};

// ─── Audit Action ────────────────────────────────────────────
// Mapping cho cột "Hành động" trong /system/audit-log và mọi nơi hiển thị log
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  // CRUD generic
  CREATE: "Tạo mới",
  UPDATE: "Cập nhật",
  DELETE: "Xóa",
  APPROVE: "Duyệt",
  REJECT: "Từ chối",
  CANCEL: "Hủy",
  // Pallet
  CREATE_PALLET: "Tạo pallet",
  ADD_PALLET_LINE: "Thêm dòng hàng",
  EDIT_PALLET_LINE: "Sửa dòng hàng",
  DELETE_PALLET_LINE: "Xóa dòng hàng",
  CONFIRM_PALLET: "Xác nhận pallet",
  UNLOCK_PALLET: "Mở khóa pallet để sửa",
  CANCEL_PALLET: "Hủy pallet",
  EDIT_PALLET_LINE_VIA_RETURN: "Sửa dòng (qua hoàn trả)",
  // Movement
  PUT_AWAY: "Đưa vào vị trí",
  RELOCATE: "Chuyển vị trí",
  STAGE_OUT: "Sang khu chờ xuất",
  STAGE_OUT_FULL: "Chuyển nguyên pallet ra khu chờ xuất",
  STAGE_OUT_PARTIAL: "Rút một phần ra khu chờ xuất",
  RETURN: "Hoàn trả vị trí",
  OUTBOUND: "Xuất kho",
  // Inbound
  CREATE_INBOUND: "Tạo phiếu nhập",
  SEND_INBOUND: "Gửi phiếu nhập",
  RECEIVE_INBOUND: "Tiếp nhận phiếu nhập",
  COMPLETE_INBOUND: "Chốt phiếu nhập",
  REQUEST_RECHECK: "Yêu cầu kiểm lại",
  // Adjustment
  CREATE_ADJUSTMENT: "Tạo phiếu điều chỉnh",
  APPROVE_ADJUSTMENT: "Duyệt phiếu điều chỉnh",
  REJECT_ADJUSTMENT: "Từ chối điều chỉnh",
  // Outbound
  CREATE_OUTBOUND_REQUEST: "Tạo phiếu yêu cầu xuất",
  START_PICKING: "Bắt đầu lấy hàng",
  SHIP_OUTBOUND: "Xác nhận xuất",
  CANCEL_OUTBOUND: "Hủy phiếu xuất",
  REBALANCE_APPLY: "Áp cân lại tồn",
  // Stocktake
  CREATE_STOCKTAKE: "Tạo phiên kiểm kê",
  COMPLETE_STOCKTAKE: "Hoàn tất kiểm kê",
  // Nhận hàng (chi tiết)
  START_RECEIVING: "Bắt đầu nhận hàng",
  COMPLETE_RECEIVING: "Hoàn tất nhận hàng",
  // Phiếu nhập tạm (PNT)
  STANDARDIZE_LINK_INBOUND: "Chuẩn hóa — liên kết phiếu nhập",
  STANDARDIZE_CREATE_INBOUND: "Chuẩn hóa — tạo phiếu nhập",
  REJECT_INBOUND_TEMP: "Từ chối phiếu nhập tạm",
  CREATE_SUPPLIER_FROM_TEMP: "Tạo NCC từ phiếu tạm",
  // Xuất kho / cân lại tồn
  SHIP: "Xuất kho",
  REBALANCE: "Cân lại tồn",
  // Xe nâng
  ASSIGN_DRIVER: "Giao việc tài xế",
  // Nhập Excel
  IMPORT_EXCEL: "Nhập từ Excel",
  CREATE_BY_IMPORT: "Tạo mới (Excel)",
  UPDATE_BY_IMPORT: "Cập nhật (Excel)",
  // Hệ thống
  UPDATE_RBAC_MATRIX: "Cập nhật phân quyền",
  UPDATE_PROFILE: "Cập nhật hồ sơ",
  LOGIN: "Đăng nhập",
};

export const AUDIT_ACTION_TONE: Record<string, BadgeTone> = {
  CREATE: "success",
  CREATE_PALLET: "info",
  CREATE_INBOUND: "info",
  CREATE_ADJUSTMENT: "info",
  CREATE_OUTBOUND_REQUEST: "info",
  CREATE_STOCKTAKE: "info",
  ADD_PALLET_LINE: "info",
  UPDATE: "info",
  EDIT_PALLET_LINE: "warning",
  EDIT_PALLET_LINE_VIA_RETURN: "warning",
  DELETE: "error",
  DELETE_PALLET_LINE: "error",
  APPROVE: "success",
  APPROVE_ADJUSTMENT: "success",
  REJECT: "error",
  REJECT_ADJUSTMENT: "error",
  CANCEL: "error",
  CANCEL_PALLET: "error",
  CANCEL_OUTBOUND: "error",
  CONFIRM_PALLET: "success",
  UNLOCK_PALLET: "warning",
  PUT_AWAY: "success",
  RELOCATE: "info",
  STAGE_OUT: "warning",
  STAGE_OUT_FULL: "warning",
  STAGE_OUT_PARTIAL: "warning",
  RETURN: "error",
  OUTBOUND: "warning",
  SHIP_OUTBOUND: "success",
  RECEIVE_INBOUND: "success",
  COMPLETE_INBOUND: "success",
  COMPLETE_STOCKTAKE: "success",
  REQUEST_RECHECK: "warning",
  REBALANCE_APPLY: "info",
  SEND_INBOUND: "info",
  START_PICKING: "info",
  START_RECEIVING: "info",
  COMPLETE_RECEIVING: "success",
  STANDARDIZE_LINK_INBOUND: "info",
  STANDARDIZE_CREATE_INBOUND: "info",
  REJECT_INBOUND_TEMP: "error",
  CREATE_SUPPLIER_FROM_TEMP: "info",
  SHIP: "warning",
  REBALANCE: "info",
  ASSIGN_DRIVER: "info",
  IMPORT_EXCEL: "info",
  CREATE_BY_IMPORT: "success",
  UPDATE_BY_IMPORT: "info",
  UPDATE_RBAC_MATRIX: "warning",
  UPDATE_PROFILE: "info",
  LOGIN: "success",
};

// ─── Entity Type ─────────────────────────────────────────────
// Mapping cho cột "Đối tượng" — entity_type của AuditLog & các nơi khác
export const ENTITY_TYPE_LABEL: Record<string, string> = {
  pallet: "Pallet",
  pallet_line: "Dòng hàng pallet",
  inbound_request: "Phiếu nhập",
  inbound_line: "Dòng phiếu nhập",
  inbound_temp: "Phiếu nhập tạm",
  outbound_request: "Phiếu yêu cầu xuất",
  outbound_rebalance: "Phiếu cân lại tồn",
  adjustment: "Phiếu điều chỉnh",
  adjustment_voucher: "Phiếu điều chỉnh",
  stocktake_session: "Phiên kiểm kê",
  stocktake_count: "Dòng kiểm kê",
  location: "Vị trí kho",
  item_code: "Mã hàng",
  product: "Sản phẩm",
  product_group: "Nhóm sản phẩm",
  supplier: "Nhà cung cấp",
  user: "Người dùng",
  movement: "Luân chuyển",
  system_config: "Cấu hình hệ thống",
};

// ─── Helpers ─────────────────────────────────────────────────
export function labelOf(map: Record<string, string>, key: string | null | undefined, fallback = "—"): string {
  if (!key) return fallback;
  return map[key] ?? key;
}

export function toneOf(map: Record<string, BadgeTone>, key: string | null | undefined, fallback: BadgeTone = "neutral"): BadgeTone {
  if (!key) return fallback;
  return map[key] ?? fallback;
}
