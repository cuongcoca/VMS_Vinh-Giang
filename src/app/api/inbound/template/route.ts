import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { guardPermission } from "@/lib/auth-server";

/**
 * GET /api/inbound/template
 * Trả về file Excel template cho UC-IN-01 (tab "Up file Excel" nội dòng).
 * Cột chuẩn: Mã hàng · Tên · SL · ĐVT · Ghi chú.
 */
export async function GET(req: Request) {
  const denied = await guardPermission(req, "inbound", "read");
  if (denied) return denied;
  try {
    // Sheet template với 1 hàng header + 2 hàng ví dụ
    const data = [
      ["Mã hàng", "Tên hàng", "SL (thùng)", "ĐVT lẻ", "Ghi chú"],
      ["VG-NM-001", "Nước mắm 500ml", 500, "chai", "Lô mới"],
      ["VG-TT-002", "Tương ớt 250g", 300, "chai", ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    ws["!cols"] = [
      { wch: 20 }, // Mã hàng
      { wch: 35 }, // Tên hàng
      { wch: 12 }, // SL
      { wch: 12 }, // ĐVT
      { wch: 30 }, // Ghi chú
    ];

    // Bold header row
    const headerRange = ["A1", "B1", "C1", "D1", "E1"];
    for (const cell of headerRange) {
      if (ws[cell]) ws[cell].s = { font: { bold: true } };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Phiếu nhập");

    // Sheet hướng dẫn
    const guideData = [
      ["HƯỚNG DẪN NHẬP PHIẾU YÊU CẦU NHẬP"],
      [""],
      ["1. Sheet 'Phiếu nhập' là sheet dữ liệu chính."],
      ["2. Dòng 1 là tiêu đề — KHÔNG sửa thứ tự cột."],
      ["3. Mã hàng phải khớp với mã đang có trong hệ thống (nếu không có sẽ tạo mã tạm)."],
      ["4. SL (thùng) là số nguyên dương."],
      ["5. ĐVT lẻ là đơn vị nhỏ (chai/gói/lon...) — tùy chọn."],
      ["6. Ghi chú là tùy chọn."],
      [""],
      ["File mẫu này tự sinh, không sửa cấu trúc — chỉ nhập dữ liệu vào sheet 'Phiếu nhập'."],
    ];
    const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
    wsGuide["!cols"] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, "Hướng dẫn");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="template_phieu_nhap.xlsx"`,
      },
    });
  } catch (error) {
    console.error("GET /api/inbound/template error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tạo file template." },
      { status: 500 }
    );
  }
}
