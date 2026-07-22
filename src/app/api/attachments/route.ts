import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES_PER_ENTITY = 10;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// GET /api/attachments?entity_type=...&entity_id=...
export async function GET(req: NextRequest) {
  try {
    const entity_type = req.nextUrl.searchParams.get("entity_type") || "";
    const entity_id = req.nextUrl.searchParams.get("entity_id") || "";

    if (!entity_type || !entity_id) {
      return NextResponse.json({ success: false, error: "Thiếu entity_type hoặc entity_id." }, { status: 400 });
    }

    const attachments = await prisma.attachment.findMany({
      where: { entity_type, entity_id },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ success: true, data: attachments });
  } catch (error) {
    console.error("GET /api/attachments error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

// POST /api/attachments — Upload file đính kèm
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const entity_type = formData.get("entity_type") as string;
    const entity_id = formData.get("entity_id") as string;
    const note = formData.get("note") as string | null;

    if (note && note.length > 500) {
      return NextResponse.json({ success: false, error: "Mô tả ảnh không được vượt quá 500 ký tự." }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ success: false, error: "Thiếu file." }, { status: 400 });
    }
    if (!entity_type || !entity_id) {
      return NextResponse.json({ success: false, error: "Thiếu entity_type hoặc entity_id." }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ success: false, error: "Chỉ chấp nhận ảnh (JPEG, PNG, WebP, GIF)." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: "File quá lớn (tối đa 5MB)." }, { status: 400 });
    }

    // Check max files per entity
    const existingCount = await prisma.attachment.count({ where: { entity_type, entity_id } });
    if (existingCount >= MAX_FILES_PER_ENTITY) {
      return NextResponse.json({ success: false, error: `Tối đa ${MAX_FILES_PER_ENTITY} file mỗi đối tượng.` }, { status: 400 });
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const uniqueName = `${entity_type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Save record to DB
    const attachment = await prisma.attachment.create({
      data: {
        entity_type,
        entity_id,
        file_url: `/api/uploads/${uniqueName}`,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        note: note?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, data: attachment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/attachments error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi upload." }, { status: 500 });
  }
}
