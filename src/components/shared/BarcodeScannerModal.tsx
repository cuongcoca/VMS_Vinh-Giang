"use client";

/**
 * UC-INT-01 / UC-PAL-03 / UC-INV-06: Modal full-screen quét mã (mobile-friendly).
 *
 * Cách dùng:
 *   const [open, setOpen] = useState(false);
 *   <BarcodeScannerModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onScan={(code) => { console.log(code); setOpen(false); }}
 *     title="Quét mã hàng"
 *     allowManualInput
 *   />
 *
 * Note: import dynamic để tránh SSR (camera là browser-only):
 *   const BarcodeScannerModal = dynamic(
 *     () => import("@/components/shared/BarcodeScannerModal").then(m => m.BarcodeScannerModal),
 *     { ssr: false }
 *   );
 */

import React, { useState, useRef, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { BarcodeScanner } from "./BarcodeScanner";

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
  /** Cho phép gõ tay khi camera không hoạt động hoặc không nhận */
  allowManualInput?: boolean;
  /** Cho phép mở picker ảnh từ thư viện (xử lý OCR mã ở server, hiện stub) */
  allowFromGallery?: boolean;
};

class ScannerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ScannerErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-zinc-900 border border-amber-500 rounded-lg text-amber-200 text-xs w-full max-w-md mx-auto space-y-2">
          <p className="font-bold text-sm text-amber-400">⚠️ Lỗi dựng giao diện quét mã (React UI Error)</p>
          <p className="font-mono bg-black/50 p-2 rounded break-all">{this.state.error?.message || "Unknown error"}</p>
          <div className="text-[10px] opacity-75 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto bg-black/30 p-2 rounded">
            {this.state.error?.stack}
          </div>
          <p className="text-white/70">Vui lòng thử chụp ảnh mã vạch bằng nút <b>Ảnh</b> hoặc dùng <b>Nhập tay</b>.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function BarcodeScannerModal({
  open,
  onClose,
  onScan,
  title = "Quét mã",
  allowManualInput = true,
  // Bật mặc định: đọc mã từ ẢNH (scanFile) ở full-res là cách đáng tin nhất cho
  // mã vạch 1D trên iOS khi quét camera trực tiếp chập chờn.
  allowFromGallery = true,
}: Props) {
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [decodingImage, setDecodingImage] = useState(false);
  // Camera trình duyệt CHỈ chạy trong "secure context" (HTTPS chứng chỉ hợp lệ hoặc
  // localhost). Mở bằng IP + chứng chỉ tự ký (vd https://188.166.210.73) → không bảo mật
  // → trình duyệt (nhất là iOS Safari) ẩn navigator.mediaDevices → camera bị chặn.
  // Phát hiện sớm để KHÔNG mount viewfinder (chỉ quay vòng vô ích) mà hướng dẫn dùng "Ảnh".
  const [cameraBlocked, setCameraBlocked] = useState(false);
  useEffect(() => {
    if (!open) return;
    const secure =
      typeof window !== "undefined" &&
      window.isSecureContext &&
      !!navigator.mediaDevices?.getUserMedia;
    setCameraBlocked(!secure);
  }, [open]);

  // KK-20 / SH-17: khoa scroll nen khi mo + dong bang phim Escape.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleScanSuccess = (code: string) => {
    onScan(code);
  };

  const handleScanError = (err: Error) => {
    const isPermission = err.message?.includes("Permission") || err.message?.includes("NotAllowed");
    const isNotFound = err.message?.includes("NotFound") || err.message?.includes("Requested device not found");

    setErrorMsg(
      isPermission
        ? "Truy cập camera bị từ chối. Bạn cần cấp quyền trong cài đặt trình duyệt."
        : `Lỗi camera: ${err.message}`,
    );

    // Chỉ tự động chuyển sang Nhập tay nếu camera bị chặn quyền hoặc thiết bị hoàn toàn không có camera.
    // Các lỗi khởi động khác (bận thiết bị, lỗi chuyển camera) sẽ được hiển thị và xử lý trong viewfinder.
    if (isPermission || isNotFound) {
      setManualMode(true);
    }
  };

  const handleManualSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (manualInput.trim()) onScan(manualInput.trim());
  };

  // TC_SCAN_PAL_001: chọn ảnh từ thư viện → giải mã barcode/QR bằng html5-qrcode (lib đã có).
  const handlePickImage = () => {
    setErrorMsg(null);
    fileInputRef.current?.click();
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset để chọn lại đúng file vẫn trigger onChange
    if (!file) return;
    setDecodingImage(true);
    setErrorMsg(null);
    try {
      const scanner = new Html5Qrcode("bcsm-file-reader");
      const decoded = await scanner.scanFile(file, false);
      try { await scanner.clear(); } catch { /* ignore cleanup */ }
      const code =
        typeof decoded === "string"
          ? decoded
          : (decoded as { decodedText?: string })?.decodedText;
      if (code) onScan(code);
      else setErrorMsg("Lỗi quét thất bại. Không đọc được mã từ ảnh. Hãy thử ảnh khác hoặc nhập tay.");
    } catch {
      setErrorMsg("Lỗi quét thất bại. Không đọc được mã từ ảnh. Hãy chọn ảnh rõ nét hơn hoặc nhập tay.");
    } finally {
      setDecodingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" role="dialog" aria-modal="true" aria-label={title}>
      {/* Top bar */}
      <div
        className="bg-zinc-900 text-white px-4 py-3 flex items-center justify-between shadow"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center hover:bg-white/10 rounded-lg"
          aria-label="Đóng"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        <span className="text-sm font-semibold">{title}</span>
        <span className="w-11" />
      </div>

      {/* Camera / Manual area */}
      <div className="flex-1 flex flex-col items-center justify-center py-4 px-1 overflow-hidden w-full">
        {errorMsg && (
          <div className="w-full max-w-md px-4 mb-3">
            <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-amber-400">warning</span>
              <span className="flex-1">{errorMsg}</span>
            </div>
          </div>
        )}

        {/* Camera bị chặn (trang không bảo mật): KHÔNG mount viewfinder, hướng dẫn rõ ràng. */}
        {cameraBlocked && !manualMode && (
          <div className="w-full max-w-md px-2">
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-center space-y-3">
              <span className="material-symbols-outlined text-[40px] text-amber-400">no_photography</span>
              <p className="text-white font-semibold text-sm">Camera chưa dùng được ở địa chỉ này</p>
              <p className="text-white/70 text-xs leading-relaxed">
                Trình duyệt chỉ cho bật camera khi mở app bằng địa chỉ bảo mật. Hãy mở app bằng tên miền:
              </p>
              <p className="text-emerald-300 font-mono text-xs break-all bg-black/40 rounded-lg py-2 px-2">
                https://khohangvinhgiang.io.vn
              </p>
              <p className="text-white/70 text-xs">
                Hoặc quét ngay bằng cách <b className="text-white">chụp / chọn ảnh</b> mã:
              </p>
              <button
                type="button"
                onClick={handlePickImage}
                disabled={decodingImage}
                className="w-full py-3 bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                {decodingImage ? "Đang đọc ảnh…" : "Chụp / chọn ảnh mã"}
              </button>
              <p className="text-white/40 text-[11px]">…hoặc bấm <b>Nhập tay</b> bên dưới để gõ mã.</p>
            </div>
          </div>
        )}

        {/* Vùng Camera: luôn luôn mount khi modal mở, nhưng ẩn đi bằng CSS khi ở manualMode.
            Điều này ngăn chặn việc mount/unmount liên tục gây lỗi race condition cho camera.
            Chỉ mount khi thực sự có secure context (cameraBlocked=false). */}
        <div className={`w-full max-w-2xl flex flex-col items-center ${manualMode || cameraBlocked ? "hidden" : ""}`}>
          <p className="text-white/70 text-xs mb-3 text-center">Đưa mã vạch lấp ĐẦY chiều ngang khung, giữ cách ~15cm cho nét</p>
          <div className="w-full">
            <ScannerErrorBoundary>
              {!cameraBlocked && (
                <BarcodeScanner
                  onScan={handleScanSuccess}
                  onError={handleScanError}
                  showTorch
                />
              )}
            </ScannerErrorBoundary>
          </div>
          <p className="text-white/50 text-[11px] md:text-xs mt-3 text-center">
            📦 Đang chờ quét… khó đọc thì bấm <b>Ảnh</b> để chụp/chọn ảnh mã vạch
          </p>
        </div>

        {/* Vùng Nhập tay */}
        {manualMode && (
          <form onSubmit={handleManualSubmit} className="w-full max-w-md">
            <label className="text-white/80 text-xs block mb-2">Nhập mã thủ công</label>
            <input
              autoFocus
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="VD: 8938523103142"
              className="w-full px-3 py-3 rounded-lg bg-white text-zinc-900 text-base font-mono focus:outline-none"
            />
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="mt-3 w-full py-3 bg-emerald-500 text-white font-bold rounded-lg disabled:opacity-50"
            >
              ✓ Xác nhận
            </button>
          </form>
        )}
      </div>

      {/* Bottom actions */}
      <div
        className="bg-zinc-900 text-white p-3 flex justify-around items-center gap-2 text-xs"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        {allowFromGallery && (
          <button
            type="button"
            onClick={handlePickImage}
            disabled={decodingImage}
            className="flex flex-col items-center gap-1 disabled:opacity-40"
            title="Chọn ảnh chứa mã vạch/QR" aria-label="Chọn ảnh chứa mã vạch/QR"
          >
            <span className="material-symbols-outlined text-[22px]">image</span>
            {decodingImage ? "Đang đọc…" : "Ảnh"}
          </button>
        )}
        {allowManualInput && (
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setManualMode((v) => !v);
            }}
            className={`flex flex-col items-center gap-1 ${manualMode ? "text-amber-300" : ""}`}
          >
            <span className="material-symbols-outlined text-[22px]">
              {manualMode ? "qr_code_scanner" : "keyboard"}
            </span>
            {manualMode ? "Quét lại" : "Nhập tay"}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex flex-col items-center gap-1"
        >
          <span className="material-symbols-outlined text-[22px]">close</span>
          Đóng
        </button>
      </div>

      {/* TC_SCAN_PAL_001: input ẩn + element cho html5-qrcode.scanFile (giải mã ảnh) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelected}
      />
      <div id="bcsm-file-reader" className="hidden" />
    </div>
  );
}
