import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CODE_PREFIX, formatYearlyCode } from "@/lib/codegen";
import { notifyByRoles } from "@/lib/notifications";

// GET /api/stock-count?status=OPEN|COUNTING|RECONCILING|CLOSED — Danh sách phiên kiểm kê
// Fix #3: hỗ trợ filter status; #4: trả thêm discrepancies count cho mobile tasks
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || "";
    const allowed = ["OPEN", "COUNTING", "RECONCILING", "CLOSED"];

    const where: Record<string, unknown> = {};
    if (status && allowed.includes(status)) {
      where.status = status;
    }

    const sessions = await prisma.stocktakeSession.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        counts: {
          select: { id: true, actual_qty: true, discrepancy: true, system_qty: true },
        },
      },
    });
    const result = sessions.map((s) => {
      const total = s.counts.length;
      const counted = s.counts.filter((c) => c.actual_qty !== null).length;
      const discrepancies = s.counts.filter(
        (c) => c.discrepancy !== null && Number(c.discrepancy) !== 0
      ).length;
      const progressPct = total > 0 ? Math.round((counted / total) * 100) : 0;
      return {
        ...s,
        total_counts: total,
        counted,
        discrepancies,
        progress: progressPct,
      };
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("GET /api/stock-count error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

// POST /api/stock-count — Tạo phiên kiểm kê mới
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, note, location_ids, item_code_ids } = body;

    if (!type || !["BY_LOCATION", "BY_ITEM"].includes(type)) {
      return NextResponse.json({ success: false, error: "Loại kiểm kê không hợp lệ." }, { status: 400 });
    }

    // Sinh mã: STK-YYYY-NNNN (CT-1: prefix KK → STK, pad 3 → 4 digit theo mockup)
    const year = new Date().getFullYear();
    const count = await prisma.stocktakeSession.count({
      where: { code: { startsWith: `${CODE_PREFIX.STOCKTAKE_SESSION}-${year}` } },
    });
    const code = formatYearlyCode(CODE_PREFIX.STOCKTAKE_SESSION, year, count + 1);

    const countsData: {
      location_id?: string;
      item_code_id?: string;
      system_qty: number;
      lot_actual?: string | null;
      expiry_actual?: Date | null;
      note?: string | null;
    }[] = [];

    if (type === "BY_LOCATION" && location_ids?.length) {
      // Lấy thông tin loại vị trí để xử lý đặc biệt cho OUTBOUND_STAGING
      const locationDetails = await prisma.location.findMany({
        where: { id: { in: location_ids } },
        select: { id: true, type: true, code: true },
      });
      const locationTypeMap = new Map(locationDetails.map((l) => [l.id, l.type]));

      for (const locId of location_ids) {
        const palletLines = await prisma.palletLine.findMany({
          // Bao gồm cả CONFIRMED (chờ xe nâng) và COUNTING (đang kiểm kê) để không bỏ sót hàng thực tế tại vị trí
          where: { pallet: { location_id: locId, status: { in: ["IN_STORAGE", "IN_STAGING", "CONFIRMED", "COUNTING"] } } },
          include: { pallet: true },
        });

        // Đặc biệt: vị trí OUTBOUND_STAGING → lấy thêm pallet IN_STAGING không có location_id
        // (pallet đã stage-out nhưng xe nâng không chọn slot vị trí cụ thể)
        let floatingLines: typeof palletLines = [];
        const locType = locationTypeMap.get(locId);
        if (locType === "OUTBOUND_STAGING") {
          floatingLines = await prisma.palletLine.findMany({
            where: { pallet: { location_id: null, status: "IN_STAGING" } },
            include: { pallet: true },
          });
        }

        const allLines = [...palletLines, ...floatingLines];

        if (allLines.length === 0) {
          // Vị trí trống -> tạo 1 count đại diện
          countsData.push({ location_id: locId, system_qty: 0 });
        } else {
          // Tách riêng từng pallet line
          for (const pl of allLines) {
            countsData.push({
              location_id: locId,
              item_code_id: pl.item_code_id,
              system_qty: Number(pl.qty_box),
              lot_actual: pl.lot || null,
              expiry_actual: pl.expiry_date ? new Date(pl.expiry_date) : null,
              note: `[Pallet: ${pl.pallet.code}]`,
            });
          }
        }
      }
    } else if (type === "BY_ITEM" && item_code_ids?.length) {
      for (const icId of item_code_ids) {
        const palletLines = await prisma.palletLine.findMany({
          // Bao gồm cả CONFIRMED (chờ xe nâng) và COUNTING (đang kiểm kê) để không bỏ sót hàng thực tế
          where: { item_code_id: icId, pallet: { status: { in: ["IN_STORAGE", "IN_STAGING", "CONFIRMED", "COUNTING"] } } },
          include: { pallet: true },
        });
        if (palletLines.length === 0) {
          // SKU không có tồn kho -> tạo 1 count đại diện
          countsData.push({ item_code_id: icId, system_qty: 0 });
        } else {
          // Tách riêng từng pallet line
          for (const pl of palletLines) {
            countsData.push({
              item_code_id: icId,
              location_id: pl.pallet.location_id || undefined,
              system_qty: Number(pl.qty_box),
              lot_actual: pl.lot || null,
              expiry_actual: pl.expiry_date ? new Date(pl.expiry_date) : null,
              note: `[Pallet: ${pl.pallet.code}]`,
            });
          }
        }
      }
    }

    if (countsData.length === 0) {
      return NextResponse.json({ success: false, error: "Không có vị trí/mã hàng nào để kiểm kê." }, { status: 400 });
    }

    const session = await prisma.stocktakeSession.create({
      data: {
        code, type, note: note?.trim() || null,
        status: "OPEN",
        counts: { create: countsData },
      },
      include: { counts: true },
    });

    // Notify THU_KHO khi tạo phiên kiểm kê
    notifyByRoles(["THU_KHO"], {
      type: "STOCKTAKE_CREATED",
      title: `Kiểm kê mới: ${code}`,
      body: `Phiên kiểm kê ${code} (${type === "BY_LOCATION" ? "theo vị trí" : "theo mã hàng"}, ${countsData.length} mục).`,
      entity_type: "stocktake_session",
      entity_id: session.id,
      link_url: `/thukho/warehouse/stocktake`,
    }).catch((err) => console.error("notifyByRoles STOCKTAKE_CREATED:", err));

    // Notify KIEM_KE (nguoi kiem ke) — link toi man kiem ke cua ho
    notifyByRoles(["KIEM_KE"], {
      type: "STOCKTAKE_CREATED",
      title: `Kiểm kê mới: ${code}`,
      body: `Bạn có phiên kiểm kê ${code} (${type === "BY_LOCATION" ? "theo vị trí" : "theo mã hàng"}, ${countsData.length} mục) cần thực hiện.`,
      entity_type: "stocktake_session",
      entity_id: session.id,
      link_url: `/kiemke/tasks/${session.id}`,
    }).catch((err) => console.error("notifyByRoles KIEM_KE STOCKTAKE_CREATED:", err));

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error("POST /api/stock-count error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tạo phiên kiểm kê." }, { status: 500 });
  }
}
