import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ROLE_FEATURES, FEATURE_MAP } from "@/lib/rbac";
import { requirePermission, apiErrorResponse } from "@/lib/auth-server";
import { logAudit, keyToUuid } from "@/lib/audit";

const CONFIG_KEY = "rbac_role_features";

// WVG-34 / UC-AUTH-05 — Khôi phục ma trận HIỂN THỊ MENU (legacy System B) về mặc định.
// Endpoint này trước đây bị màn /system/rbac gọi nhưng CHƯA tồn tại (UI nuốt lỗi).
// LƯU Ý: đây chỉ là cấu hình hiển thị menu (UX), KHÔNG phải hàng rào bảo mật.
// Quyền thật do ma trận /api/system/permissions (deny-by-default) enforce.
export async function POST(req: NextRequest) {
  try {
    const { user } = await requirePermission(req, "system", "special");

    const oldCfg = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });

    const saved = await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: JSON.stringify(DEFAULT_ROLE_FEATURES) },
      create: {
        key: CONFIG_KEY,
        value: JSON.stringify(DEFAULT_ROLE_FEATURES),
        label: "Ma trận phân quyền vai trò người dùng",
      },
    });

    await logAudit(req, {
      entity_type: "system_config",
      entity_id: keyToUuid(saved.key), // key chuỗi → UUID tất định (cột @db.Uuid)
      action: "RESET_RBAC_MATRIX",
      old_value: oldCfg?.value ? safeParse(oldCfg.value) : null,
      new_value: DEFAULT_ROLE_FEATURES,
      reason: `${user.full_name} (${user.id}) khôi phục ma trận hiển thị menu về mặc định`,
    });

    // Sinh lại roleRoutes từ mặc định (mọi vai luôn có "/")
    const roleRoutes: Record<string, string[]> = {};
    for (const [role, features] of Object.entries(DEFAULT_ROLE_FEATURES)) {
      const routes: string[] = ["/"];
      for (const featId of features) {
        const feat = FEATURE_MAP.find((f) => f.id === featId);
        if (feat) routes.push(...feat.routes);
      }
      roleRoutes[role] = Array.from(new Set(routes));
    }

    return NextResponse.json({
      success: true,
      message: "Đã khôi phục ma trận hiển thị menu về mặc định.",
      data: { roleFeatures: DEFAULT_ROLE_FEATURES, roleRoutes },
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
