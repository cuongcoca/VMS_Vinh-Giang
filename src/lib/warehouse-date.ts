// WVG-98 / WMS-009 — Ngày kho theo múi giờ Việt Nam (GMT+7).
// Việt Nam KHÔNG có DST → offset cố định +7h (khớp convention `now + 7h` sẵn có
// trong codebase). Dùng cho MỌI chỗ sinh mã theo ngày (pallet PLYYMMDD, PHN năm)
// để mã không lệch 1 ngày khi tạo gần nửa đêm giờ VN (UTC lùi 1 ngày).

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface WarehouseDateParts {
  yy: string; // 2 số cuối của năm (vd "26")
  mm: string; // tháng 2 chữ số
  dd: string; // ngày 2 chữ số
  year: number; // năm đầy đủ theo giờ VN (vd 2026)
  codeDate: Date; // ngày kho chuẩn hoá = nửa đêm VN, biểu diễn bằng UTC-midnight → khớp cột @db.Date + where-clause
  dayKey: string; // key advisory lock theo ngày kho: "pallet_seq_YYMMDD"
}

/**
 * Trả về các thành phần ngày KHO (GMT+7) từ một thời điểm (mặc định = bây giờ).
 * Dùng để sinh mã `PL{yy}{mm}{dd}.{seq}` + code_date + dayKey đồng nhất.
 */
export function warehouseDateParts(d: Date = new Date()): WarehouseDateParts {
  const vn = new Date(d.getTime() + VN_OFFSET_MS);
  const year = vn.getUTCFullYear();
  const month = vn.getUTCMonth() + 1;
  const day = vn.getUTCDate();
  const yy = String(year).slice(-2);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  // Ngày kho chuẩn hoá: UTC-midnight của NGÀY VN → khi lưu vào cột @db.Date sẽ ra
  // đúng ngày VN, và where-clause seq so khớp chính xác.
  const codeDate = new Date(Date.UTC(year, month - 1, day));
  return { yy, mm, dd, year, codeDate, dayKey: `pallet_seq_${yy}${mm}${dd}` };
}
