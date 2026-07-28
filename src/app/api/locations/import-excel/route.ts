import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LocationType } from "@prisma/client";
import { requirePermission, apiErrorResponse } from "@/lib/auth-server";

// UC-MD-05 / TC_LOC_001: Import vị trí kho từ Excel (bước 1 — phân tích & xem trước).
// Regex đồng bộ với /api/locations và /api/locations/bulk để file nhập tuân thủ
// đúng quy chuẩn mã Khu-Kệ-Tầng (vd: A-03-02).
const ZONE_REGEX = /^[A-Z]{1,3}$/;
const RACK_REGEX = /^\d{1,3}$/;
const LEVEL_REGEX = /^\d{1,2}$/;

function formatCode(zone: string, rack: string, level: string) {
  return `${zone}-${rack.padStart(2, "0")}-${level.padStart(2, "0")}`;
}

// Map nhãn tiếng Việt / enum key trong file Excel → LocationType (mặc định STORAGE).
function parseType(raw: string): LocationType {
  const t = raw.toLowerCase().trim();
  if (!t) return LocationType.STORAGE;
  if (t.includes("chờ nhập") || t.includes("cho nhap") || t === "inbound_staging") return LocationType.INBOUND_STAGING;
  if (t.includes("chờ xuất") || t.includes("cho xuat") || t === "outbound_staging") return LocationType.OUTBOUND_STAGING;
  if (t.includes("kiểm kê") || t.includes("kiem ke") || t === "stocktake") return LocationType.STOCKTAKE;
  return LocationType.STORAGE;
}

interface LocationExcelRow {
  row_index: number;
  code: string;
  zone: string;
  rack: string;
  level: string;
  type: LocationType;
  max_weight_kg: number | null;
  max_pallets: number | null;
  note: string;
  status: "NEW" | "WARNING" | "ERROR";
  status_message: string;
}

export async function POST(req: NextRequest) {
  try { await requirePermission(req, "location", "write"); } catch (e) { return apiErrorResponse(e); }
  try {
    const XLSX = await import("xlsx");
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "Vui lòng chọn file Excel để upload." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ success: false, error: "File Excel không có sheet nào." }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (rawData.length < 2) {
      return NextResponse.json({ success: false, error: "File Excel không có dữ liệu vị trí." }, { status: 400 });
    }

    // Nhận diện cột theo dòng tiêu đề (header).
    const headerRow = rawData[0].map((h) => String(h).toLowerCase().trim());
    let zoneCol = -1, rackCol = -1, levelCol = -1, typeCol = -1, weightCol = -1, palletCol = -1, noteCol = -1;

    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i];
      if (zoneCol === -1 && (h === "khu" || h.includes("khu vực") || h.includes("khu vuc") || h.includes("zone"))) zoneCol = i;
      else if (rackCol === -1 && (h === "kệ" || h === "ke" || h.includes("kệ") || h.includes("rack"))) rackCol = i;
      else if (levelCol === -1 && (h === "tầng" || h === "tang" || h.includes("tầng") || h.includes("level"))) levelCol = i;
      else if (typeCol === -1 && (h.includes("loại") || h.includes("loai") || h.includes("type"))) typeCol = i;
      else if (weightCol === -1 && (h.includes("tải") || h.includes("tai") || h.includes("trọng") || h.includes("trong") || h.includes("weight") || h.includes("kg"))) weightCol = i;
      else if (palletCol === -1 && h.includes("pallet")) palletCol = i;
      else if (noteCol === -1 && (h.includes("ghi chú") || h.includes("ghi chu") || h.includes("note"))) noteCol = i;
    }

    // TC_LOC_001: bắt buộc đúng template — phải có 3 cột Khu / Kệ / Tầng ở header,
    // chặn file rác (đổi đuôi .xlsx, sai mẫu) lọt qua như "import thành công".
    if (zoneCol === -1 || rackCol === -1 || levelCol === -1) {
      return NextResponse.json({
        success: false,
        error: "File không đúng định dạng mẫu nhập vị trí. File phải có cột Khu, Kệ và Tầng ở dòng tiêu đề. Vui lòng tải file mẫu và nhập đúng cột.",
      }, { status: 400 });
    }

    // Lấy toàn bộ mã vị trí đang có (kể cả đã ẩn) để đối chiếu trùng — vì cột code
    // là unique toàn cục, mã đã soft-delete vẫn chiếm chỗ và sẽ được kích hoạt lại.
    const existingLocations = await prisma.location.findMany({ select: { code: true } });
    const existingCodes = new Set(existingLocations.map((l) => l.code));

    const seenCodes = new Set<string>(); // chống trùng trong cùng một file
    const rows: LocationExcelRow[] = [];
    let newCount = 0, warningCount = 0, errorCount = 0;

    for (let r = 1; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || row.length === 0) continue;

      const zone = String(row[zoneCol] ?? "").trim().toUpperCase();
      const rack = String(row[rackCol] ?? "").trim();
      const level = String(row[levelCol] ?? "").trim();
      const typeRaw = typeCol !== -1 ? String(row[typeCol] ?? "").trim() : "";

      const rawWeight = weightCol !== -1 ? row[weightCol] : "";
      const max_weight_kg =
        rawWeight !== "" && rawWeight !== null && rawWeight !== undefined && !isNaN(Number(rawWeight))
          ? Number(rawWeight)
          : null;

      const rawPallet = palletCol !== -1 ? row[palletCol] : "";
      const max_pallets =
        rawPallet !== "" && rawPallet !== null && rawPallet !== undefined && !isNaN(Number(rawPallet))
          ? parseInt(String(rawPallet), 10)
          : null;

      const note = noteCol !== -1 ? String(row[noteCol] ?? "").trim() : "";

      // Bỏ qua dòng trống hoàn toàn.
      if (!zone && !rack && !level) continue;

      const type = parseType(typeRaw);
      let rowStatus: "NEW" | "WARNING" | "ERROR" = "NEW";
      let rowMsg = "Vị trí mới.";
      let code = "";

      if (!zone || !rack || !level) {
        rowStatus = "ERROR";
        rowMsg = "Thiếu Khu / Kệ / Tầng bắt buộc.";
      } else if (!ZONE_REGEX.test(zone)) {
        rowStatus = "ERROR";
        rowMsg = "Khu phải là chữ cái in hoa (1-3 ký tự, vd: A, B, ZA).";
      } else if (!RACK_REGEX.test(rack)) {
        rowStatus = "ERROR";
        rowMsg = "Kệ phải là chữ số (1-3 ký tự, vd: 1, 02, 10).";
      } else if (!LEVEL_REGEX.test(level)) {
        rowStatus = "ERROR";
        rowMsg = "Tầng phải là chữ số (1-2 ký tự, vd: 1, 05).";
      } else {
        code = formatCode(zone, rack, level);
        if (seenCodes.has(code)) {
          rowStatus = "ERROR";
          rowMsg = `Trùng mã "${code}" với dòng khác trong cùng file.`;
        } else if (existingCodes.has(code)) {
          rowStatus = "WARNING";
          rowMsg = `Trùng mã "${code}" — sẽ cập nhật/ghi đè cấu hình vị trí.`;
          seenCodes.add(code);
        } else {
          seenCodes.add(code);
        }
      }

      if (rowStatus === "NEW") newCount++;
      else if (rowStatus === "WARNING") warningCount++;
      else errorCount++;

      rows.push({
        row_index: r + 1,
        code: code || `${zone}-${rack}-${level}`,
        zone,
        rack,
        level,
        type,
        max_weight_kg,
        max_pallets,
        note,
        status: rowStatus,
        status_message: rowMsg,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        rows,
        summary: { total: rows.length, new: newCount, warning: warningCount, error: errorCount },
      },
    });
  } catch (error) {
    console.error("POST /api/locations/import-excel error:", error);
    return NextResponse.json({ success: false, error: "Lỗi hệ thống khi xử lý file Excel." }, { status: 500 });
  }
}
