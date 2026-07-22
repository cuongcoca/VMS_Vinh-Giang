import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// UC-IN-06: mapping nhóm BU cho file Unilever "Hàng U về"
const BU_LABELS: Record<string, string> = {
  HC: "Home Care",
  BE: "Beauty",
  PC: "Personal Care",
  F: "Foods",
};

interface ExcelRow {
  row_index: number;
  excel_code: string;
  excel_name: string;
  excel_qty: number | null;
  excel_weight_kg?: number | null;  // UC-IN-06: trọng lượng cột mới
  bu_group?: string | null;          // UC-IN-06: nhóm BU (HC/BE/PC/F)
  match_status: "matched" | "similar" | "unmatched";
  matched_item?: { id: string; code: string; short_name: string };
  suggestions?: { id: string; code: string; short_name: string }[];
}

// POST /api/inbound/import-excel — Upload & parse file Excel
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const supplierId = formData.get("supplier_id") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Vui lòng chọn file Excel để upload." },
        { status: 400 }
      );
    }

    // Đọc buffer từ file upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });

    // Đọc sheet đầu tiên
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { success: false, error: "File Excel không có sheet nào." },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    // Chuyển sang JSON dạng array of arrays (không header)
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    if (rawData.length < 2) {
      return NextResponse.json(
        { success: false, error: "File Excel không có dữ liệu (cần ít nhất 1 hàng header + 1 hàng dữ liệu)." },
        { status: 400 }
      );
    }

    // Xác định cột: tìm header row (dòng đầu tiên)
    // Mặc định: col 0 = STT hoặc Mã hàng, col 1 = Mã hàng hoặc Tên, col 2 = Tên hoặc SL
    // Heuristic: tìm cột chứa "mã" và cột chứa "tên" và cột chứa "số lượng/SL"
    const headerRow = rawData[0].map((h) => String(h).toLowerCase().trim());

    let codeCol = -1;
    let nameCol = -1;
    let qtyCol = -1;
    let weightCol = -1;  // UC-IN-06: trọng lượng (kg)
    let buCol = -1;      // UC-IN-06: BU (HC/BE/PC/F)

    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i];
      if (codeCol === -1 && (h.includes("mã") || h.includes("ma") || h.includes("code"))) {
        codeCol = i;
      } else if (nameCol === -1 && (h.includes("tên") || h.includes("ten") || h.includes("name") || h.includes("hàng") || h.includes("hang"))) {
        nameCol = i;
      } else if (qtyCol === -1 && (h.includes("sl") || h.includes("số lượng") || h.includes("so luong") || h.includes("qty") || h.includes("quantity") || h.includes("thùng") || h.includes("thung"))) {
        qtyCol = i;
      } else if (weightCol === -1 && (h.includes("trọng lượng") || h.includes("trong luong") || h.includes("kg") || h.includes("weight"))) {
        weightCol = i;
      } else if (buCol === -1 && (h === "bu" || h.includes(" bu") || h.includes("nhóm bu") || h.includes("nhom bu") || h.includes("business unit"))) {
        buCol = i;
      }
    }

    // Fallback: nếu không tìm được thì dùng col A=0, B=1, C=2
    if (codeCol === -1) codeCol = 0;
    if (nameCol === -1) nameCol = codeCol + 1;
    if (qtyCol === -1) qtyCol = nameCol + 1;

    // Lấy tất cả ItemCode từ DB để so khớp
    const allItemCodes = await prisma.itemCode.findMany({
      select: { id: true, code: true, short_name: true },
    });

    // Map code → item cho exact match
    const codeMap = new Map(allItemCodes.map((ic) => [ic.code.toLowerCase(), ic]));

    const rows: ExcelRow[] = [];

    // Duyệt từ dòng 2 trở đi (bỏ header)
    for (let r = 1; r < rawData.length; r++) {
      const row = rawData[r];
      const excelCode = String(row[codeCol] ?? "").trim();
      const excelName = String(row[nameCol] ?? "").trim();
      const rawQty = row[qtyCol];
      const excelQty = rawQty !== "" && rawQty !== null && rawQty !== undefined
        ? Number(rawQty)
        : null;
      const rawWeight = weightCol >= 0 ? row[weightCol] : null;
      const excelWeight = rawWeight !== "" && rawWeight !== null && rawWeight !== undefined
        ? Number(rawWeight)
        : null;
      const buGroup = buCol >= 0 ? String(row[buCol] ?? "").trim().toUpperCase() || null : null;

      // Bỏ qua dòng trống
      if (!excelCode && !excelName) continue;

      // Tìm kiếm exact match
      const exactMatch = codeMap.get(excelCode.toLowerCase());
      const baseRow = {
        row_index: r + 1,
        excel_code: excelCode,
        excel_name: excelName,
        excel_qty: excelQty,
        excel_weight_kg: excelWeight,
        bu_group: buGroup,
      };
      if (exactMatch) {
        rows.push({
          ...baseRow,
          match_status: "matched",
          matched_item: {
            id: exactMatch.id,
            code: exactMatch.code,
            short_name: exactMatch.short_name,
          },
        });
        continue;
      }

      // Tìm kiếm tương tự (contains)
      const similar = allItemCodes.filter(
        (ic) =>
          ic.code.toLowerCase().includes(excelCode.toLowerCase()) ||
          excelCode.toLowerCase().includes(ic.code.toLowerCase()) ||
          ic.short_name.toLowerCase().includes(excelName.toLowerCase()) ||
          excelName.toLowerCase().includes(ic.short_name.toLowerCase())
      );

      if (similar.length > 0) {
        rows.push({
          ...baseRow,
          match_status: "similar",
          suggestions: similar.slice(0, 5).map((s) => ({
            id: s.id,
            code: s.code,
            short_name: s.short_name,
          })),
        });
        continue;
      }

      // Không khớp
      rows.push({
        ...baseRow,
        match_status: "unmatched",
      });
    }

    // UC-IN-06: summary theo nhóm BU + tổng trọng lượng
    const byBuMap = new Map<string, { sku: number; qty: number; weight: number }>();
    for (const r of rows) {
      const bu = r.bu_group || "(Khác)";
      const cur = byBuMap.get(bu) || { sku: 0, qty: 0, weight: 0 };
      cur.sku += 1;
      cur.qty += r.excel_qty || 0;
      cur.weight += r.excel_weight_kg || 0;
      byBuMap.set(bu, cur);
    }
    const byBu = Array.from(byBuMap.entries()).map(([code, v]) => ({
      bu_code: code,
      bu_label: BU_LABELS[code] || code,
      sku_count: v.sku,
      total_qty_box: v.qty,
      total_weight_kg: v.weight,
    })).sort((a, b) => b.total_qty_box - a.total_qty_box);

    const totalQty = rows.reduce((s, r) => s + (r.excel_qty || 0), 0);
    const totalWeight = rows.reduce((s, r) => s + (r.excel_weight_kg || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        rows,
        summary: {
          total: rows.length,
          matched: rows.filter((r) => r.match_status === "matched").length,
          similar: rows.filter((r) => r.match_status === "similar").length,
          unmatched: rows.filter((r) => r.match_status === "unmatched").length,
          total_qty_box: totalQty,
          total_weight_kg: totalWeight,
          by_bu: byBu,
        },
        supplier_id: supplierId || null,
      },
    });
  } catch (error) {
    console.error("POST /api/inbound/import-excel error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi xử lý file Excel." },
      { status: 500 }
    );
  }
}
