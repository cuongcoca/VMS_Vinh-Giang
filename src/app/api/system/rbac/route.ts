import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FEATURE_MAP, DEFAULT_ROLE_FEATURES } from "@/lib/rbac";
import { requireAuth, requirePermission, apiErrorResponse } from "@/lib/auth-server";
import { logAudit, keyToUuid } from "@/lib/audit";

const CONFIG_KEY = "rbac_role_features";

// Hàm sinh roleRoutes từ roleFeatures
function generateRoleRoutes(roleFeatures: Record<string, string[]>) {
  const roleRoutes: Record<string, string[]> = {};
  
  Object.keys(roleFeatures).forEach(role => {
    const features = roleFeatures[role] || [];
    const routes: string[] = ["/"]; // Mọi vai trò luôn được vào trang chủ /
    
    features.forEach(featId => {
      const feat = FEATURE_MAP.find(f => f.id === featId);
      if (feat) {
        routes.push(...feat.routes);
      }
    });
    
    roleRoutes[role] = Array.from(new Set(routes));
  });

  return roleRoutes;
}

export async function GET(req: NextRequest) {
  try {
    // GET cấu hình RBAC: cho mọi user đã đăng nhập (layout của 5 vai trò đều cần nạp roleRoutes).
    // PUT/lưu vẫn chỉ ADMIN.
    await requireAuth(req);
    const config = await prisma.systemConfig.findUnique({
      where: { key: CONFIG_KEY },
    });

    let roleFeatures = DEFAULT_ROLE_FEATURES;
    if (config && config.value) {
      try {
        roleFeatures = JSON.parse(config.value);
      } catch (e) {
        console.error("Lỗi parse JSON rbac_role_features:", e);
      }
    }

    const roleRoutes = generateRoleRoutes(roleFeatures);

    // WVG-34 / UC-AUTH-05: BỎ tiêm ADMIN full-access ("*") — legacy ADMIN/MANAGER/STAFF
    // đã di trú sang QUAN_LY (WVG-16) và bị deny-by-default ở ma trận enforce. Trước đây
    // response gắn ADMIN: ["*"] khiến FE hiển thị "toàn quyền" sai lệch (đúng điều Audit nêu).
    // Nay chỉ trả cấu hình 5 vai baseline; menu do ma trận thật + guard server quyết định.
    return NextResponse.json({
      success: true,
      data: {
        roleFeatures,
        roleRoutes,
        featureMap: FEATURE_MAP,
        defaultRoleFeatures: DEFAULT_ROLE_FEATURES,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { user } = await requirePermission(req, "system", "special");
    const body = await req.json();
    const { roleFeatures } = body;

    if (!roleFeatures || typeof roleFeatures !== "object") {
      return NextResponse.json({ success: false, error: "Dữ liệu ma trận phân quyền không hợp lệ." }, { status: 400 });
    }

    // Bảo vệ: ADMIN, MANAGER, STAFF không được phép sửa đổi
    const protectedRoles = ["ADMIN", "MANAGER", "STAFF"];
    protectedRoles.forEach(role => {
      delete roleFeatures[role];
    });

    // Chỉ cho phép lưu cấu hình các vai trò hợp lệ
    const allowedRoles = ["QUAN_LY", "KE_TOAN", "THU_KHO", "XE_NANG", "KIEM_KE"];
    const sanitizedRoleFeatures: Record<string, string[]> = {};
    
    allowedRoles.forEach(role => {
      if (Array.isArray(roleFeatures[role])) {
        // Lọc để chỉ giữ lại các feature ID hợp lệ
        sanitizedRoleFeatures[role] = roleFeatures[role].filter((featId: string) => 
          FEATURE_MAP.some(f => f.id === featId)
        );
      } else {
        // Fallback về mặc định nếu thiếu hoặc sai cấu trúc
        sanitizedRoleFeatures[role] = DEFAULT_ROLE_FEATURES[role] || [];
      }
    });

    // Snapshot old để ghi audit
    const oldConfig = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
    const oldValue = oldConfig?.value ? safeParse(oldConfig.value) : DEFAULT_ROLE_FEATURES;

    // Lưu vào database
    const saved = await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: JSON.stringify(sanitizedRoleFeatures) },
      create: {
        key: CONFIG_KEY,
        value: JSON.stringify(sanitizedRoleFeatures),
        label: "Ma trận phân quyền vai trò người dùng"
      },
    });

    // Ghi audit cho thay đổi RBAC (CP-10 — cần truy vết ai/khi nào sửa quyền)
    await logAudit(req, {
      entity_type: "system_config",
      entity_id: keyToUuid(saved.key), // key chuỗi → UUID tất định (cột @db.Uuid)
      action: "UPDATE_RBAC_MATRIX",
      old_value: oldValue,
      new_value: sanitizedRoleFeatures,
      reason: `Admin ${user.full_name} (${user.id}) cập nhật ma trận phân quyền`,
    });

    const roleRoutes = generateRoleRoutes(sanitizedRoleFeatures);

    return NextResponse.json({
      success: true,
      message: "Cập nhật cấu hình phân quyền thành công.",
      data: {
        roleFeatures: sanitizedRoleFeatures,
        roleRoutes,
      }
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function safeParse(s: string): Record<string, string[]> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
