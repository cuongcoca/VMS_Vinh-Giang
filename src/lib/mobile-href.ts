/**
 * Helper for mobile standalone builds.
 * Khi BASE_PATH trùng với role prefix (vd: /thukho, /kiemke),
 * Next.js Link đã tự thêm basePath nên ta cần strip tiền tố role
 * để tránh URL bị lặp (/thukho/thukho/pallet).
 *
 * Ví dụ khi BASE_PATH = "/thukho":
 *   mobileHref("/thukho")         → "/"
 *   mobileHref("/thukho/pallet")  → "/pallet"
 *   mobileHref("/thukho/profile") → "/profile"
 *
 * Khi BASE_PATH = "/wms" (admin):
 *   mobileHref("/thukho")         → "/thukho"  (giữ nguyên)
 *   mobileHref("/thukho/pallet")  → "/thukho/pallet"  (giữ nguyên)
 */

const STANDALONE_ROLES = ["/thukho", "/kiemke"];

export function mobileHref(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/wms";

  for (const role of STANDALONE_ROLES) {
    if (basePath === role && path.startsWith(role)) {
      const stripped = path.slice(role.length);
      return stripped || "/";
    }
  }

  return path;
}

/**
 * Check if current pathname is active for a nav item.
 * Handles standalone builds where paths are stripped.
 */
export function isMobileActive(pathname: string, href: string, rolePrefix: string): boolean {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/wms";
  const isStandalone = basePath === rolePrefix;

  if (isStandalone) {
    const strippedHref = href.startsWith(rolePrefix) ? href.slice(rolePrefix.length) || "/" : href;
    if (strippedHref === "/") {
      return pathname === "/" || pathname === rolePrefix;
    }
    // Check both stripped and full path versions
    return pathname.startsWith(strippedHref) || pathname.startsWith(href);
  }

  // Non-standalone: normal matching
  if (href === rolePrefix) {
    return pathname === rolePrefix;
  }
  return pathname.startsWith(href);
}
