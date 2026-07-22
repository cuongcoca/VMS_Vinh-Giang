import type { NextConfig } from "next";

const basePath = process.env.BASE_PATH || '/wms';

// Standalone mobile builds: basePath trùng tên thư mục source code
// (/thukho, /kiemke) gây double-prefix. Cần rewrite để bridge.
// Ví dụ: basePath=/thukho, URL /thukho/pallet → internal route /pallet
// Nhưng source ở src/app/thukho/pallet → cần rewrite /pallet → /thukho/pallet
const STANDALONE_ROLE_ROUTES: Record<string, string[]> = {
  '/thukho': ['inbound', 'pallet', 'adhoc', 'warehouse', 'profile', 'item-code'],
  '/kiemke': ['tasks', 'scan', 'history', 'profile'],
};

const nextConfig: NextConfig = {
  basePath: basePath,
  distDir: ({ '/xenang': '.next-xenang', '/thukho': '.next-thukho', '/kiemke': '.next-kiemke' } as Record<string, string>)[basePath] || '.next',
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: basePath,
        basePath: false,
        permanent: false,
      },
    ]
  },
  async rewrites() {
    const roleRoutes = STANDALONE_ROLE_ROUTES[basePath];
    if (!roleRoutes) return { beforeFiles: [], afterFiles: [], fallback: [] };

    const roleName = basePath.slice(1); // '/thukho' → 'thukho'

    // beforeFiles: rewrite TRƯỚC khi Next.js match route files
    // Quan trọng vì có route admin trùng tên (vd: /inbound, /profile)
    // Nếu dùng afterFiles, Next.js sẽ match /inbound → src/app/inbound/ (admin) 
    // thay vì rewrite /inbound → /thukho/inbound (mobile)
    const beforeFiles = roleRoutes.flatMap((route) => [
      // Exact match: /pallet → /thukho/pallet
      {
        source: `/${route}`,
        destination: `/${roleName}/${route}`,
      },
      // Catch-all: /pallet/xxx → /thukho/pallet/xxx
      {
        source: `/${route}/:path*`,
        destination: `/${roleName}/${route}/:path*`,
      },
    ]);

    return { beforeFiles, afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
