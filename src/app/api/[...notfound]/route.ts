import { NextResponse } from "next/server";

// WVG-64 / WMS-004 — Bắt mọi path /api/* KHÔNG khớp route nào → trả JSON 404
// thay cho trang HTML 404 (nguồn gây "Unexpected token '<'" khi client parse JSON).
// Catch-all có độ ưu tiên THẤP NHẤT nên không ảnh hưởng các route cụ thể sẵn có.
function notFound() {
  return NextResponse.json(
    { success: false, error: "API không tồn tại (404)." },
    { status: 404 }
  );
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
