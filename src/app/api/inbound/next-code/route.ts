import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CODE_PREFIX, formatYearlyCode } from "@/lib/codegen";

/**
 * GET /api/inbound/next-code
 * Trả về mã phiếu nhập tiếp theo (preview, KHÔNG tạo record).
 * Dùng cho UC-IN-01 hiển thị "Mã phiếu (auto)" disabled trên form tạo.
 */
export async function GET() {
  try {
    const year = new Date().getFullYear();
    const maxSeq = await prisma.inboundRequest.aggregate({
      where: { code_year: year },
      _max: { code_seq: true },
    });
    const nextSeq = (maxSeq._max.code_seq ?? 0) + 1;
    const code = formatYearlyCode(CODE_PREFIX.INBOUND_REQUEST, year, nextSeq);
    return NextResponse.json({ success: true, data: { code, year, seq: nextSeq } });
  } catch (error) {
    console.error("GET /api/inbound/next-code error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi sinh mã phiếu tiếp theo." },
      { status: 500 }
    );
  }
}
