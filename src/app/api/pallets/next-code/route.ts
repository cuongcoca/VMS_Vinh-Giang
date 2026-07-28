import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

// GET /api/pallets/next-code — Preview mã pallet sẽ sinh tiếp theo (PLYYMMDD.STT)
// UC-PAL-01: dùng để hiển thị mã preview trong form tạo pallet, KHÔNG cấp phát thật.
//   Do không lock → có thể lệch nếu nhiều người tạo song song. Mã thật sẽ được sinh khi POST.
export async function GET(req: Request) {
  const denied = await guardPermission(req, "pallet", "read");
  if (denied) return denied;
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const yy = String(today.getUTCFullYear()).slice(-2);
    const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(today.getUTCDate()).padStart(2, "0");

    const maxSeq = await prisma.pallet.aggregate({
      where: { code_date: today },
      _max: { code_seq: true },
    });
    const nextSeq = (maxSeq._max.code_seq ?? 0) + 1;
    const stt = String(nextSeq).padStart(3, "0");
    const code = `PL${yy}${mm}${dd}.${stt}`;

    return NextResponse.json({ success: true, data: { code, code_date: today.toISOString().slice(0, 10), code_seq: nextSeq } });
  } catch (error) {
    console.error("GET /api/pallets/next-code error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tính mã pallet kế tiếp." },
      { status: 500 }
    );
  }
}
