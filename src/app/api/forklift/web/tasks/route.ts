import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

export async function GET(req: Request) {
  const denied = await guardPermission(req, "forklift", "read");
  if (denied) return denied;
  try {
    // Get pallets with statuses CONFIRMED (Pending Put-away), IN_STAGING (Pending Outbound/FEFO), or recently moved IN_STORAGE.
    const pallets = await prisma.pallet.findMany({
      where: {
        status: {
          in: ["CONFIRMED", "IN_STAGING", "IN_STORAGE"],
        },
      },
      include: {
        supplier: {
          select: { name: true },
        },
        location: {
          select: { code: true, zone: true, rack: true, level: true },
        },
        lines: {
          include: {
            item_code: {
              select: { code: true, short_name: true },
            },
          },
        },
        movements: {
          orderBy: { performed_at: "desc" },
          take: 1,
        },
      },
      orderBy: {
        updated_at: "desc",
      },
      take: 50,
    });

    const mappedTasks = pallets.map((pallet) => {
      // Calculate total box quantity
      const qtyBox = pallet.lines.reduce(
        (sum, line) => sum + Number(line.qty_box),
        0
      );

      // Get first item code info
      const firstLine = pallet.lines[0];
      const sku = firstLine?.item_code?.code || "N/A";
      const productName = firstLine?.item_code?.short_name || "Sản phẩm chưa rõ";

      // Expiry Date (FEFO)
      const expiryDate = firstLine?.expiry_date
        ? new Date(firstLine.expiry_date).toLocaleDateString("vi-VN")
        : "—";

      // FEFO Priority flag (if expiry is within 30 days)
      let isFefoPriority = false;
      if (firstLine?.expiry_date) {
        const daysToExpiry =
          (new Date(firstLine.expiry_date).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24);
        if (daysToExpiry <= 30 && daysToExpiry > 0) {
          isFefoPriority = true;
        }
      }

      // Source/Current Location
      const sourceLocation = pallet.location?.code || "Dock nhận";

      // Map status
      let displayStatus = "Chờ xử lý";
      let statusChipClass = "chip-neutral";

      if (pallet.status === "CONFIRMED") {
        // If there was a movement initiated recently (or has movements record but still CONFIRMED, or we can check movement performance)
        const hasActiveMove = pallet.movements.length > 0;
        if (hasActiveMove) {
          displayStatus = "Đang di chuyển";
          statusChipClass = "chip-warning";
        } else {
          displayStatus = "Chờ nhập";
          statusChipClass = "chip-info";
        }
      } else if (pallet.status === "IN_STAGING") {
        displayStatus = "Chờ xuất";
        statusChipClass = "chip-purple";
      } else if (pallet.status === "IN_STORAGE") {
        displayStatus = "Đã xếp";
        statusChipClass = "chip-success";
      }

      return {
        id: pallet.id,
        code: pallet.code,
        sku,
        productName,
        qty: `${qtyBox} Thùng`,
        expiry: expiryDate,
        isFefoPriority,
        source: sourceLocation,
        status: displayStatus,
        statusChipClass,
      };
    });

    return NextResponse.json({
      success: true,
      data: mappedTasks,
    });
  } catch (error) {
    console.error("GET /api/forklift/web/tasks error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống khi tải danh sách task." },
      { status: 500 }
    );
  }
}
