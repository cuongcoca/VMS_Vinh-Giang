import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { guardPermission } from "@/lib/auth-server";

// UC-OUT-05_TC03/04/06 — Tải phiếu yêu cầu xuất (PYX) từ file Excel/CSV.
// Đọc file → đối chiếu mã hàng với hệ thống → preview (dry_run) hoặc tạo OutboundRequest.

interface PreviewRow {
  row_index: number;
  excel_code: string;
  excel_name: string;          // tên ghi trong file (nếu có)
  system_name: string;         // tên trong hệ thống (đối chiếu) — TC06
  excel_qty: number | null;
  note: string;
  found: boolean;
  item_code_id: string | null;
}

// Sinh mã PYX-YYYY-NNNN (giống POST /api/outbound/requests)
async function generateCode(): Promise<{ code: string; codeYear: number; codeSeq: number }> {
  const year = new Date().getFullYear();
  const maxSeq = await prisma.outboundRequest.aggregate({
    where: { code_year: year },
    _max: { code_seq: true },
  });
  const nextSeq = (maxSeq._max.code_seq ?? 0) + 1;
  return { code: `PYX-${year}-${String(nextSeq).padStart(4, "0")}`, codeYear: year, codeSeq: nextSeq };
}

const FORMAT_ERROR =
  "File không đúng định dạng. Cần file Excel/CSV theo template (cột: Mã hàng, SL yêu cầu, Ghi chú).";

export async function POST(req: NextRequest) {
  const denied = await guardPermission(req, "outbound", "write");
  if (denied) return denied;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const customer = ((formData.get("customer") as string) || "").trim();
    const shipDate = ((formData.get("ship_date") as string) || "").trim();
    const note = ((formData.get("note") as string) || "").trim();
    const dryRun = String(formData.get("dry_run") || "true") === "true";

    if (!file) {
      return NextResponse.json({ success: false, error: "Vui lòng chọn file để tải lên." }, { status: 400 });
    }

    // === Parse file (xlsx hoặc csv) ===
    let rawData: unknown[][];
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return NextResponse.json({ success: false, error: FORMAT_ERROR }, { status: 400 });
      }
      rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
    } catch {
      // File hỏng / không đọc được → coi như sai định dạng (TC04)
      return NextResponse.json({ success: false, error: FORMAT_ERROR }, { status: 400 });
    }

    // TC04: file rỗng / chỉ có header → sai định dạng
    if (!rawData || rawData.length < 2) {
      return NextResponse.json({ success: false, error: FORMAT_ERROR }, { status: 400 });
    }

    // Tìm cột: Mã hàng / SL yêu cầu / Tên / Ghi chú
    const headerRow = rawData[0].map((h) => String(h).toLowerCase().trim());
    let codeCol = -1, qtyCol = -1, nameCol = -1, noteCol = -1;
    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i];
      if (codeCol === -1 && (h.includes("mã") || h.includes("ma ") || h === "ma" || h.includes("code"))) codeCol = i;
      else if (qtyCol === -1 && (h.includes("sl") || h.includes("số lượng") || h.includes("so luong") || h.includes("yêu cầu") || h.includes("yeu cau") || h.includes("qty") || h.includes("quantity"))) qtyCol = i;
      else if (nameCol === -1 && (h.includes("tên") || h.includes("ten") || h.includes("name"))) nameCol = i;
      else if (noteCol === -1 && (h.includes("ghi chú") || h.includes("ghi chu") || h.includes("note"))) noteCol = i;
    }

    // TC04: thiếu cột bắt buộc Mã hàng hoặc SL → sai định dạng
    if (codeCol === -1 || qtyCol === -1) {
      return NextResponse.json({ success: false, error: FORMAT_ERROR }, { status: 400 });
    }

    // Lấy toàn bộ ItemCode để đối chiếu (exact match theo code)
    const allItemCodes = await prisma.itemCode.findMany({
      select: { id: true, code: true, short_name: true },
    });
    const codeMap = new Map(allItemCodes.map((ic) => [ic.code.toLowerCase(), ic]));

    const rows: PreviewRow[] = [];
    for (let r = 1; r < rawData.length; r++) {
      const row = rawData[r];
      const excelCode = String(row[codeCol] ?? "").trim();
      const excelName = nameCol >= 0 ? String(row[nameCol] ?? "").trim() : "";
      const rawQty = row[qtyCol];
      const excelQty = rawQty !== "" && rawQty !== null && rawQty !== undefined ? Number(rawQty) : null;
      const rowNote = noteCol >= 0 ? String(row[noteCol] ?? "").trim() : "";

      // Bỏ qua dòng trống hoàn toàn
      if (!excelCode && !excelName && (excelQty === null || excelQty === 0)) continue;

      const match = codeMap.get(excelCode.toLowerCase());
      rows.push({
        row_index: r + 1,
        excel_code: excelCode,
        excel_name: excelName,
        system_name: match ? match.short_name : "",
        excel_qty: excelQty,
        note: rowNote,
        found: !!match,
        item_code_id: match ? match.id : null,
      });
    }

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: FORMAT_ERROR }, { status: 400 });
    }

    const matched = rows.filter((r) => r.found && r.excel_qty != null && r.excel_qty > 0);
    const summary = {
      total: rows.length,
      matched: matched.length,
      unmatched: rows.length - matched.length,
      total_qty: matched.reduce((s, r) => s + (r.excel_qty || 0), 0),
    };

    // === DRY RUN: chỉ trả preview để đối chiếu (TC06) ===
    if (dryRun) {
      return NextResponse.json({ success: true, data: { rows, summary, file_name: file.name } });
    }

    // === CREATE: tạo phiếu PYX thật ===
    if (!customer) {
      return NextResponse.json({ success: false, error: "Thiếu tên khách hàng." }, { status: 400 });
    }
    if (matched.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không có dòng hàng hợp lệ (mã hàng không khớp hệ thống hoặc SL không hợp lệ)." },
        { status: 400 }
      );
    }

    const { code, codeYear, codeSeq } = await generateCode();
    const created = await prisma.outboundRequest.create({
      data: {
        code, code_year: codeYear, code_seq: codeSeq,
        status: "PENDING",
        customer,
        ship_date: shipDate ? new Date(shipDate) : null,
        note: note || `Tạo từ file Excel: ${file.name}`,
        lines: {
          create: matched.map((r) => ({
            item_code_id: r.item_code_id as string,
            qty_requested: new Prisma.Decimal(Number(r.excel_qty)),
            note: r.note || null,
          })),
        },
      },
      include: { lines: { include: { item_code: { select: { code: true, short_name: true } } } } },
    });

    return NextResponse.json(
      { success: true, data: created, summary: { ...summary, skipped: summary.unmatched } },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/outbound/requests/import error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi xử lý file phiếu yêu cầu xuất." }, { status: 500 });
  }
}
