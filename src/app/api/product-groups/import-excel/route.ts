import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { logAudit } from "@/lib/audit";

// POST /api/product-groups/import-excel — Import nhóm hàng từ Excel
//
// Phase 5.4 — TC_GROUP_001: trang Quản lý nhóm hàng thiếu chức năng Import.
// File Excel expected 2 cột: "Tên nhóm" (bắt buộc), "Mô tả" (tùy chọn).
// Skip dòng trùng tên (đã tồn tại trong DB), upsert insert mới.
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Vui lòng chọn file Excel để upload." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { success: false, error: "File Excel không có sheet nào." },
        { status: 400 }
      );
    }
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    if (rows.length < 2) {
      return NextResponse.json(
        { success: false, error: "File Excel không có dữ liệu nhóm hàng." },
        { status: 400 }
      );
    }

    // Detect cột Tên + Mô tả
    const headerRow = rows[0].map((h) => String(h).toLowerCase().trim());
    let nameCol = -1;
    let descCol = -1;
    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i];
      if (nameCol === -1 && (h.includes("tên nhóm") || h.includes("ten nhom") || h.includes("tên") || h === "name")) {
        nameCol = i;
      } else if (descCol === -1 && (h.includes("mô tả") || h.includes("mo ta") || h.includes("description"))) {
        descCol = i;
      }
    }

    if (nameCol === -1) {
      return NextResponse.json(
        {
          success: false,
          error: "Không tìm thấy cột 'Tên nhóm' trong file. Header chấp nhận: Tên nhóm, Mô tả.",
        },
        { status: 400 }
      );
    }

    // Lấy danh sách nhóm hiện có để dedup theo name
    const existing = await prisma.productGroup.findMany({ select: { name: true } });
    const existingNames = new Set(existing.map((g) => g.name.trim().toLowerCase()));

    const toCreate: { name: string; description: string | null }[] = [];
    const skipped: { row: number; name: string; reason: string }[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const rawName = String(row[nameCol] ?? "").trim();
      if (!rawName) continue;
      const description = descCol >= 0 ? String(row[descCol] ?? "").trim() || null : null;

      if (existingNames.has(rawName.toLowerCase())) {
        skipped.push({ row: r + 1, name: rawName, reason: "Đã tồn tại" });
        continue;
      }
      // Dedup trong file
      if (toCreate.some((g) => g.name.toLowerCase() === rawName.toLowerCase())) {
        skipped.push({ row: r + 1, name: rawName, reason: "Trùng tên trong file" });
        continue;
      }
      toCreate.push({ name: rawName, description });
      existingNames.add(rawName.toLowerCase());
    }

    let createdCount = 0;
    if (toCreate.length > 0) {
      const result = await prisma.productGroup.createMany({
        data: toCreate.map((g) => ({ name: g.name, description: g.description, is_active: true })),
        skipDuplicates: true,
      });
      createdCount = result.count;
    }

    await logAudit(req, {
      entity_type: "product_group",
      entity_id: "00000000-0000-0000-0000-000000000000",
      action: "IMPORT_EXCEL",
      new_value: {
        file_name: file.name,
        total_rows: rows.length - 1,
        created_count: createdCount,
        skipped_count: skipped.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        total_rows: rows.length - 1,
        created_count: createdCount,
        skipped_count: skipped.length,
        skipped,
      },
    });
  } catch (error) {
    console.error("POST /api/product-groups/import-excel error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi đọc file Excel." },
      { status: 500 }
    );
  }
}
