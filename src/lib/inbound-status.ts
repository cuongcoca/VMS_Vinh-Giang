// WVG-131 / WMS-005 — Trạng thái phiếu nhập & ánh xạ tiến trình.
// Backend có ĐÚNG 6 status (state machine thực tế). Trước đây UI map lên thang
// "8 bước" của mockup → nhảy số 1→2→4→7→8. Đồng bộ về 5 bước TUYẾN TÍNH khớp
// implementation; CANCELLED là trạng thái kết thúc riêng (không nằm trên thanh
// tiến trình). KHÔNG đổi enum/DB (giữ nguyên technical contract).

export type InboundStatus =
  | "DRAFT"
  | "PENDING"
  | "RECEIVING"
  | "RECONCILING"
  | "COMPLETED"
  | "CANCELLED";

// Tổng số bước tiến trình tuyến tính (DRAFT→…→COMPLETED).
export const INBOUND_TOTAL_STEPS = 5;

// Ánh xạ status → bước (LIÊN TIẾP, không hở) + nhãn hiển thị.
// CANCELLED = step 0 (kết thúc, tách khỏi thanh tiến trình).
export const INBOUND_STATUS_STEP: Record<InboundStatus, { step: number; label: string }> = {
  DRAFT: { step: 1, label: "Nháp — chờ gửi" },
  PENDING: { step: 2, label: "Chờ tiếp nhận" },
  RECEIVING: { step: 3, label: "Đang nhận hàng" },
  RECONCILING: { step: 4, label: "Đang đối chiếu" },
  COMPLETED: { step: 5, label: "Đã chốt" },
  CANCELLED: { step: 0, label: "Đã hủy" },
};

export function inboundStep(status: string): { step: number; label: string } {
  return INBOUND_STATUS_STEP[status as InboundStatus] ?? { step: 0, label: status };
}
