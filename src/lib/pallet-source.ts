// WVG-97 / WMS-008 — Nguồn truy vết của pallet (discriminator + id).
// Dùng chung cho các route tạo pallet + màn by-pallet.

export type PalletSourceType =
  | "INBOUND"
  | "INBOUND_TEMP"
  | "SPLIT"
  | "ADJUSTMENT"
  | "EXCEPTION";

// Nhãn tiếng Việt để hiển thị.
export const PALLET_SOURCE_LABEL: Record<PalletSourceType, string> = {
  INBOUND: "Phiếu nhập (PHN)",
  INBOUND_TEMP: "Phiếu nhập tạm",
  SPLIT: "Tách từ pallet cha",
  ADJUSTMENT: "Điều chỉnh / Kiểm kê",
  EXCEPTION: "Ngoại lệ (không có phiếu nguồn)",
};

export interface PalletSourceValue {
  source_type: PalletSourceType;
  source_id: string | null;
  source_note: string | null;
}

/**
 * Suy ra nguồn khi TẠO pallet từ các link truyền vào (POST /api/pallets):
 * ưu tiên PHN → phiếu tạm → còn lại là EXCEPTION (tạo thủ công chưa gán phiếu).
 * EXCEPTION luôn kèm lý do để thoả ràng buộc DB.
 */
export function deriveCreateSource(input: {
  inbound_request_id?: string | null;
  inbound_temp_id?: string | null;
}): PalletSourceValue {
  if (input.inbound_request_id) {
    return { source_type: "INBOUND", source_id: input.inbound_request_id, source_note: null };
  }
  if (input.inbound_temp_id) {
    return { source_type: "INBOUND_TEMP", source_id: input.inbound_temp_id, source_note: null };
  }
  return {
    source_type: "EXCEPTION",
    source_id: null,
    source_note: "Tạo thủ công, chưa gán phiếu nguồn",
  };
}

/**
 * Kiểm tính hợp lệ của bộ nguồn (khớp CHECK constraint DB):
 * != EXCEPTION phải có source_id; EXCEPTION phải có source_note.
 */
export function isValidSource(v: PalletSourceValue): boolean {
  if (v.source_type === "EXCEPTION") return !!(v.source_note && v.source_note.trim());
  return !!v.source_id;
}
