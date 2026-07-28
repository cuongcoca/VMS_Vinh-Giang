import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

// GET /api/pallets/by-item?item_code_id=…&inbound_request_id=…
// Liệt kê các pallet (chưa hủy) của MỘT phiếu đang chứa MỘT mã hàng, kèm SL từng pallet.
// Dùng cho màn thêm hàng: khi badge báo "đã đủ / còn N", thủ kho bấm để thấy
// "SL đó đang nằm ở pallet nào" → dễ soi trùng/nhầm và sửa.
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "pallet", "read");
  if (denied) return denied;
  try {
    const itemCodeId = req.nextUrl.searchParams.get("item_code_id") || "";
    const inboundRequestId = req.nextUrl.searchParams.get("inbound_request_id") || "";
    if (!itemCodeId) {
      return NextResponse.json({ success: false, error: "Thiếu item_code_id." }, { status: 400 });
    }

    // Dòng pallet có mã này. Ưu tiên gán theo dòng (hướng A); nếu không truyền phiếu
    // thì lấy mọi pallet chứa mã (phạm vi rộng hơn cho tra cứu chung).
    const lines = await prisma.palletLine.findMany({
      where: {
        item_code_id: itemCodeId,
        pallet: { status: { not: "CANCELLED" } },
        ...(inboundRequestId
          ? {
              // Dòng gán về phiếu này HOẶC pallet có phiếu gốc là phiếu này
              // (bắt cả dữ liệu cũ chưa gán phiếu ở cấp dòng).
              OR: [
                { inbound_request_id: inboundRequestId },
                { inbound_request_id: null, pallet: { inbound_request_id: inboundRequestId } },
              ],
            }
          : {}),
      },
      select: {
        qty_box: true,
        lot: true,
        expiry_date: true,
        pallet: {
          select: {
            id: true,
            code: true,
            status: true,
            location: { select: { code: true } },
          },
        },
      },
      orderBy: { pallet: { code: "asc" } },
    });

    // Gom theo pallet (một pallet có thể có nhiều dòng cùng mã khác lô).
    type Row = { pallet_id: string; pallet_code: string; status: string; location_code: string | null; qty_box: number };
    const byPallet = new Map<string, Row>();
    for (const l of lines) {
      const p = l.pallet;
      const cur = byPallet.get(p.id);
      if (cur) cur.qty_box += Number(l.qty_box);
      else
        byPallet.set(p.id, {
          pallet_id: p.id,
          pallet_code: p.code,
          status: p.status,
          location_code: p.location?.code ?? null,
          qty_box: Number(l.qty_box),
        });
    }
    const data = Array.from(byPallet.values());
    const total = data.reduce((s, r) => s + r.qty_box, 0);

    return NextResponse.json({ success: true, data, total });
  } catch (error) {
    console.error("GET /api/pallets/by-item error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tra cứu pallet theo mã." }, { status: 500 });
  }
}
