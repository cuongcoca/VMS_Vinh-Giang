import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { notifyByRoles } from "@/lib/notifications";

// GET /api/inbound/[id] — Chi tiết phiếu nhập kho
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const inbound = await prisma.inboundRequest.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        lines: {
          orderBy: { created_at: "asc" },
          include: {
            item_code: {
              select: {
                id: true,
                code: true,
                short_name: true,
                full_name: true,
                unit: { select: { id: true, name: true, symbol: true } },
              },
            },
          },
        },
      },
    });

    if (!inbound) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy phiếu nhập kho." },
        { status: 404 }
      );
    }

    // UC-IN-03 (hướng A — pallet nhiều phiếu): đối chiếu theo TỪNG DÒNG gán về phiếu này,
    // không theo pallet. Một pallet ghép nhiều phiếu chỉ đóng góp dòng của đúng phiếu đang xem.
    const inboundLineItemCodeIds = inbound.lines.map((l) => l.item_code_id);

    // 1) Các DÒNG pallet gán về phiếu này (kèm pallet code/status; loại pallet CANCELLED)
    const scopedLines = await prisma.palletLine.findMany({
      where: {
        inbound_request_id: id,
        pallet: { status: { not: "CANCELLED" } },
      },
      select: {
        item_code_id: true,
        qty_box: true,
        pallet: { select: { id: true, code: true, status: true } },
      },
    });

    // Gom về "pallet ảo" theo pallet id để tính KPI trạng thái + mapping mã→pallet.
    type ScopedPallet = { id: string; code: string; status: string; lines: { item_code_id: string; qty_box: number }[] };
    const palletMap = new Map<string, ScopedPallet>();
    for (const l of scopedLines) {
      const p = l.pallet;
      let sp = palletMap.get(p.id);
      if (!sp) { sp = { id: p.id, code: p.code, status: p.status, lines: [] }; palletMap.set(p.id, sp); }
      sp.lines.push({ item_code_id: l.item_code_id, qty_box: Number(l.qty_box) });
    }
    const pallets = Array.from(palletMap.values());

    const palletsByStatus = {
      total: pallets.length,
      counting: pallets.filter((p) => p.status === "COUNTING").length,
      confirmed: pallets.filter((p) => p.status === "CONFIRMED").length,
      in_storage: pallets.filter((p) => p.status === "IN_STORAGE").length,
      in_staging: pallets.filter((p) => p.status === "IN_STAGING").length,
    };

    // 2) Mapping item_code_id → [pallet codes]
    const palletsByItem: Record<string, string[]> = {};
    for (const pal of pallets) {
      for (const line of pal.lines) {
        if (!palletsByItem[line.item_code_id]) palletsByItem[line.item_code_id] = [];
        if (!palletsByItem[line.item_code_id].includes(pal.code)) {
          palletsByItem[line.item_code_id].push(pal.code);
        }
      }
    }

    // 3) Hàng phát sinh — dòng gán về phiếu này nhưng mã KHÔNG có trong InboundLine.
    //    (Bình thường không xảy ra vì POST đã chặn; giữ để bắt dữ liệu cũ / bất thường.)
    type ExtraLine = {
      item_code_id: string;
      item_code: { id: string; code: string; short_name: string; status?: string };
      total_qty: number;
      pallets: string[];
    };
    const extraLinesMap = new Map<string, ExtraLine>();
    for (const pal of pallets) {
      for (const line of pal.lines) {
        if (!inboundLineItemCodeIds.includes(line.item_code_id)) {
          const existing = extraLinesMap.get(line.item_code_id);
          if (existing) {
            existing.total_qty += Number(line.qty_box);
            if (!existing.pallets.includes(pal.code)) existing.pallets.push(pal.code);
          } else {
            extraLinesMap.set(line.item_code_id, {
              item_code_id: line.item_code_id,
              item_code: { id: line.item_code_id, code: "", short_name: "" },
              total_qty: Number(line.qty_box),
              pallets: [pal.code],
            });
          }
        }
      }
    }
    // Fetch full item_code info cho extra lines
    if (extraLinesMap.size > 0) {
      const extraIds = Array.from(extraLinesMap.keys());
      const extraItemCodes = await prisma.itemCode.findMany({
        where: { id: { in: extraIds } },
        select: { id: true, code: true, short_name: true, status: true },
      });
      for (const ic of extraItemCodes) {
        const entry = extraLinesMap.get(ic.id);
        if (entry) entry.item_code = ic;
      }
    }
    const extraLines = Array.from(extraLinesMap.values());

    // 4) Stats tổng hợp
    // Tổng số thùng ĐÃ QUÉT lên các pallet của phiếu này (dùng cho thanh tiến độ nhận hàng).
    const totalOnPallets = pallets.reduce(
      (s, p) => s + p.lines.reduce((ls, l) => ls + Number(l.qty_box), 0),
      0
    );
    const totalExpected = inbound.lines.reduce((s, l) => s + Number(l.qty_expected), 0);
    const totalReceived = inbound.lines.reduce((s, l) => s + Number(l.qty_received || 0), 0);
    const totalAccepted = inbound.lines.reduce((s, l) => s + Number(l.qty_accepted || 0), 0);
    const diff = totalReceived - totalExpected;
    const diffPercent = totalExpected > 0 ? (diff / totalExpected) * 100 : 0;
    const tempCodesCount = inbound.lines.filter((l) =>
      l.item_code?.code?.startsWith("TMP-")
    ).length;

    // ĐỐI CHIẾU pallet-vs-thực-nhận theo TỪNG MÃ (fix: 1 phiếu — nhiều pallet).
    // qty_on_pallet = tổng thùng của mã đó trên MỌI pallet của phiếu.
    // Lệch = đã lên pallet − thực nhận; chỉ tính lệch khi mã đã có SL thực nhận.
    const qtyOnPalletByItem: Record<string, number> = {};
    for (const pal of pallets) {
      for (const line of pal.lines) {
        qtyOnPalletByItem[line.item_code_id] =
          (qtyOnPalletByItem[line.item_code_id] || 0) + Number(line.qty_box);
      }
    }
    const reconcileByItem = inbound.lines.map((l) => {
      const received =
        l.qty_received === null || l.qty_received === undefined
          ? null
          : Number(l.qty_received);
      const onPallet = qtyOnPalletByItem[l.item_code_id] || 0;
      return {
        item_code_id: l.item_code_id,
        code: l.item_code?.code || "",
        short_name: l.item_code?.short_name || "",
        qty_expected: Number(l.qty_expected),
        qty_received: received,
        qty_on_pallet: onPallet,
        diff: received === null ? null : onPallet - received,
      };
    });
    // Số mã lệch giữa "đã lên pallet" và "thực nhận" (chỉ xét mã đã có thực nhận).
    const palletReceivedMismatchCount = reconcileByItem.filter(
      (r) => r.qty_received !== null && r.diff !== 0
    ).length;

    const stats = {
      total_expected: totalExpected,
      total_on_pallets: totalOnPallets,
      total_received: totalReceived,
      total_accepted: totalAccepted,
      diff: diff,
      diff_percent: Number(diffPercent.toFixed(1)),
      lines_count: inbound.lines.length,
      temp_codes_count: tempCodesCount,
      pallets: palletsByStatus,
      extra_lines_count: extraLines.length,
      // Đối chiếu pallet vs thực nhận
      pallet_received_mismatch_count: palletReceivedMismatchCount,
      extra_on_pallet_count: extraLines.length,
    };

    return NextResponse.json({
      success: true,
      data: inbound,
      stats,
      pallets_by_item: palletsByItem,
      extra_lines: extraLines,
      reconcile_by_item: reconcileByItem,
    });
  } catch (error) {
    console.error("GET /api/inbound/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tải phiếu nhập kho." },
      { status: 500 }
    );
  }
}

// PUT /api/inbound/[id] — Cập nhật phiếu nhập kho (chỉ DRAFT)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { supplier_id, expected_date, invoice_no, note, lines } = body;

    // Kiểm tra phiếu tồn tại
    const existing = await prisma.inboundRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy phiếu nhập kho." },
        { status: 404 }
      );
    }

    // Chỉ cho phép sửa khi DRAFT
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: `Phiếu đang ở trạng thái "${existing.status}" — chỉ được sửa khi DRAFT.` },
        { status: 400 }
      );
    }

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

    // UC-IN-01: Số hoá đơn bắt buộc — nếu client gửi lên thì không được để trống.
    if (invoice_no !== undefined && !String(invoice_no).trim()) {
      return NextResponse.json(
        { success: false, error: "Số hoá đơn không được để trống." },
        { status: 400 }
      );
    }

    // Validate lines (nếu có)
    if (lines && Array.isArray(lines) && lines.length > 0) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.item_code_id) {
          return NextResponse.json(
            { success: false, error: `Dòng ${i + 1}: Phải chọn mã hàng.` },
            { status: 400 }
          );
        }
        if (!line.qty_expected || Number(line.qty_expected) <= 0) {
          return NextResponse.json(
            { success: false, error: `Dòng ${i + 1}: Số lượng dự kiến phải > 0.` },
            { status: 400 }
          );
        }
        // Kiểm tra mã hàng tồn tại
        const itemCode = await prisma.itemCode.findUnique({
          where: { id: line.item_code_id },
        });
        if (!itemCode) {
          return NextResponse.json(
            { success: false, error: `Dòng ${i + 1}: Mã hàng không tồn tại.` },
            { status: 400 }
          );
        }
      }
    }

    // Cập nhật phiếu — nếu lines thì xóa cũ + tạo mới
    const updateData: Record<string, unknown> = {
      supplier_id: supplier_id !== undefined ? (supplier_id || null) : existing.supplier_id,
      expected_date: expected_date !== undefined
        ? (expected_date ? new Date(expected_date) : null)
        : existing.expected_date,
      invoice_no: invoice_no !== undefined ? String(invoice_no).trim() : existing.invoice_no,
      note: note !== undefined ? (note?.trim() || null) : existing.note,
    };

    // Nếu gửi lines → xóa dòng cũ rồi tạo mới
    if (lines && Array.isArray(lines)) {
      await prisma.inboundLine.deleteMany({
        where: { inbound_request_id: id },
      });

      if (lines.length > 0) {
        updateData.lines = {
          create: lines.map((line: Record<string, unknown>) => ({
            item_code_id: line.item_code_id as string,
            qty_expected: new Prisma.Decimal(Number(line.qty_expected)),
            lot: (line.lot as string)?.trim() || null,
            expiry_date: line.expiry_date ? new Date(line.expiry_date as string) : null,
            note: (line.note as string)?.trim() || null,
          })),
        };
      }
    }

    const updated = await prisma.inboundRequest.update({
      where: { id },
      data: updateData,
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        lines: {
          orderBy: { created_at: "asc" },
          include: {
            item_code: {
              select: {
                id: true,
                code: true,
                short_name: true,
                full_name: true,
                unit: { select: { id: true, name: true, symbol: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /api/inbound/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi cập nhật phiếu nhập kho." },
      { status: 500 }
    );
  }
}

// DELETE /api/inbound/[id] — Hủy phiếu nhập kho → CANCELLED
// VĐ3: cho phép hủy cả phiếu ĐÃ GỬI (PENDING/RECEIVING), bắt buộc kèm lý do.
// Vẫn CHẶN khi phiếu đã đối chiếu/chốt (RECONCILING/COMPLETED) hoặc đã có pallet
// xác nhận/nhập kho (tránh mất dấu tồn kho).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = (body?.reason as string | undefined)?.trim() || "";

    const inbound = await prisma.inboundRequest.findUnique({ where: { id } });

    if (!inbound) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy phiếu nhập kho." },
        { status: 404 }
      );
    }

    // Chỉ hủy được khi phiếu chưa đối chiếu/chưa chốt/chưa hủy.
    const CANCELLABLE = ["DRAFT", "PENDING", "RECEIVING"];
    if (!CANCELLABLE.includes(inbound.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Không thể hủy phiếu ở trạng thái "${inbound.status}". Chỉ hủy được khi phiếu chưa đối chiếu/chưa chốt.`,
        },
        { status: 400 }
      );
    }

    // Phiếu đã gửi cho thủ kho (PENDING/RECEIVING) bắt buộc nhập lý do hủy.
    if (inbound.status !== "DRAFT" && !reason) {
      return NextResponse.json(
        { success: false, error: "Phiếu đã gửi cho thủ kho — vui lòng nhập lý do hủy." },
        { status: 400 }
      );
    }

    // Chặn hủy nếu đã có pallet ở trạng thái đã xác nhận/đã vào kho/đã ra khu chờ
    // → tránh bỏ phiếu khi hàng thực đã lên kệ.
    const blockingPallet = await prisma.pallet.findFirst({
      where: {
        inbound_request_id: id,
        status: { in: ["CONFIRMED", "IN_STORAGE", "IN_STAGING", "RELEASED"] },
      },
      select: { code: true, status: true },
    });
    if (blockingPallet) {
      return NextResponse.json(
        {
          success: false,
          error: `Không thể hủy: pallet ${blockingPallet.code} đã ở trạng thái "${blockingPallet.status}". Hãy xử lý/hủy pallet trước khi hủy phiếu.`,
        },
        { status: 400 }
      );
    }

    // Ghi lý do hủy vào note để truy vết (giống pattern request-recheck).
    let newNote = inbound.note;
    if (reason) {
      const timestamp = new Date().toLocaleString("vi-VN");
      const cancelNote = `[${timestamp}] Hủy phiếu: ${reason}`;
      newNote = inbound.note ? `${inbound.note}\n${cancelNote}` : cancelNote;
    }

    const updated = await prisma.inboundRequest.update({
      where: { id },
      data: {
        status: "CANCELLED",
        ...(reason ? { note: newNote, close_note: reason } : {}),
      },
    });

    // Notify THU_KHO khi phiếu bị hủy (giữ tính năng Push của 42)
    notifyByRoles(["THU_KHO"], {
      type: "INBOUND_CANCELLED",
      title: `Phiếu nhập đã hủy: ${inbound.code}`,
      body: reason
        ? `Phiếu nhập ${inbound.code} đã bị hủy. Lý do: ${reason}`
        : `Phiếu nhập ${inbound.code} đã bị hủy.`,
      entity_type: "inbound_request",
      entity_id: id,
      link_url: `/thukho/inbound/${id}`,
    }).catch((err) => console.error("notifyByRoles INBOUND_CANCELLED:", err));

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("DELETE /api/inbound/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi hủy phiếu nhập kho." },
      { status: 500 }
    );
  }
}
