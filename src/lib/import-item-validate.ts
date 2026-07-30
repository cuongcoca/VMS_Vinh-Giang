// WVG-63 / WMS-003 — Pre-validate TOÀN batch cho import tạo mã hàng (không ghi DB).
//
// Mục tiêu (review 78/100 · P1): validate cả batch TRƯỚC khi ghi, gom HẾT lỗi trả
// một lần. Kết hợp với việc bọc writes trong 1 transaction ở route → negative case
// KHÔNG để lại dữ liệu một phần (mã tạm rác).
//
// Hàm này THUẦN (chỉ tính toán, không chạm DB) để unit-test được. Các kiểm tra cần
// DB (item_code_id tồn tại, mã tạm đã có) do route đọc thêm rồi gộp vào cùng errors.

import { assertNotAccount } from "./item-code-guard";

// Mã hàng: chỉ chữ, số, - _ . / (chặn '@' và ký tự lạ) — đồng bộ POST /api/item-codes.
export const ITEM_CODE_RE = /^[A-Za-z0-9\-_./]+$/;

export interface ImportLineInput {
  item_code_id?: string;
  excel_code?: string;
  excel_name?: string;
  qty_expected: number | string;
  lot?: string;
  expiry_date?: string;
  create_temp_code?: boolean;
}

// Kế hoạch xử lý 1 dòng (sau pre-validate) — route dùng để dựng writes trong tx.
export type LinePlan =
  | { kind: "mapped"; item_code_id: string; qty_expected: number; lot?: string; expiry_date?: string }
  | { kind: "temp"; temp_code: string; temp_name: string; qty_expected: number; lot?: string; expiry_date?: string };

export interface PrevalidateResult {
  errors: string[];   // gom hết lỗi kèm số dòng (rỗng = hợp lệ)
  plan: LinePlan[];    // chỉ dùng khi errors rỗng
  tempCodes: string[]; // danh sách mã tạm DISTINCT cần tạo (đã trim, giữ lần xuất hiện đầu)
}

/**
 * Pre-validate toàn bộ dòng import. KHÔNG chạm DB.
 * @param lines danh sách dòng từ payload confirm.
 * @param userIdentitySet tập danh tính tài khoản (email/phone/username/full_name đã chuẩn hoá) để chặn account.
 */
export function prevalidateImportLines(
  lines: ImportLineInput[],
  userIdentitySet: Set<string>
): PrevalidateResult {
  const errors: string[] = [];
  const plan: LinePlan[] = [];
  const tempSeen = new Map<string, true>();

  lines.forEach((line, idx) => {
    const n = idx + 1;
    const qty = Number(line.qty_expected);
    if (!qty || qty <= 0) {
      errors.push(`Dòng ${n}: Số lượng dự kiến phải > 0.`);
    }

    if (line.create_temp_code && !line.item_code_id) {
      // Dòng tạo mã tạm → validate code + tên + chặn account.
      const tempCode = (line.excel_code ?? "").trim();
      const tempName = (line.excel_name ?? "").trim();
      if (!tempCode) {
        errors.push(`Dòng ${n}: Cần excel_code để tạo mã hàng tạm.`);
      } else {
        if (!ITEM_CODE_RE.test(tempCode)) {
          errors.push(`Dòng ${n}: Mã hàng "${tempCode}" chứa ký tự không hợp lệ (chỉ chữ, số, - _ . /).`);
        }
        const codeErr = assertNotAccount(tempCode, userIdentitySet, "Mã hàng");
        if (codeErr) errors.push(`Dòng ${n}: ${codeErr}`);
        const nameErr = assertNotAccount(tempName, userIdentitySet, "Tên hàng");
        if (nameErr) errors.push(`Dòng ${n}: ${nameErr}`);
      }
      if (qty > 0 && tempCode && ITEM_CODE_RE.test(tempCode)
          && !assertNotAccount(tempCode, userIdentitySet, "Mã hàng")
          && !assertNotAccount(tempName, userIdentitySet, "Tên hàng")) {
        if (!tempSeen.has(tempCode)) tempSeen.set(tempCode, true);
        plan.push({ kind: "temp", temp_code: tempCode, temp_name: tempName || tempCode, qty_expected: qty, lot: line.lot, expiry_date: line.expiry_date });
      }
    } else if (line.item_code_id) {
      // Dòng đã map sẵn mã. (Kiểm tra tồn tại làm ở route — cần DB.)
      if (qty > 0) {
        plan.push({ kind: "mapped", item_code_id: line.item_code_id, qty_expected: qty, lot: line.lot, expiry_date: line.expiry_date });
      }
    } else {
      errors.push(`Dòng ${n}: Thiếu mã hàng (item_code_id hoặc create_temp_code).`);
    }
  });

  return { errors, plan, tempCodes: [...tempSeen.keys()] };
}
