import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";

// Helper: Sinh mã pallet PLYYMMDD.STT
// UC-PAL-01: phải race-safe khi nhiều thủ kho cùng tạo → dùng advisory lock theo ngày
async function generatePalletCode(
  tx: Prisma.TransactionClient,
  baseDate?: Date
): Promise<{ code: string; codeDate: Date; codeSeq: number }> {
  const today = baseDate ? new Date(baseDate) : new Date();
  today.setUTCHours(0, 0, 0, 0);

  const yy = String(today.getUTCFullYear()).slice(-2);
  const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(today.getUTCDate()).padStart(2, "0");
  const dayKey = `pallet_seq_${yy}${mm}${dd}`;

  // Advisory lock theo dayKey — chỉ chặn các transaction cùng đang sinh mã pallet cùng ngày
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dayKey}))`;

  const maxSeq = await tx.pallet.aggregate({
    where: { code_date: today },
    _max: { code_seq: true },
  });
  const nextSeq = (maxSeq._max.code_seq ?? 0) + 1;
  const stt = String(nextSeq).padStart(3, "0");
  const code = `PL${yy}${mm}${dd}.${stt}`;

  return { code, codeDate: today, codeSeq: nextSeq };
}

// GET /api/pallets — Danh sách pallet + tìm kiếm + lọc
// Phase 3.5 (BUG_REPORT TC_HISTORY_PAL_002/_003): hỗ trợ filter theo
// ngày tạo (from/to) và nhà cung cấp.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "";
    const supplierId = searchParams.get("supplier_id") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    // `limit` để màn hình mobile lấy ít bản ghi khi đang gõ tìm kiếm.
    // Mặc định giữ 200 như cũ để không đổi hành vi các màn hình đang gọi.
    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 200;
    // KPI phải groupBy toàn bảng pallet — rất tốn khi gõ tìm kiếm liên tục.
    const skipKpis = searchParams.get("skip_kpis") === "1";

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }
    if (supplierId) {
      where.supplier_id = supplierId;
    }
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setUTCHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }
      where.created_at = dateFilter;
    }
    if (q) {
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { note: { contains: q, mode: "insensitive" } },
        // Xe nâng nghĩ theo KỆ chứ không theo mã pallet — cho tìm luôn bằng mã vị trí
        // (vd gõ "B-24" ra mọi pallet đang nằm ở kệ B-24).
        { location: { code: { contains: q, mode: "insensitive" } } },
      ];
    }

    const pallets = await prisma.pallet.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, zone: true, rack: true, level: true } },
        inbound_request: { select: { id: true, code: true } },  // UC-PAL-01: link PHN
        movements: {
          where: { movement_type: "STAGE_OUT" },
          orderBy: { performed_at: "desc" },
          take: 1,
          select: { performed_at: true },
        },
      },
      take: limit,
    });

    const mapped = pallets.map((p) => {
      const stageMv = p.movements?.[0];
      const stagedAt = stageMv ? stageMv.performed_at : null;
      return {
        ...p,
        totalLines: p.total_lines,
        totalWeightKg: Number(p.total_weight_kg),
        inboundRequestId: p.inbound_request_id,
        createdAt: p.created_at,
        stagedAt: stagedAt,
        staged_at: stagedAt,
      };
    });

    // KPIs — bỏ qua khi client không cần (vd ô lọc nhanh gọi liên tục lúc gõ).
    const kpis: Record<string, number> = {};
    if (!skipKpis) {
      const allPallets = await prisma.pallet.groupBy({
        by: ["status"],
        _count: true,
      });
      let total = 0;
      for (const g of allPallets) {
        kpis[g.status] = g._count;
        total += g._count;
      }
      kpis.TOTAL = total;
    }

    return NextResponse.json({ success: true, data: mapped, kpis });
  } catch (error) {
    console.error("GET /api/pallets error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tải danh sách pallet." },
      { status: 500 }
    );
  }
}

// POST /api/pallets — Tạo pallet mới (tự sinh mã PLYYMMDD.STT)
// UC-PAL-01: hỗ trợ link `inbound_request_id` (PHN-xxx) + default status COUNTING
// + Phương án A: auto-populate PalletLine từ InboundLine của phiếu (nếu link PHN)
//   Body option: `auto_populate_lines: boolean` (default true)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      supplier_id,
      inbound_date,
      inbound_request_id,
      inbound_temp_id,
      note,
      receive_date,
      auto_populate_lines = true,
    } = body;

    // Validate supplier_id (nếu có)
    if (supplier_id) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplier_id },
      });
      if (!supplier || !supplier.is_active) {
        return NextResponse.json(
          { success: false, error: "Nhà cung cấp không tồn tại hoặc ngừng hoạt động." },
          { status: 400 }
        );
      }
    }

    // Validate inbound_request_id hoặc inbound_temp_id + auto-fill supplier
    let resolvedSupplierId: string | null = supplier_id || null;
    let inboundLinesToCopy: Array<{
      item_code_id: string;
      qty_expected: Prisma.Decimal;
      lot: string | null;
      expiry_date: Date | null;
      note: string | null;
      item_code: { weight_per_box: Prisma.Decimal | null; units_per_box: number } | null;
    }> = [];
    let existingPalletsCount = 0;

    if (inbound_request_id) {
      const ir = await prisma.inboundRequest.findUnique({
        where: { id: inbound_request_id },
        select: { id: true, supplier_id: true, status: true },
      });
      if (!ir) {
        return NextResponse.json(
          { success: false, error: "Phiếu nhập không tồn tại." },
          { status: 400 }
        );
      }
      if (!resolvedSupplierId && ir.supplier_id) resolvedSupplierId = ir.supplier_id;

      // Count pallet hiện có cho PHN này (loại trừ CANCELLED)
      existingPalletsCount = await prisma.pallet.count({
        where: {
          inbound_request_id,
          status: { not: "CANCELLED" },
        },
      });

      // MÔ HÌNH CỘNG DỒN (fix 1 phiếu — nhiều pallet):
      // KHÔNG auto-copy toàn bộ dòng hàng của phiếu vào pallet nữa. MỌI pallet của phiếu
      // (kể cả pallet đầu tiên) đều bắt đầu TRỐNG. Thủ kho thêm đúng phần hàng thực xếp
      // lên từng pallet; màn thêm dòng hiển thị "còn lại theo phiếu" (ĐK − đã lên pallet).
      // → tránh cảnh "pallet 1 ôm hết 10 mã phải xóa bớt, pallet 2 trống không rõ còn gì".
      // Nhánh phiếu tạm đột xuất (inbound_temp) GIỮ NGUYÊN cơ chế cũ ở dưới.
    } else if (inbound_temp_id) {
      const temp = await prisma.inboundTemp.findUnique({
        where: { id: inbound_temp_id },
        select: { id: true, supplier_id: true, status: true },
      });
      if (!temp) {
        return NextResponse.json(
          { success: false, error: "Phiếu tạm không tồn tại." },
          { status: 400 }
        );
      }
      if (!resolvedSupplierId && temp.supplier_id) resolvedSupplierId = temp.supplier_id;

      // Count pallet hiện có cho phiếu tạm này
      existingPalletsCount = await prisma.pallet.count({
        where: {
          inbound_temp_id,
          status: { not: "CANCELLED" },
        },
      });

      // Load InboundTempLine để copy — CHỈ cho pallet ĐẦU TIÊN của phiếu tạm
      if (auto_populate_lines && existingPalletsCount === 0) {
        const tempLines = await prisma.inboundTempLine.findMany({
          where: { inbound_temp_id },
          select: {
            item_code_id: true,
            qty_box: true,
            lot: true,
            expiry_date: true,
            note: true,
            item_code: { select: { weight_per_box: true, units_per_box: true } },
          },
        });
        inboundLinesToCopy = tempLines.map((l) => ({
          item_code_id: l.item_code_id,
          qty_expected: l.qty_box,
          lot: l.lot,
          expiry_date: l.expiry_date,
          note: l.note,
          item_code: l.item_code,
        }));
      }
    }

    // Sinh mã + tạo pallet + auto-populate lines trong cùng transaction
    const result = await prisma.$transaction(async (tx) => {
      const { code, codeDate, codeSeq } = await generatePalletCode(tx);

      // Tính tổng weight + total_lines từ InboundLine (nếu copy)
      let totalLines = 0;
      let totalWeightKg = new Prisma.Decimal(0);
      const lineCreateInputs: Prisma.PalletLineCreateManyPalletInput[] = [];

      for (const line of inboundLinesToCopy) {
        const qtyBox = new Prisma.Decimal(line.qty_expected);
        const weightPerBox = line.item_code?.weight_per_box
          ? new Prisma.Decimal(line.item_code.weight_per_box)
          : new Prisma.Decimal(0);
        const lineWeight = qtyBox.mul(weightPerBox);
        // L2 fix: quy đổi qty_unit theo units_per_box của ItemCode
        const unitsPerBox = line.item_code?.units_per_box || 1;
        const qtyUnit = qtyBox.mul(new Prisma.Decimal(unitsPerBox));

        lineCreateInputs.push({
          item_code_id: line.item_code_id,
          qty_box: qtyBox,
          qty_unit: qtyUnit,
          lot: line.lot,
          expiry_date: line.expiry_date,
          weight_kg: lineWeight,
          note: line.note,
        });
        totalLines++;
        totalWeightKg = totalWeightKg.add(lineWeight);
      }

      // Phase 3.1 — TC_CREATE_PAL_011: pallet không line = "Chưa kích hoạt" (EMPTY).
      const newPallet = await tx.pallet.create({
        data: {
          code,
          code_date: codeDate,
          code_seq: codeSeq,
          status: totalLines > 0 ? "COUNTING" : "EMPTY",
          supplier_id: resolvedSupplierId,
          inbound_request_id: inbound_request_id || null,
          inbound_temp_id: inbound_temp_id || null,
          inbound_date: (inbound_date || receive_date) ? new Date(inbound_date || receive_date) : null,
          note: note?.trim() || null,
          total_lines: totalLines,
          total_weight_kg: totalWeightKg,
          // Tạo lines nested trong cùng query
          ...(lineCreateInputs.length > 0
            ? { lines: { createMany: { data: lineCreateInputs } } }
            : {}),
        },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          inbound_request: { select: { id: true, code: true } },
          lines: {
            include: {
              item_code: {
                select: { id: true, code: true, short_name: true, weight_per_box: true },
              },
            },
          },
        },
      });

      return { pallet: newPallet, copiedLinesCount: totalLines };
    }, { isolationLevel: "Serializable" });

    // Phase 3.1 — audit log tạo pallet (RC-2: ghi role/IP/UA qua helper)
    await logAudit(req, {
      entity_type: "pallet",
      entity_id: result.pallet.id,
      action: "CREATE_PALLET",
      new_value: {
        code: result.pallet.code,
        status: result.pallet.status,
        supplier_id: result.pallet.supplier_id,
        inbound_request_id: result.pallet.inbound_request_id,
        inbound_temp_id: result.pallet.inbound_temp_id,
        copied_lines_count: result.copiedLinesCount,
      },
    });

    // Trả về với warnings nếu cần.
    // Mô hình mới: mọi pallet bắt đầu trống, nên chỉ thông báo nhẹ số pallet đã có
    // của phiếu để thủ kho biết mình đang tạo pallet thứ mấy (không còn cảnh báo
    // "phải xóa bớt" như cơ chế auto-copy cũ).
    const warnings: string[] = [];
    if (inbound_request_id && existingPalletsCount > 0) {
      warnings.push(
        `Phiếu nhập này đã có ${existingPalletsCount} pallet. Thêm đúng phần hàng thực xếp lên pallet mới này — hệ thống hiển thị số còn lại theo phiếu.`
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.pallet,
        copied_lines_count: result.copiedLinesCount,
        warnings: warnings.length > 0 ? warnings : undefined,
        existing_pallets_count: existingPalletsCount,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/pallets error:", error);
    // Check unique constraint violation (trùng mã)
    if (error instanceof Error && error.message?.includes("Unique constraint")) {
      return NextResponse.json(
        { success: false, error: "Mã pallet bị trùng — vui lòng thử lại." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Lỗi khi tạo pallet." },
      { status: 500 }
    );
  }
}
