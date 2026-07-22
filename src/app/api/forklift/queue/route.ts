import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/forklift/queue — Danh sách pallet chờ xếp vị trí (CONFIRMED) cho xe nâng
// UC-FK-01: trả thêm tổng SL, date gần nhất, inbound code, KPI 3 nhóm
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskType = searchParams.get("task_type") || ""; // PUT_AWAY | RELOCATE | TO_STAGING_OUT | RETURN

    // PUT_AWAY: pallet CONFIRMED, chưa có location → chờ đưa vào vị trí
    const putAwayQuery = {
      where: { status: "CONFIRMED" as const },
      orderBy: { confirmed_at: "asc" as const },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        inbound_request: { select: { id: true, code: true } },
        location: { select: { id: true, code: true } },
        lines: {
          select: { qty_box: true, expiry_date: true },
        },
      },
    };

    // RELOCATE: pallet IN_STORAGE có pending move request (đang được lệnh chuyển)
    //   → đơn giản dùng status IN_STORAGE + movements pending
    // TO_STAGING_OUT: các phiếu xuất đang trong trạng thái lấy hàng (PICKING)
    // RETURN: pallet từ khu chờ xuất hoàn trả về vị trí lưu trữ

    // KPI counts
    const last24h = new Date(Date.now() - 24 * 3600 * 1000);
    const [putAwayCount, inStorageCount, pickingRequestsCount, relocate24h, return24h] = await Promise.all([
      prisma.pallet.count({ where: { status: "CONFIRMED" } }),
      prisma.pallet.count({ where: { status: "IN_STORAGE" } }),
      prisma.outboundRequest.count({ where: { status: "PICKING" } }),
      prisma.movement.count({
        where: { movement_type: "RELOCATE", performed_at: { gte: last24h } },
      }),
      prisma.movement.count({
        where: { movement_type: "RETURN", performed_at: { gte: last24h } },
      }),
    ]);

    const kpis = {
      PUT_AWAY: putAwayCount,
      RELOCATE: relocate24h,        // proxy: lệnh chuyển trong 24h qua
      TO_STAGING_OUT: pickingRequestsCount, // số phiếu xuất đang xử lý
      RETURN: return24h,             // proxy: hoàn trả vị trí trong 24h qua
      IN_STORAGE: inStorageCount,
    };

    if (taskType === "TO_STAGING_OUT") {
      const activeRequests = await prisma.outboundRequest.findMany({
        where: { status: "PICKING" },
        orderBy: { created_at: "asc" },
        include: {
          lines: { select: { id: true } }
        }
      });

      const data = activeRequests.map((req) => ({
        id: req.id,
        code: req.code,
        status: req.status,
        customer: req.customer,
        ship_date: req.ship_date,
        line_count: req.lines.length,
        created_at: req.created_at,
        is_outbound_task: true, // flag để nhận diện ở UI
      }));

      return NextResponse.json({ success: true, data, kpis });
    }

    const pallets: Awaited<ReturnType<typeof prisma.pallet.findMany>> =
      !taskType || taskType === "PUT_AWAY"
        ? await prisma.pallet.findMany(putAwayQuery)
        : []; // Stub: chưa có schema movements pending → trả mảng rỗng để không lỗi

    // Enrich với tổng SL + min HSD
    type LineLite = { qty_box: unknown; expiry_date: Date | null };
    const enriched = pallets.map((p) => {
      const lines = (p as unknown as { lines?: LineLite[] }).lines || [];
      const totalQty = lines.reduce((s, l) => s + Number(l.qty_box ?? 0), 0);
      const expiryDates = lines.map((l) => l.expiry_date).filter((d): d is Date => !!d);
      const nearestExpiry = expiryDates.length
        ? new Date(Math.min(...expiryDates.map((d) => new Date(d).getTime())))
        : null;
      return {
        ...p,
        total_qty: totalQty,
        nearest_expiry: nearestExpiry,
        line_count: lines.length,
        lines: undefined, // không trả về để response gọn
      };
    });

    return NextResponse.json({ success: true, data: enriched, kpis });
  } catch (error) {
    console.error("GET /api/forklift/queue error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tải danh sách." }, { status: 500 });
  }
}
