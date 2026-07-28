import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LocationType, LocationStatus } from "@prisma/client";
import { guardPermission } from "@/lib/auth-server";

// Regex kiểm tra định dạng Khu-Kệ-Tầng (Ví dụ: A-03-02, B-12-05)
// Zone: 1-3 chữ cái viết hoa
// Rack: 1-3 chữ số
// Level: 1-2 chữ số
const ZONE_REGEX = /^[A-Z]{1,3}$/;
const RACK_REGEX = /^\d{1,3}$/;
const LEVEL_REGEX = /^\d{1,2}$/;

function formatCode(zone: string, rack: string, level: string) {
  return `${zone}-${rack.padStart(2, "0")}-${level.padStart(2, "0")}`;
}

// TC_LOC_003: các trạng thái phản ánh MỨC CHIẾM DỤNG — sẽ được suy lại từ pallet
// thực tế. Các trạng thái còn lại (MAINTENANCE/RESERVED/NEEDS_CHECK/CHECK_AGAIN/
// WAITING_OUTBOUND) là trạng thái vận hành/thủ công → GIỮ NGUYÊN, không tự đổi.
const OCCUPANCY_STATUSES: LocationStatus[] = ["EMPTY", "USING", "FULL", "PARTIAL"];

// Pallet được coi là ĐANG chiếm vị trí (theo location_id) khi ở các trạng thái này.
// Đồng bộ với logic kiểm tra sức chứa của put-away/relocate (IN_STORAGE + IN_STAGING),
// thêm COUNTING (đang kiểm kê — vẫn nằm tại chỗ).
const OCCUPYING_PALLET_STATUSES = ["IN_STORAGE", "IN_STAGING", "COUNTING"] as const;

// GET: Lấy danh sách vị trí kho
export async function GET(request: NextRequest) {
  const denied = await guardPermission(request, "location", "read");
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const zone = searchParams.get("zone") || "";
    const type = searchParams.get("type") || "";
    const status = searchParams.get("status") || "";
    const occupied = searchParams.get("occupied") || "";

    const where: any = { is_active: true };

    if (q.trim()) {
      where.code = { contains: q.trim(), mode: "insensitive" };
    }
    if (zone.trim()) {
      where.zone = zone.trim().toUpperCase();
    }
    if (type.trim()) {
      where.type = type as LocationType;
    }
    // TC_LOC_003: KHÔNG lọc theo cột `status` lưu sẵn (có thể lệch thực tế do một số
    // luồng xuất/chuyển chưa cập nhật status đúng). Lọc theo effective_status (suy ra
    // từ pallet thực tế) ở phía dưới.

    const locations = await prisma.location.findMany({
      where,
      orderBy: [
        { zone: "asc" },
        { rack: "asc" },
        { level: "asc" }
      ],
      include: {
        pallets: {
          where: { status: { in: ["IN_STORAGE", "IN_STAGING", "CONFIRMED", "COUNTING"] } },
          select: { id: true, code: true, status: true, total_lines: true, total_weight_kg: true },
          take: 5,
        },
      },
      take: 1000 // Tối đa 1000 bản ghi để đảm bảo hiệu năng
    });

    // Đếm CHÍNH XÁC số pallet đang chiếm mỗi vị trí (theo location_id) — đây là NGUỒN
    // SỰ THẬT cho trạng thái hiển thị, thay vì tin vào cột status lưu sẵn. Dùng groupBy
    // (không giới hạn take như include ở trên) để đếm đủ.
    const ids = locations.map((l) => l.id);
    const grouped = ids.length
      ? await prisma.pallet.groupBy({
          by: ["location_id"],
          where: { location_id: { in: ids }, status: { in: [...OCCUPYING_PALLET_STATUSES] } },
          _count: { _all: true },
        })
      : [];
    const countMap = new Map<string, number>();
    for (const g of grouped) {
      if (g.location_id) countMap.set(g.location_id, g._count._all);
    }

    let data = locations.map((loc) => {
      const pallet_count = countMap.get(loc.id) ?? 0;
      let effective_status: LocationStatus = loc.status;
      // Chỉ suy lại các trạng thái chiếm dụng; giữ nguyên trạng thái vận hành/thủ công.
      if (OCCUPANCY_STATUSES.includes(loc.status)) {
        if (pallet_count <= 0) {
          effective_status = "EMPTY";
        } else if (loc.max_pallets != null && pallet_count >= loc.max_pallets) {
          effective_status = "FULL";
        } else {
          effective_status = "USING";
        }
      }
      return { ...loc, pallet_count, effective_status };
    });

    // Lọc theo trạng thái HIỂN THỊ (đã suy ra) nếu client yêu cầu — đảm bảo
    // ?status=EMPTY/USING/... trả đúng vị trí theo tồn thực (relocate/return/stock-count).
    if (status.trim()) {
      data = data.filter((d) => d.effective_status === status);
    }

    // ?occupied=1 — trả MỌI vị trí đang có pallet chiếm (pallet_count > 0), bất kể
    // effective_status là USING / FULL / hay trạng thái vận hành. Dùng cho màn kiểm kê
    // theo vị trí: phải liệt kê ĐỦ vị trí có hàng, không sót vị trí FULL (đã đầy pallet).
    if (occupied === "1" || occupied === "true") {
      data = data.filter((d) => 
        d.pallet_count > 0 || 
        d.type === "OUTBOUND_STAGING" || 
        d.type === "INBOUND_STAGING" ||
        d.zone === "STG" ||
        /STG|OUTBOUND[_-]STAGING|INBOUND[_-]STAGING/i.test(d.code)
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/locations error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống khi lấy danh sách vị trí." },
      { status: 500 }
    );
  }
}

// POST: Tạo mới một vị trí kho đơn lẻ
export async function POST(request: NextRequest) {
  const denied = await guardPermission(request, "location", "write");
  if (denied) return denied;
  try {
    const body = await request.json();
    const { zone, rack, level, type, status, max_weight_kg, max_pallets, note } = body;

    // Validate bắt buộc
    if (!zone || !rack || !level) {
      return NextResponse.json(
        { success: false, error: "Khu, kệ và tầng là bắt buộc." },
        { status: 400 }
      );
    }

    // Validate định dạng bằng regex
    const cleanZone = zone.trim().toUpperCase();
    const cleanRack = rack.toString().trim();
    const cleanLevel = level.toString().trim();

    if (!ZONE_REGEX.test(cleanZone)) {
      return NextResponse.json(
        { success: false, error: "Khu vực phải là chữ cái in hoa (1-3 ký tự, vd: A, B, ZA)." },
        { status: 400 }
      );
    }
    if (!RACK_REGEX.test(cleanRack)) {
      return NextResponse.json(
        { success: false, error: "Kệ phải là chữ số (1-3 ký tự, vd: 1, 02, 10)." },
        { status: 400 }
      );
    }
    if (!LEVEL_REGEX.test(cleanLevel)) {
      return NextResponse.json(
        { success: false, error: "Tầng phải là chữ số (1-2 ký tự, vd: 1, 05)." },
        { status: 400 }
      );
    }

    const code = formatCode(cleanZone, cleanRack, cleanLevel);

    // Kiểm tra trùng lặp
    const existing = await prisma.location.findFirst({
      where: { code, is_active: true }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Vị trí kho "${code}" đã tồn tại.` },
        { status: 400 }
      );
    }

    // Tạo mới
    const newLocation = await prisma.location.create({
      data: {
        code,
        zone: cleanZone,
        rack: cleanRack.padStart(2, "0"),
        level: cleanLevel.padStart(2, "0"),
        type: type || LocationType.STORAGE,
        status: status || LocationStatus.EMPTY,
        max_weight_kg: max_weight_kg ? parseFloat(max_weight_kg) : null,
        max_pallets: max_pallets ? parseInt(max_pallets, 10) : null,
        note: note ? note.trim() : null
      }
    });

    return NextResponse.json({ success: true, data: newLocation });
  } catch (error: any) {
    // P2002: Unique constraint violation (race condition hoặc is_active=false vẫn unique)
    if (error?.code === "P2002" ||
        error?.message?.includes("UniqueConstraintViolation")) {
      return NextResponse.json(
        { success: false, error: `Mã vị trí này đã tồn tại trong hệ thống (kể cả vị trí đã bị xoá). Vui lòng thử tổ hợp Khu-Kệ-Tầng khác.` },
        { status: 400 }
      );
    }
    console.error("POST /api/locations error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống khi tạo vị trí kho." },
      { status: 500 }
    );
  }
}
