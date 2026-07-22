import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jfif": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

// GET /api/uploads/<filename> — serve file từ public/uploads/
// Workaround: Next.js 16 production build không tự serve runtime files trong public/
// nên cần route handler stream từ filesystem.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await context.params;
    if (!segments?.length) {
      return new NextResponse("Not found", { status: 404 });
    }

    const safeRel = segments.join("/");
    if (safeRel.includes("..") || safeRel.includes("\0")) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const filePath = path.join(UPLOAD_DIR, safeRel);
    if (!filePath.startsWith(UPLOAD_DIR)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const stats = await stat(filePath);
    if (!stats.isFile()) {
      return new NextResponse("Not found", { status: 404 });
    }

    const buffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return new NextResponse("Not found", { status: 404 });
    }
    console.error("GET /api/uploads error:", e);
    return new NextResponse("Server error", { status: 500 });
  }
}
