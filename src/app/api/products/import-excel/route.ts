import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

interface ProductExcelRow {
  row_index: number;
  sku: string;
  barcode: string;
  name: string;
  short_name: string;
  group_name: string;
  unit_name: string;
  specification: string;
  weight_per_box: number | null;
  volume_per_box: number | null;
  manage_lot: boolean;
  manage_expiry: boolean;
  status: "NEW" | "WARNING" | "ERROR";
  status_message: string;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "Vui lòng chọn file Excel để upload." }, { status: 400 });
    }

    // Đọc buffer từ file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ success: false, error: "File Excel không có sheet nào." }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    if (rawData.length < 2) {
      return NextResponse.json({ success: false, error: "File Excel không có dữ liệu sản phẩm." }, { status: 400 });
    }

    // Phân tích header row
    const headerRow = rawData[0].map(h => String(h).toLowerCase().trim());
    
    let skuCol = -1;
    let nameCol = -1;
    let barcodeCol = -1;
    let shortNameCol = -1;
    let groupCol = -1;
    let unitCol = -1;
    let specCol = -1;
    let weightCol = -1;
    let volumeCol = -1;
    let lotCol = -1;
    let expCol = -1;

    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i];
      if (skuCol === -1 && (h.includes("sku") || h.includes("mã sản phẩm") || h.includes("ma san pham") || h.includes("mã hàng") || h.includes("ma hang"))) skuCol = i;
      else if (nameCol === -1 && (h.includes("tên sản phẩm") || h.includes("ten san pham") || h.includes("tên hàng") || h.includes("ten hang") || h === "tên" || h === "ten" || h === "name")) nameCol = i;
      else if (barcodeCol === -1 && (h.includes("barcode") || h.includes("mã vạch") || h.includes("ma vach"))) barcodeCol = i;
      else if (shortNameCol === -1 && (h.includes("tên rút gọn") || h.includes("ten rut gon") || h.includes("tên ngắn") || h.includes("short name"))) shortNameCol = i;
      else if (groupCol === -1 && (h.includes("nhóm") || h.includes("nhom") || h.includes("group"))) groupCol = i;
      else if (unitCol === -1 && (h.includes("đvt") || h.includes("đơn vị tính") || h.includes("don vi tinh") || h.includes("đơn vị") || h.includes("unit"))) unitCol = i;
      else if (specCol === -1 && (h.includes("quy cách") || h.includes("quy cach") || h.includes("specification") || h === "spec")) specCol = i;
      else if (weightCol === -1 && (h.includes("trọng lượng") || h.includes("trong luong") || h.includes("khối lượng") || h.includes("khoi luong") || h.includes("weight") || h.includes("box weight") || h.includes("nặng"))) weightCol = i;
      else if (volumeCol === -1 && (h.includes("thể tích") || h.includes("the tich") || h.includes("volume"))) volumeCol = i;
      else if (lotCol === -1 && (h.includes("lô") || h.includes("lot") || h.includes("quản lý lô"))) lotCol = i;
      else if (expCol === -1 && (h.includes("hạn") || h.includes("expiry") || h.includes("hsd") || h.includes("hạn dùng"))) expCol = i;
    }

    // TC_ADD_017: validate đúng template nhập sản phẩm. Trước đây fallback skuCol=0/nameCol=1
    // map cột theo VỊ TRÍ kể cả khi header không nhận diện được — khiến file rác (CSV đổi đuôi
    // .xlsx, header sai template) vẫn parse được và import "thành công". Bắt buộc header phải
    // có cột Mã sản phẩm (SKU) VÀ Tên sản phẩm thì mới chấp nhận file.
    if (skuCol === -1 || nameCol === -1) {
      return NextResponse.json({
        success: false,
        error: "File không đúng định dạng mẫu nhập sản phẩm. File phải có cột Mã sản phẩm (SKU) và Tên sản phẩm ở dòng tiêu đề. Vui lòng tải file mẫu và nhập đúng cột.",
      }, { status: 400 });
    }

    // Lấy toàn bộ sản phẩm hiện tại để đối chiếu SKU
    const existingProducts = await prisma.product.findMany({ select: { sku: true } });
    const existingSkus = new Set(existingProducts.map(p => p.sku.toLowerCase()));

    // Lấy toàn bộ ĐVT & Nhóm sản phẩm để đối chiếu
    const allGroups = await prisma.productGroup.findMany({ select: { name: true } });
    const existingGroups = new Set(allGroups.map(g => g.name.toLowerCase()));
    
    const allUnits = await prisma.unitOfMeasure.findMany({ select: { name: true } });
    const existingUnits = new Set(allUnits.map(u => u.name.toLowerCase()));

    const rows: ProductExcelRow[] = [];
    let newCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    // Phân tích các hàng dữ liệu
    for (let r = 1; r < rawData.length; r++) {
      const row = rawData[r];
      if (row.length === 0) continue;

      const sku = skuCol !== -1 ? String(row[skuCol] ?? "").trim() : "";
      const name = nameCol !== -1 ? String(row[nameCol] ?? "").trim() : "";
      const barcode = barcodeCol !== -1 ? String(row[barcodeCol] ?? "").trim() : "";
      const shortName = shortNameCol !== -1 ? String(row[shortNameCol] ?? "").trim() : "";
      const groupName = groupCol !== -1 ? String(row[groupCol] ?? "").trim() : "";
      const unitName = unitCol !== -1 ? String(row[unitCol] ?? "").trim() : "";
      const specification = specCol !== -1 ? String(row[specCol] ?? "").trim() : "";
      
      const rawWeight = weightCol !== -1 ? row[weightCol] : "";
      const weight_per_box = rawWeight !== "" && rawWeight !== null && rawWeight !== undefined ? Number(rawWeight) : null;

      const rawVolume = volumeCol !== -1 ? row[volumeCol] : "";
      const volume_per_box = rawVolume !== "" && rawVolume !== null && rawVolume !== undefined ? Number(rawVolume) : null;

      const rawLot = lotCol !== -1 ? String(row[lotCol] ?? "").toLowerCase().trim() : "";
      const manage_lot = rawLot === "1" || rawLot === "yes" || rawLot === "true" || rawLot === "x" || rawLot.includes("có") || rawLot.includes("co");

      const rawExp = expCol !== -1 ? String(row[expCol] ?? "").toLowerCase().trim() : "";
      const manage_expiry = rawExp === "1" || rawExp === "yes" || rawExp === "true" || rawExp === "x" || rawExp.includes("có") || rawExp.includes("co");

      // Bỏ dòng hoàn toàn trống
      if (!sku && !name) continue;

      let rowStatus: "NEW" | "WARNING" | "ERROR" = "NEW";
      let rowMsg = "Sản phẩm mới.";

      // Validation các trường bắt buộc
      if (!sku) {
        rowStatus = "ERROR";
        rowMsg = "Thiếu SKU bắt buộc.";
      } else if (!name) {
        rowStatus = "ERROR";
        rowMsg = "Thiếu Tên sản phẩm bắt buộc.";
      } else {
        // Đối chiếu SKU trùng
        if (existingSkus.has(sku.toLowerCase())) {
          rowStatus = "WARNING";
          rowMsg = "Trùng SKU — Sẽ cập nhật/ghi đè thông tin sản phẩm.";
        }

        // Kiểm tra Group và Unit xem có tự tạo mới không
        const notes = [];
        if (groupName && !existingGroups.has(groupName.toLowerCase())) {
          notes.push(`Tự tạo Nhóm: "${groupName}"`);
        }
        if (unitName && !existingUnits.has(unitName.toLowerCase())) {
          notes.push(`Tự tạo ĐVT: "${unitName}"`);
        }

        if (notes.length > 0) {
          rowMsg += " (" + notes.join(", ") + ")";
        }
      }

      if (rowStatus === "NEW") newCount++;
      else if (rowStatus === "WARNING") warningCount++;
      else if (rowStatus === "ERROR") errorCount++;

      rows.push({
        row_index: r + 1,
        sku,
        barcode,
        name,
        short_name: shortName,
        group_name: groupName,
        unit_name: unitName,
        specification,
        weight_per_box,
        volume_per_box,
        manage_lot,
        manage_expiry,
        status: rowStatus,
        status_message: rowMsg,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        rows,
        summary: {
          total: rows.length,
          new: newCount,
          warning: warningCount,
          error: errorCount,
        }
      }
    });
  } catch (error) {
    console.error("POST /api/products/import-excel error:", error);
    return NextResponse.json({ success: false, error: "Lỗi hệ thống khi xử lý file Excel." }, { status: 500 });
  }
}
