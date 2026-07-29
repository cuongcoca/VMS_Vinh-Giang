import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyByRoles } from "@/lib/notifications";
import { Prisma } from "@prisma/client";
import { getRequestActor, logAudit } from "@/lib/audit";
import { guardPermission } from "@/lib/auth-server";

// GET /api/outbound/requests/[id] — Chi tiết phiếu PYX
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardPermission(req, "outbound", "read");
  if (denied) return denied;
  try {
    const { id } = await params;
    const request = await prisma.outboundRequest.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            item_code: { select: { id: true, code: true, short_name: true, unit: { select: { name: true, symbol: true } } } },
            pallet: { select: { id: true, code: true, status: true } },
          },
        },
      },
    });
    if (!request) {
      return NextResponse.json({ success: false, error: "Không tìm thấy phiếu." }, { status: 404 });
    }

    // UC-OUT-05_TC11/13/14: tính tồn khu chờ (IN_STAGING) theo từng mã hàng để
    // đối chiếu với SL yêu cầu → trạng thái khớp/thiếu ở từng dòng.
    const itemIds = [...new Set(request.lines.map((l) => l.item_code_id))];
    const stagingMap = new Map<string, number>();
    if (itemIds.length > 0) {
      const grouped = await prisma.palletLine.groupBy({
        by: ["item_code_id"],
        where: { item_code_id: { in: itemIds }, pallet: { status: "IN_STAGING" } },
        _sum: { qty_box: true },
      });
      for (const g of grouped) {
        stagingMap.set(g.item_code_id, Number(g._sum.qty_box ?? 0));
      }
    }
    // RC6: tồn khu chờ đang bị các phiếu PICKING KHÁC giữ chỗ → để tính tồn khả dụng theo phiếu
    const reservedOthersMap = new Map<string, number>();
    if (itemIds.length > 0) {
      const resGrouped = await prisma.outboundRequestLine.groupBy({
        by: ["item_code_id"],
        where: { item_code_id: { in: itemIds }, outbound_request: { status: "PICKING", id: { not: id } } },
        _sum: { qty_reserved: true },
      });
      for (const g of resGrouped) {
        reservedOthersMap.set(g.item_code_id, Number(g._sum.qty_reserved ?? 0));
      }
    }

    // Tự động tính toán suggested_pallets theo thuật toán FEFO
    const suggestedPallets: any[] = [];
    for (const line of request.lines) {
      const palletLines = await prisma.palletLine.findMany({
        where: {
          item_code_id: line.item_code_id,
          qty_box: { gt: 0 },
          pallet: {
            status: { in: ["IN_STAGING", "IN_STORAGE"] }
          }
        },
        include: {
          pallet: {
            include: {
              location: { select: { id: true, code: true } }
            }
          },
          item_code: { select: { id: true, code: true, short_name: true } }
        },
        orderBy: { expiry_date: { sort: "asc", nulls: "last" } }
      });

      const stagedLines = palletLines.filter(pl => pl.pallet.status === "IN_STAGING");
      const storageLines = palletLines.filter(pl => pl.pallet.status === "IN_STORAGE");

      let qty_staged_total = 0;
      const requestedQty = Number(line.qty_requested);

      // 1. Phân bổ từ các pallet đã được chuyển ra Staging
      for (const pl of stagedLines) {
        const qtyBox = Number(pl.qty_box);
        qty_staged_total += qtyBox;
        suggestedPallets.push({
          pallet_id: pl.pallet_id,
          pallet_code: pl.pallet.code,
          location_code: pl.pallet.location?.code || "Khu chờ xuất",
          qty_to_pick: qtyBox,
          qty_available: qtyBox,
          lot: pl.lot,
          expiry_date: pl.expiry_date,
          item_code_id: pl.item_code_id,
          item_code: pl.item_code.code,
          item_name: pl.item_code.short_name,
          mode: "FULL",
          status: "COMPLETED",
          pallet_line_id: pl.id
        });
      }

      // 2. Nếu thiếu, phân bổ tiếp từ các pallet trong kho theo FEFO
      if (qty_staged_total < requestedQty) {
        for (const pl of storageLines) {
          const qty_needed = requestedQty - qty_staged_total;
          if (qty_needed <= 0) break;

          const qtyBox = Number(pl.qty_box);
          if (qtyBox <= qty_needed) {
            qty_staged_total += qtyBox;
            suggestedPallets.push({
              pallet_id: pl.pallet_id,
              pallet_code: pl.pallet.code,
              location_code: pl.pallet.location?.code || "Dock nhận",
              qty_to_pick: qtyBox,
              qty_available: qtyBox,
              lot: pl.lot,
              expiry_date: pl.expiry_date,
              item_code_id: pl.item_code_id,
              item_code: pl.item_code.code,
              item_name: pl.item_code.short_name,
              mode: "FULL",
              status: "PENDING",
              pallet_line_id: pl.id
            });
          } else {
            qty_staged_total += qty_needed;
            suggestedPallets.push({
              pallet_id: pl.pallet_id,
              pallet_code: pl.pallet.code,
              location_code: pl.pallet.location?.code || "Dock nhận",
              qty_to_pick: qty_needed,
              qty_available: qtyBox,
              lot: pl.lot,
              expiry_date: pl.expiry_date,
              item_code_id: pl.item_code_id,
              item_code: pl.item_code.code,
              item_name: pl.item_code.short_name,
              mode: "PARTIAL",
              status: "PENDING",
              pallet_line_id: pl.id
            });
          }
        }
      }
    }

    const data = {
      ...request,
      lines: request.lines.map((l) => {
        const stagingQty = stagingMap.get(l.item_code_id) ?? 0;
        const reservedByOthers = reservedOthersMap.get(l.item_code_id) ?? 0;
        return { ...l, staging_qty: stagingQty, reserved_by_others: reservedByOthers, available_qty: Math.max(0, stagingQty - reservedByOthers) };
      }),
      suggested_pallets: suggestedPallets,
    };
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/outbound/requests/[id] error:", error);
    return NextResponse.json({ success: false, error: "Lỗi tải chi tiết phiếu." }, { status: 500 });
  }
}

// PATCH /api/outbound/requests/[id] — Update status (workflow theo enum: PENDING → PICKING → SHIPPED, hoặc CANCELLED)
// body: { action: "START_PICKING" | "SHIP" | "CANCEL", note? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardPermission(req, "outbound", "write");
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, note } = body;

    const request = await prisma.outboundRequest.findUnique({ where: { id }, include: { lines: true } });
    if (!request) return NextResponse.json({ success: false, error: "Không tìm thấy phiếu." }, { status: 404 });

    const validActions = ["START_PICKING", "SHIP", "CANCEL"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ success: false, error: `action phải là ${validActions.join("/")}.` }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    let newStatus: string;
    let updated;
    let warnMsg = "";

    if (action === "START_PICKING") {
      if (request.status !== "PENDING") return NextResponse.json({ success: false, error: `Chỉ bắt đầu lấy hàng được khi phiếu PENDING (hiện: ${request.status}).` }, { status: 400 });
      newStatus = "PICKING";
      updateData.status = newStatus;
      if (note) updateData.note = (request.note ? request.note + "\n" : "") + `[${action}] ${note}`;

      // ── RC6: GIỮ CHỖ tồn cho phiếu (FCFS) — tránh 2 phiếu cùng tranh 1 lượng tồn ──
      const itemIds = [...new Set(request.lines.map((l) => l.item_code_id))];
      const onHandRows = await prisma.palletLine.groupBy({
        by: ["item_code_id"],
        where: { item_code_id: { in: itemIds }, qty_box: { gt: 0 }, pallet: { status: { in: ["IN_STORAGE", "IN_STAGING"] } } },
        _sum: { qty_box: true },
      });
      const onHand = new Map<string, number>();
      for (const r of onHandRows) onHand.set(r.item_code_id, Number(r._sum.qty_box ?? 0));
      const reservedRows = await prisma.outboundRequestLine.groupBy({
        by: ["item_code_id"],
        where: { item_code_id: { in: itemIds }, outbound_request: { status: "PICKING", id: { not: id } } },
        _sum: { qty_reserved: true },
      });
      const reservedOthers = new Map<string, number>();
      for (const r of reservedRows) reservedOthers.set(r.item_code_id, Number(r._sum.qty_reserved ?? 0));

      // FCFS: mỗi dòng chỉ giữ phần tồn còn trống (sau khi trừ giữ chỗ của phiếu khác + đã giữ trong phiếu này)
      const usedInThis = new Map<string, number>();
      const reserveByLine = new Map<string, Prisma.Decimal>();
      for (const line of request.lines) {
        const X = line.item_code_id;
        const avail = (onHand.get(X) ?? 0) - (reservedOthers.get(X) ?? 0) - (usedInThis.get(X) ?? 0);
        const give = Math.max(0, Math.min(Number(line.qty_requested), avail));
        reserveByLine.set(line.id, new Prisma.Decimal(give));
        usedInThis.set(X, (usedInThis.get(X) ?? 0) + give);
      }

      updated = await prisma.$transaction(async (tx) => {
        for (const line of request.lines) {
          await tx.outboundRequestLine.update({ where: { id: line.id }, data: { qty_reserved: reserveByLine.get(line.id)! } });
        }
        return await tx.outboundRequest.update({
          where: { id },
          data: updateData as Parameters<typeof prisma.outboundRequest.update>[0]["data"],
          include: { lines: { include: { item_code: { select: { code: true, short_name: true } } } } },
        });
      });

      // Cảnh báo nếu có mã chưa đủ tồn để giữ chỗ đủ số yêu cầu
      const shorts = updated.lines.filter((l) => Number(l.qty_reserved) < Number(l.qty_requested));
      if (shorts.length > 0) {
        warnMsg = " ⚠ Chưa đủ tồn để giữ chỗ: " + shorts.map((l) => `${l.item_code.code} (giữ ${Number(l.qty_reserved)}/${Number(l.qty_requested)})`).join("; ") + ". Cần nhập thêm hoặc đợi phiếu khác xuất xong.";
      }
    } else if (action === "SHIP") {
      if (request.status !== "PICKING") return NextResponse.json({ success: false, error: `Chỉ xuất kho được phiếu đang lấy hàng (PICKING). Trạng thái hiện tại: ${request.status}.` }, { status: 400 });
      newStatus = "SHIPPED";
      updateData.status = newStatus;
      updateData.shipped_at = new Date();
      if (note) updateData.note = (request.note ? request.note + "\n" : "") + `[${action}] ${note}`;

      const actor = getRequestActor(req);
      if (actor.userId) updateData.shipped_by = actor.userId;

      // Gộp SL yêu cầu theo từng mã hàng (phiếu có thể có nhiều dòng cùng mã)
      const requestedByItem = new Map<string, Prisma.Decimal>();
      for (const ln of request.lines) {
        requestedByItem.set(ln.item_code_id, (requestedByItem.get(ln.item_code_id) ?? new Prisma.Decimal(0)).add(new Prisma.Decimal(ln.qty_requested)));
      }
      const itemIds = [...requestedByItem.keys()];

      // ── RC3: CHỐT CHẶN — tồn khu chờ xuất (IN_STAGING) phải đủ cho TỪNG mã hàng, thiếu thì không cho xuất ──
      const stagingByItem = await prisma.palletLine.groupBy({
        by: ["item_code_id"],
        where: { item_code_id: { in: itemIds }, qty_box: { gt: 0 }, pallet: { status: "IN_STAGING" } },
        _sum: { qty_box: true },
      });
      // RC6: trừ phần tồn khu chờ đang được giữ chỗ bởi các phiếu PICKING khác
      const shipReservedRows = await prisma.outboundRequestLine.groupBy({
        by: ["item_code_id"],
        where: { item_code_id: { in: itemIds }, outbound_request: { status: "PICKING", id: { not: id } } },
        _sum: { qty_reserved: true },
      });
      const reservedOthersShip = new Map<string, number>();
      for (const r of shipReservedRows) reservedOthersShip.set(r.item_code_id, Number(r._sum.qty_reserved ?? 0));
      const availByItem = new Map<string, number>();
      for (const g of stagingByItem) availByItem.set(g.item_code_id, Math.max(0, Number(g._sum.qty_box ?? 0) - (reservedOthersShip.get(g.item_code_id) ?? 0)));
      const shortageItems = itemIds.filter((iid) => (availByItem.get(iid) ?? 0) < Number(requestedByItem.get(iid)));
      if (shortageItems.length > 0) {
        const codes = await prisma.itemCode.findMany({ where: { id: { in: shortageItems } }, select: { id: true, code: true } });
        const codeMap: Record<string, string> = {};
        for (const c of codes) codeMap[c.id] = c.code;
        const detail = shortageItems.map((iid) => `${codeMap[iid] ?? iid}: cần ${Number(requestedByItem.get(iid))}, khả dụng (sau giữ chỗ) ${availByItem.get(iid) ?? 0}`).join("; ");
        return NextResponse.json({ success: false, error: `Chưa đủ số lượng ở khu chờ xuất, không thể xuất kho. ${detail}.` }, { status: 400 });
      }

      updated = await prisma.$transaction(async (tx) => {
        const affectedPalletIds = new Set<string>();

        // ── RC1/RC5: phân bổ FEFO & CHỈ trừ đúng SL yêu cầu (giữ phần dư trên pallet, không xuất nguyên pallet) ──
        for (const itemId of itemIds) {
          let remaining = new Prisma.Decimal(requestedByItem.get(itemId)!);
          const ic = await tx.itemCode.findUnique({ where: { id: itemId }, select: { units_per_box: true } });
          const unitsPerBox = ic?.units_per_box ?? 1;

          const stagingLines = await tx.palletLine.findMany({
            where: { item_code_id: itemId, qty_box: { gt: 0 }, pallet: { status: "IN_STAGING" } },
            include: { pallet: { select: { id: true, location_id: true } } },
            orderBy: [{ expiry_date: { sort: "asc", nulls: "last" } }, { id: "asc" }],
          });

          for (const pl of stagingLines) {
            if (remaining.lte(0)) break;
            const plQty = new Prisma.Decimal(pl.qty_box);
            const take = Prisma.Decimal.min(plQty, remaining); // chỉ lấy đúng phần còn cần
            const newQtyBox = plQty.sub(take);

            if (newQtyBox.lte(0)) {
              await tx.palletLine.update({ where: { id: pl.id }, data: { qty_box: 0, qty_unit: 0, weight_kg: 0 } });
            } else {
              const weightBefore = new Prisma.Decimal(pl.weight_kg);
              const newWeight = weightBefore.mul(newQtyBox).div(plQty);
              await tx.palletLine.update({ where: { id: pl.id }, data: { qty_box: newQtyBox, qty_unit: newQtyBox.mul(unitsPerBox), weight_kg: newWeight } });
            }

            await tx.movement.create({
              data: {
                pallet_id: pl.pallet_id,
                movement_type: "SHIP",
                from_location_id: pl.pallet.location_id ?? null,
                to_location_id: null,
                item_code_id: itemId,
                qty_box: take,
                // WVG-179: snapshot lot + HSD của dòng FEFO đang xuất để ledger đủ truy vết.
                lot: pl.lot ?? null,
                expiry_date: pl.expiry_date ?? null,
                mode: "PARTIAL",
                reason: `Xuất kho từ phiếu ${request.code}.`,
                performed_by: actor.userId ?? undefined,
              },
            });

            affectedPalletIds.add(pl.pallet_id);
            remaining = remaining.sub(take);
          }
        }

        // Ghi nhận SL đã xuất theo từng dòng (= SL yêu cầu) + giải phóng giữ chỗ (RC6)
        for (const line of request.lines) {
          await tx.outboundRequestLine.update({ where: { id: line.id }, data: { qty_shipped: line.qty_requested, qty_reserved: 0 } });
        }

        for (const palletId of affectedPalletIds) {
          const pallet = await tx.pallet.findUnique({
            where: { id: palletId },
            include: { lines: true },
          });

          if (pallet) {
            const currentTotalQty = pallet.lines.reduce((sum, l) => sum + Number(l.qty_box), 0);
            
            if (currentTotalQty <= 0) {
              const oldLocationId = pallet.location_id;

              await tx.pallet.update({
                where: { id: palletId },
                data: {
                  status: "RELEASED",
                  location_id: null,
                },
              });

              if (oldLocationId) {
                await tx.location.update({
                  where: { id: oldLocationId },
                  data: { status: "EMPTY" },
                });
              }

              await logAudit(req, {
                entity_type: "pallet",
                entity_id: palletId,
                action: "RELEASE",
                old_value: { status: pallet.status, location_id: oldLocationId },
                new_value: { status: "RELEASED", location_id: null },
                reason: `Giải phóng pallet rỗng ${pallet.code} sau khi xuất hết hàng qua phiếu ${request.code}`,
              }, tx);
            } else {
              const currentTotalWeight = pallet.lines.reduce((sum, l) => sum + Number(l.weight_kg), 0);
              const currentTotalLines = pallet.lines.filter((l) => Number(l.qty_box) > 0).length;
              await tx.pallet.update({
                where: { id: palletId },
                data: {
                  total_weight_kg: new Prisma.Decimal(currentTotalWeight),
                  total_lines: currentTotalLines,
                },
              });
            }
          }
        }

        return await tx.outboundRequest.update({
          where: { id },
          data: updateData as Parameters<typeof prisma.outboundRequest.update>[0]["data"],
          include: { lines: { include: { item_code: { select: { code: true, short_name: true } } } } },
        });
      });
    } else {
      if (request.status === "SHIPPED") return NextResponse.json({ success: false, error: "Không thể hủy phiếu đã ship." }, { status: 400 });
      newStatus = "CANCELLED";
      updateData.status = newStatus;
      if (note) updateData.note = (request.note ? request.note + "\n" : "") + `[${action}] ${note}`;

      updated = await prisma.$transaction(async (tx) => {
        // RC6: huỷ phiếu → giải phóng toàn bộ giữ chỗ để phiếu khác dùng được tồn
        await tx.outboundRequestLine.updateMany({ where: { outbound_request_id: id }, data: { qty_reserved: 0 } });
        return await tx.outboundRequest.update({
          where: { id },
          data: updateData as Parameters<typeof prisma.outboundRequest.update>[0]["data"],
          include: { lines: { include: { item_code: { select: { code: true, short_name: true } } } } },
        });
      });
    }

    // Notify theo từng loại action
    if (action === "START_PICKING") {
      notifyByRoles(["XE_NANG"], {
        type: "OUTBOUND_PICKING_STARTED",
        title: `Bắt đầu lấy hàng: ${request.code}`,
        body: `Phiếu xuất ${request.code} chuyển sang lấy hàng (${request.lines.length} dòng).`,
        entity_type: "outbound_request",
        entity_id: id,
        link_url: `/xenang/outbound/${id}`,
      }).catch((err) => console.error("notifyByRoles OUTBOUND_PICKING_STARTED:", err));
    } else if (action === "SHIP") {
      notifyByRoles(["THU_KHO", "XE_NANG"], {
        type: "OUTBOUND_SHIPPED",
        title: `Xuất kho xong: ${request.code}`,
        body: `Phiếu xuất ${request.code} đã hoàn tất xuất kho.`,
        entity_type: "outbound_request",
        entity_id: id,
        link_url: `/thukho/outbound/${id}`,
      }).catch((err) => console.error("notifyByRoles OUTBOUND_SHIPPED:", err));
    } else if (action === "CANCEL") {
      notifyByRoles(["THU_KHO", "XE_NANG"], {
        type: "OUTBOUND_CANCELLED",
        title: `Phiếu xuất đã hủy: ${request.code}`,
        body: `Phiếu xuất ${request.code} đã bị hủy.`,
        entity_type: "outbound_request",
        entity_id: id,
        link_url: `/thukho/outbound/${id}`,
      }).catch((err) => console.error("notifyByRoles OUTBOUND_CANCELLED:", err));
    }

    return NextResponse.json({ success: true, data: updated, message: `Phiếu ${request.code} chuyển sang ${newStatus}.${warnMsg}` });
  } catch (error) {
    console.error("PATCH /api/outbound/requests/[id] error:", error);
    return NextResponse.json({ success: false, error: "Lỗi cập nhật phiếu." }, { status: 500 });
  }
}

// DELETE /api/outbound/requests/[id] — chỉ cho phiếu PENDING/CANCELLED
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardPermission(req, "outbound", "write");
  if (denied) return denied;
  try {
    const { id } = await params;
    const request = await prisma.outboundRequest.findUnique({ where: { id } });
    if (!request) return NextResponse.json({ success: false, error: "Không tìm thấy phiếu." }, { status: 404 });
    if (request.status === "PICKING" || request.status === "SHIPPED") {
      return NextResponse.json({ success: false, error: `Không thể xóa phiếu ${request.status}. Dùng action CANCEL thay vì xóa.` }, { status: 400 });
    }
    await prisma.outboundRequest.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Đã xóa phiếu." });
  } catch (error) {
    console.error("DELETE /api/outbound/requests/[id] error:", error);
    return NextResponse.json({ success: false, error: "Lỗi xóa phiếu." }, { status: 500 });
  }
}
