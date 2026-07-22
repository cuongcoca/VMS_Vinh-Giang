import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CODE_PREFIX, formatYearlyCode } from "@/lib/codegen";

// GET /api/inbound-temp/next-code — Preview mã phiếu tạm kế tiếp (PNT-YYYY-SSSS).
//
// CT-1 fix (2026-05-28): đổi prefix PTT → PNT khớp mockup.
// Race condition giữa preview và POST vẫn tồn tại (INB-010) — fix Sprint 1.
export async function GET() {
  try {
    const year = new Date().getFullYear();
    const maxSeq = await prisma.inboundTemp.aggregate({
      where: { code_year: year },
      _max: { code_seq: true },
    });
    const nextSeq = (maxSeq._max.code_seq ?? 0) + 1;
    const code = formatYearlyCode(CODE_PREFIX.INBOUND_TEMP, year, nextSeq);
    return NextResponse.json({ success: true, data: { code, code_year: year, code_seq: nextSeq } });
  } catch (error) {
    console.error("GET /api/inbound-temp/next-code error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi sinh mã phiếu tạm." },
      { status: 500 }
    );
  }
}
