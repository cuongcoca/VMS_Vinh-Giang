import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { STOCK_PALLET_STATUSES } from "@/lib/inventory-constants";
import { guardPermission } from "@/lib/auth-server";

// GET /api/stock-count/[id] — Chi tiết phiên kiểm kê + pallet lines per count
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardPermission(_req, "stock_count", "read");
  if (denied) return denied;
  try {
    const { id } = await params;
    const session = await prisma.stocktakeSession.findUnique({
      where: { id },
      include: {
        counts: {
          include: {
            location: { select: { id: true, code: true, zone: true, rack: true, level: true, type: true } },
            item_code: { select: { id: true, code: true, short_name: true, full_name: true } },
          },
          orderBy: { created_at: "asc" },
        },
      },
    });
    if (!session) return NextResponse.json({ success: false, error: "Không tìm thấy." }, { status: 404 });

    // Lấy các phiếu điều chỉnh tồn liên quan đến phiên kiểm kê đang chờ duyệt hoặc đã duyệt
    const adjustmentVouchers = await prisma.adjustmentVoucher.findMany({
      where: {
        stocktake_session_id: id,
        status: { in: ["PENDING", "APPROVED"] },
      },
      include: {
        lines: {
          select: {
            id: true,
            item_code_id: true,
            location_id: true,
            pallet_id: true,
          },
        },
      },
    });

    // Mở rộng: cho mỗi count, fetch pallet lines liên quan để hiển thị pallet code + lot + HSD
    // Bao gồm cả CONFIRMED (chờ xe nâng) và COUNTING để không bỏ sót hàng thực tế
    const STORAGE_STATUSES = ["IN_STORAGE", "IN_STAGING", "CONFIRMED", "COUNTING"] as const;
    const countsWithDetail = await Promise.all(
      session.counts.map(async (c) => {
        // Parse pallet code từ note (ví dụ: [Pallet: PL260611.013])
        const match = c.note?.match(/^\[Pallet:\s*([^\]]+)\]/);
        const palletCode = match ? match[1].trim() : null;

        // Build query: nếu có palletCode → filter theo pallet code
        //              nếu có location_id → filter theo vị trí
        //              nếu có item_code_id → filter theo mã hàng
        const where: Record<string, unknown> = {
          pallet: { status: { in: [...STORAGE_STATUSES] } },
        };

        if (palletCode) {
          (where.pallet as Record<string, unknown>) = {
            code: palletCode,
            status: { in: [...STORAGE_STATUSES] },
          };
          if (c.location_id) {
            (where.pallet as Record<string, unknown>).location_id = c.location_id;
          }
        } else if (c.location_id) {
          (where.pallet as Record<string, unknown>) = {
            location_id: c.location_id,
            status: { in: [...STORAGE_STATUSES] },
          };
        }

        if (c.item_code_id) {
          where.item_code_id = c.item_code_id;
        }

        // Nếu count không có location/item/pallet — bỏ qua (không query)
        if (!c.location_id && !c.item_code_id && !palletCode) {
          return { ...c, pallet_lines: [], adjusted: false, adjusted_voucher_code: null };
        }

        const lines = await prisma.palletLine.findMany({
          where,
          select: {
            id: true,
            qty_box: true,
            lot: true,
            expiry_date: true,
            manufactured_date: true,
            pallet: { select: { id: true, code: true } },
            item_code: { select: { id: true, code: true, short_name: true } },
          },
          orderBy: { expiry_date: { sort: "asc", nulls: "last" } },
        });

        // Đối chiếu xem dòng kiểm kê này đã được chấp nhận xử lý trong phiếu điều chỉnh nào chưa
        const cPalletId = lines[0]?.pallet?.id || null;
        const matchedVoucher = adjustmentVouchers.find((v) =>
          v.lines.some(
            (l) =>
              l.item_code_id === c.item_code_id &&
              l.location_id === c.location_id &&
              l.pallet_id === cPalletId
          )
        );

        return {
          ...c,
          pallet_lines: lines,
          adjusted: !!matchedVoucher,
          adjusted_voucher_code: matchedVoucher ? matchedVoucher.code : null,
        };
      })
    );

    const totalCounts = session.counts.length;
    const counted = session.counts.filter((c) => c.actual_qty !== null).length;
    const discrepancies = session.counts.filter(
      (c) => c.discrepancy !== null && Number(c.discrepancy) !== 0
    ).length;

    const systemQtyTotal = session.counts.reduce((s, c) => s + Number(c.system_qty || 0), 0);
    const actualQtyTotal = session.counts.reduce((s, c) => s + Number(c.actual_qty || 0), 0);
    const discrepancyTotal = session.counts.reduce(
      (s, c) => s + (c.discrepancy !== null ? Number(c.discrepancy) : 0),
      0
    );
    const progressPct = totalCounts > 0 ? Math.round((counted / totalCounts) * 100) : 0;

    const activeAdjustment = await prisma.adjustmentVoucher.findFirst({
      where: {
        stocktake_session_id: id,
        status: { in: ["PENDING", "APPROVED"] },
      },
      select: { id: true, code: true, status: true },
    });

    return NextResponse.json({
      success: true,
      data: { ...session, counts: countsWithDetail, activeAdjustment },
      stats: {
        totalCounts,
        counted,
        discrepancies,
        systemQtyTotal,
        actualQtyTotal,
        discrepancyTotal,
        progressPct,
      },
    });
  } catch (error) {
    console.error("GET /api/stock-count/[id] error:", error);
    const msg = error instanceof Error ? error.message : "Lỗi";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PUT /api/stock-count/[id] — Cập nhật SL thực đếm
// Fix #2: hỗ trợ cả batch (body.counts: [...]) và single (body.count_id)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardPermission(req, "stock_count", "write");
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await req.json();

    // Kiểm tra xem phiên kiểm kê có đang CLOSED hay không
    const session = await prisma.stocktakeSession.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!session) {
      return NextResponse.json({ success: false, error: "Không tìm thấy phiên kiểm kê." }, { status: 404 });
    }
    if (session.status === "CLOSED") {
      return NextResponse.json({ success: false, error: "Phiên kiểm kê đã đóng. Không thể cập nhật số lượng." }, { status: 400 });
    }

    // Detect format: batch hoặc single
    const isBatch = Array.isArray(body.counts);
    const items: Array<{
      count_id: string;
      actual_qty: number | string | null;
      note?: string;
      lot?: string | null;
      expiry_date?: string | null;
    }> = isBatch
      ? body.counts
      : [
          {
            count_id: body.count_id,
            actual_qty: body.actual_qty,
            note: body.note,
            lot: body.lot,
            expiry_date: body.expiry_date,
          },
        ];

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: "Không có count nào để cập nhật." }, { status: 400 });
    }

    // Validate tất cả count_id thuộc session
    const countIds = items.map((i) => i.count_id).filter(Boolean);
    if (countIds.length !== items.length) {
      return NextResponse.json({ success: false, error: "Thiếu count_id ở 1 hoặc nhiều dòng." }, { status: 400 });
    }
    const existing = await prisma.stocktakeCount.findMany({
      where: { id: { in: countIds }, session_id: id },
    });
    if (existing.length !== countIds.length) {
      return NextResponse.json(
        { success: false, error: "Một số count không thuộc phiên này hoặc không tồn tại." },
        { status: 400 }
      );
    }
    const countMap = new Map(existing.map((c) => [c.id, c]));

    // Guard: từ chối ghi đè nếu dòng đã có phiếu điều chỉnh PENDING/APPROVED
    // Tránh thủ kho sửa số liệu sau khi kế toán đã chốt phiếu điều chỉnh
    const adjustmentVouchers = await prisma.adjustmentVoucher.findMany({
      where: { stocktake_session_id: id, status: { in: ["PENDING", "APPROVED"] } },
      include: { lines: { select: { item_code_id: true, location_id: true, pallet_id: true } } },
    });

    if (adjustmentVouchers.length > 0) {
      // Lấy pallet lines liên quan để xác định pallet_id cho mỗi count
      const adjustedCountIds: string[] = [];
      for (const item of items) {
        const c = countMap.get(item.count_id)!;
        // Tìm pallet code từ note
        const palletMatch = c.note?.match(/^\[Pallet:\s*([^\]]+)\]/);
        const palletCode = palletMatch ? palletMatch[1].trim() : null;
        let palletId: string | null = null;
        if (palletCode) {
          const pallet = await prisma.pallet.findUnique({
            where: { code: palletCode },
            select: { id: true },
          });
          palletId = pallet?.id || null;
        }
        const isAdjusted = adjustmentVouchers.some((v) =>
          v.lines.some(
            (l) =>
              l.item_code_id === c.item_code_id &&
              l.location_id === c.location_id &&
              l.pallet_id === palletId
          )
        );
        if (isAdjusted) adjustedCountIds.push(item.count_id);
      }
      if (adjustedCountIds.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `${adjustedCountIds.length} dòng đã được kế toán chấp nhận và không thể sửa. Vui lòng liên hệ kế toán nếu cần điều chỉnh lại.`,
            adjusted_count_ids: adjustedCountIds,
          },
          { status: 400 }
        );
      }
    }

    // Update từng count trong transaction
    const now = new Date();
    const updates = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const it of items) {
        const c = countMap.get(it.count_id)!;
        // Cho phép chỉ sửa Lô/HSD/ghi chú mà chưa nhập SL thực:
        // nếu actual_qty rỗng/null → KHÔNG ghi đè SL & chênh lệch, chỉ cập nhật phần còn lại.
        const hasQty =
          it.actual_qty !== null && it.actual_qty !== undefined && String(it.actual_qty) !== "";
        const data: {
          actual_qty?: number;
          discrepancy?: number;
          note: string | null;
          lot_actual?: string | null;
          expiry_actual?: Date | null;
          counted_at: Date;
        } = {
          note: it.note?.trim() || null,
          lot_actual: it.lot !== undefined ? (it.lot?.trim() || null) : undefined,
          expiry_actual:
            it.expiry_date !== undefined
              ? (it.expiry_date ? new Date(it.expiry_date) : null)
              : undefined,
          counted_at: now,
        };
        if (hasQty) {
          const actualNum = Number(it.actual_qty);
          data.actual_qty = actualNum;
          data.discrepancy = actualNum - Number(c.system_qty);
        }
        const upd = await tx.stocktakeCount.update({ where: { id: it.count_id }, data });
        results.push(upd);

        // UC-INV: ÁP THẲNG Lô/HSD đã đếm vào pallet THẬT (theo yêu cầu nghiệp vụ — không qua duyệt).
        // Chỉ áp khi: không phải pallet ngoài HT, có mã hàng, và xác định được pallet/vị trí cụ thể.
        const wantLot = it.lot !== undefined;
        const wantExpiry = it.expiry_date !== undefined;
        if (!c.is_outside_system && c.item_code_id && (wantLot || wantExpiry)) {
          const palletMatch = c.note?.match(/^\[Pallet:\s*([^\]]+)\]/);
          const palletCode = palletMatch ? palletMatch[1].trim() : null;
          let palletFilter: Prisma.PalletWhereInput | null = null;
          if (palletCode) {
            palletFilter = { code: palletCode, status: { in: STOCK_PALLET_STATUSES } };
          } else if (c.location_id) {
            palletFilter = { location_id: c.location_id, status: { in: STOCK_PALLET_STATUSES } };
          }
          if (palletFilter) {
            const plData: { lot?: string | null; expiry_date?: Date | null } = {};
            if (wantLot) plData.lot = it.lot?.trim() || null;
            if (wantExpiry) plData.expiry_date = it.expiry_date ? new Date(it.expiry_date) : null;
            await tx.palletLine.updateMany({
              where: { item_code_id: c.item_code_id, pallet: palletFilter },
              data: plData,
            });
          }
        }
      }
      return results;
    });

    // Auto update session status → COUNTING (nếu chưa)
    await prisma.stocktakeSession.update({
      where: { id },
      data: { status: "COUNTING", started_at: new Date() },
    });

    return NextResponse.json({ success: true, data: updates, updated_count: updates.length });
  } catch (error) {
    console.error("PUT /api/stock-count/[id] error:", error);
    const msg = error instanceof Error ? error.message : "Lỗi";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
