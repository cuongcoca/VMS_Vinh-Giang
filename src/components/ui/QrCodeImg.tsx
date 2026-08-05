"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Sinh QR ngay tại trình duyệt (dùng browser build của `qrcode`) rồi hiển thị
 * bằng <img> data-URL.
 *
 * Vì sao KHÔNG gọi endpoint /api/.../qr-png:
 *   Endpoint đó yêu cầu header `Authorization: Bearer` (auth-server.requireAuth),
 *   nhưng request ảnh của thẻ <img> KHÔNG mang được header đó → luôn 401 → ảnh vỡ.
 *   Sinh client-side bỏ hẳn phụ thuộc auth, in được cả khi mạng chập chờn, và ra
 *   đúng QR như server (cùng mã text, cùng mức sửa lỗi H).
 */
export function QrCodeImg({
  value,
  size = 400,
  className,
  alt,
}: {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    QRCode.toDataURL(value, {
      width: size,
      margin: 3,
      errorCorrectionLevel: "H", // cao nhất — chịu mờ/bám bụi tới ~30%
    })
      .then((url) => {
        if (alive) setDataUrl(url);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [value, size]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-low text-on-surface-variant text-xs ${className || ""}`}
        aria-label={alt}
      >
        <span className="material-symbols-outlined text-[28px] opacity-40">broken_image</span>
      </div>
    );
  }

  // Giữ khung vuông trong lúc chờ sinh xong để layout không nhảy.
  if (!dataUrl) {
    return <div className={`bg-surface-low animate-pulse ${className || ""}`} aria-label={alt} />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt={alt} className={className} />;
}
