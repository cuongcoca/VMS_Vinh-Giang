import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

// GET /api/forklift/queue — Danh sách pallet chờ xếp vị trí (CONFIRMED) cho xe nâng
// UC-FK-01: trả thêm tổng SL, date gần nhất, inbound code, KPI 3 nhóm
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "forklift", "read");
  if (denied) return denied;
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

    // RELOCATE: pallet đang nằm trong vị trí chứa → xe nâng chọn để sắp xếp lại kho.
    //   UC-FK-03 không có khái niệm "lệnh luân chuyển" do người khác giao — luồng chính
    //   là xe nâng tự chọn pallet. Trước đây nhánh này trả mảng rỗng cứng nên tab
    //   "Luân chuyển" trên Trang chủ Xe nâng LUÔN trống dù kho đầy hàng.
    const relocateQuery = {
      where: { status: "IN_STORAGE" as const, location_id: { not: null } },
      orderBy: { updated_at: "desc" as const },
      take: 50,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        inbound_request: { select: { id: true, code: true } },
        location: { select: { id: true, code: true } },
        lines: {
          select: { qty_box: true, expiry_date: true },
        },
      },
    };

    // RETURN: pallet đang ở khu chờ xuất → có thể hoàn trả về vị trí chứa (UC-FK-05).
    //   Cùng nguyên nhân với RELOCATE: trước đây cũng trả mảng rỗng.
    const returnQuery = {
      where: { status: "IN_STAGING" as const },
      orderBy: { updated_at: "desc" as const },
      take: 50,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        inbound_request: { select: { id: true, code: true } },
        location: { select: { id: true, code: true } },
        lines: {
          select: { qty_box: true, expiry_date: true },
        },
      },
    };

    // TO_STAGING_OUT: các phiếu xuất đang trong trạng thái lấy hàng (PICKING)

    // KPI counts
    const [putAwayCount, inStorageCount, pickingRequestsCount, inStagingCount] = await Promise.all([
      prisma.pallet.count({ where: { status: "CONFIRMED" } }),
      prisma.pallet.count({ where: { status: "IN_STORAGE" } }),
      prisma.outboundRequest.count({ where: { status: "PICKING" } }),
      prisma.pallet.count({ where: { status: "IN_STAGING" } }),
    ]);

    // Mỗi KPI đếm ĐÚNG số việc đang có thể làm ở tab tương ứng.
    // Trước đây RELOCATE/RETURN đếm số Movement đã thực hiện trong 24h qua —
    // tức là hiển thị việc ĐÃ XONG dưới nhãn việc PHẢI LÀM.
    const kpis = {
      PUT_AWAY: putAwayCount,
      RELOCATE: inStorageCount,             // pallet đang trong kho, có thể sắp xếp lại
      TO_STAGING_OUT: pickingRequestsCount, // số phiếu xuất đang xử lý
      RETURN: inStagingCount,               // pallet ở khu chờ xuất, có thể hoàn trả
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
      taskType === "RELOCATE"
        ? await prisma.pallet.findMany(relocateQuery)
        : taskType === "RETURN"
        ? await prisma.pallet.findMany(returnQuery)
        : await prisma.pallet.findMany(putAwayQuery);

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
