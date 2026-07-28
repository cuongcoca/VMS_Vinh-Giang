import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";
import { guardPermission } from "@/lib/auth-server";

// DELETE /api/attachments/[id] — Xóa file đính kèm
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardPermission(_req, "attachment", "write");
  if (denied) return denied;
  try {
    const { id } = await params;
    const attachment = await prisma.attachment.findUnique({ where: { id } });

    if (!attachment) {
      return NextResponse.json({ success: false, error: "Không tìm thấy." }, { status: 404 });
    }

    // Delete file from disk.
    // attachment.file_url dạng "/api/uploads/<name>" — chỉ lấy basename để chống path traversal,
    // và resolve về UPLOAD_DIR thực (public/uploads), không phải public/api/uploads (bug cũ).
    const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
    const filename = path.basename(attachment.file_url);
    const filePath = path.join(UPLOAD_DIR, filename);
    try {
      await unlink(filePath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT") {
        console.warn("[attachments/delete] unlink failed:", filePath, err);
      }
    }

    // Delete DB record
    await prisma.attachment.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Đã xóa file đính kèm." });
  } catch (error) {
    console.error("DELETE /api/attachments/[id] error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}
