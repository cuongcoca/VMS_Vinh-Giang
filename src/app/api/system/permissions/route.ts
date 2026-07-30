import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, apiErrorResponse } from "@/lib/auth-server";
import { logAudit, keyToUuid } from "@/lib/audit";
import {
  PERMISSION_CONFIG_KEY,
  getPermissionMatrixForAdmin,
  reloadPermissionMatrix,
  ensurePermissionMatrixLoaded,
  validatePermissionMatrix,
} from "@/lib/permissions";

// WVG-16 / Pha 4 — Cấu hình ma trận quyền API (server RBAC), lưu ở systemConfig.
// GET: xem ma trận hiệu lực (chỉ vai có quyền đọc system = QUAN_LY).
// PUT: lưu override (chỉ system:special = QUAN_LY), áp ngay + ghi audit.

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "system", "read");
    await ensurePermissionMatrixLoaded();
    return NextResponse.json({ success: true, data: getPermissionMatrixForAdmin() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { user } = await requirePermission(req, "system", "special");
    const body = await req.json();
    const matrix = body?.matrix;
    if (!matrix || typeof matrix !== "object") {
      return NextResponse.json({ success: false, error: "Ma trận không hợp lệ." }, { status: 400 });
    }

    // WVG-34 / UC-AUTH-05: validate CHẶT trước khi lưu — role/resource/level sai → 400,
    // KHÔNG ghi một phần (AC: negative case không tạo thay đổi dữ liệu một phần).
    const { valid, errors, clean } = validatePermissionMatrix(matrix);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: "Ma trận quyền không hợp lệ.", errors },
        { status: 400 }
      );
    }

    const oldCfg = await prisma.systemConfig.findUnique({ where: { key: PERMISSION_CONFIG_KEY } });
    const saved = await prisma.systemConfig.upsert({
      where: { key: PERMISSION_CONFIG_KEY },
      update: { value: JSON.stringify(clean) },
      create: {
        key: PERMISSION_CONFIG_KEY,
        value: JSON.stringify(clean),
        label: "Ma trận quyền API (server RBAC)",
      },
    });

    await logAudit(req, {
      entity_type: "system_config",
      entity_id: keyToUuid(saved.key), // key "rbac_permission_matrix" → UUID tất định (cột @db.Uuid)
      action: "UPDATE_PERMISSION_MATRIX",
      old_value: oldCfg?.value ? safeParse(oldCfg.value) : null,
      new_value: clean,
      reason: `${user.full_name} (${user.id}) cập nhật ma trận quyền API (server RBAC)`,
    });

    await reloadPermissionMatrix(); // áp ngay trong tiến trình này
    return NextResponse.json({
      success: true,
      message: "Đã cập nhật ma trận quyền.",
      data: getPermissionMatrixForAdmin(),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
