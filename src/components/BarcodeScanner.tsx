"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";

/**
 * UC-PAL-03 — Đa phương thức quét mã.
 *
 * Hỗ trợ 3 chế độ:
 *  1. CAMERA  — html5-qrcode, switch front/rear, torch (nếu thiết bị hỗ trợ),
 *               continuous mode (quét liên tục nhiều mã), formats: QR + barcodes
 *               (Code-128, EAN-13, EAN-8, UPC-A, Code-39, ...).
 *  2. USB HID — USB barcode scanner gõ ký tự rất nhanh kèm Enter. Capture
 *               keypress events, debounce 50ms, fire onScan khi gặp Enter.
 *  3. MANUAL  — gõ tay, hữu ích khi camera fail hoặc không có scanner.
 */

interface BarcodeScannerProps {
  isOpen: boolean;
  onScan: (code: string) => void;
  onClose: () => void;
  title?: string;
  /** Nếu true, không tự đóng modal sau mỗi lần quét (cho add nhiều dòng). */
  continuous?: boolean;
}

type Mode = "camera" | "gallery" | "manual";

interface CameraDevice {
  id: string;
  label: string;
}

export function BarcodeScanner({
  isOpen,
  onScan,
  onClose,
  title = "Quét mã hàng / QR / Barcode",
  continuous: continuousDefault = false,
}: BarcodeScannerProps) {
  // STABLE inner-div id: html5-qrcode mutates DOM inside this div.
  // KHÔNG dùng cùng div với React ref → tránh "removeChild" conflict khi unmount.
  const innerIdRef = useRef(`bc-region-${Math.random().toString(36).slice(2, 10)}`);
  const html5QrRef = useRef<unknown>(null);
  // Mutex tuần tự hoá start/stop camera — sửa lỗi double camera.
  const opChainRef = useRef<Promise<void>>(Promise.resolve());
  const runningCamRef = useRef<string | null>(null);
  // Đã liệt kê camera chưa — dùng ref (KHÔNG dùng state) để startCamera giữ
  // identity ổn định. Trước đây phụ thuộc `cameras.length`: lần quét đầu gọi
  // setCameras() làm đổi identity → effect lifecycle chạy lại → STOP camera vừa
  // mở (gốc lỗi "quét 1 lần xong không quét lại được").
  const enumeratedRef = useRef(false);
  const [mode, setMode] = useState<Mode>("camera");
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [continuous, setContinuous] = useState(continuousDefault);
  const [recent, setRecent] = useState<string[]>([]);
  const [decodingImage, setDecodingImage] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [showLowLightWarning, setShowLowLightWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -----------------------------------------------------------------
  // Camera lifecycle
  // -----------------------------------------------------------------
  const stopScanner = useCallback(() => {
    // Nối vào hàng đợi mutex — đảm bảo stop chạy tuần tự, không đua với start.
    opChainRef.current = opChainRef.current.then(async () => {
      const scanner = html5QrRef.current as
        | { isScanning: boolean; stop: () => Promise<void>; clear?: () => void }
        | null;
      if (!scanner) return;
      html5QrRef.current = null;
      runningCamRef.current = null;
      try {
        if (scanner.isScanning) await scanner.stop();
      } catch {
        // Ignore — camera có thể đã stop bên trong thư viện
      }
      // clear() gỡ <video>/<canvas> thư viện chèn vào region + reset state nội
      // bộ. Thiếu bước này → lần mở lại dựng Html5Qrcode trên region còn rác →
      // throw ngầm và camera không chạy ("quét 1 lần xong chết").
      try {
        scanner.clear?.();
      } catch {
        // ignore
      }
    });
    return opChainRef.current;
  }, []);

  const startCamera = useCallback(
    (requestedId?: string) => {
      // Toàn bộ start nối vào CÙNG hàng đợi với stop → KHÔNG BAO GIỜ hai camera chồng nhau.
      opChainRef.current = opChainRef.current.then(async () => {
        // Đã đang quét ĐÚNG camera yêu cầu → bỏ qua, tránh khởi tạo TRÙNG (double camera).
        const current = html5QrRef.current as { isScanning?: boolean } | null;
        if (current && current.isScanning && (!requestedId || requestedId === runningCamRef.current)) {
          return;
        }
        // Dừng HẲN instance cũ TRƯỚC khi mở cái mới — await đầy đủ, không để 2 stream chồng.
        if (current) {
          html5QrRef.current = null;
          runningCamRef.current = null;
          try {
            const s = current as { isScanning?: boolean; stop?: () => Promise<void> };
            if (s.isScanning && s.stop) await s.stop();
          } catch {
            // ignore
          }
        }

        setIsStarting(true);
        setError(null);
        setTorchOn(false);
        setTorchSupported(false);

        let cameraId = requestedId;
        try {
          const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

          // Enumerate cameras on first start (1 lần / vòng đời component).
          if (!enumeratedRef.current) {
            enumeratedRef.current = true;
            try {
              const devices = await Html5Qrcode.getCameras();
              const mapped = devices.map((d: { id: string; label: string }) => ({
                id: d.id,
                label: d.label || `Camera ${d.id.slice(0, 8)}`,
              }));
              setCameras(mapped);
              if (!cameraId && mapped.length > 0) {
                const rear =
                  mapped.find((c: CameraDevice) => /back|rear|environment/i.test(c.label)) ??
                  mapped[mapped.length - 1];
                cameraId = rear.id;
                setActiveCameraId(rear.id);
              }
            } catch {
              // getCameras may fail silently — fall through to facingMode
            }
          }

          // Đảm bảo div đích đã render
          if (!document.getElementById(innerIdRef.current)) {
            setIsStarting(false);
            return;
          }

          const html5Qr = new Html5Qrcode(innerIdRef.current, {
            verbose: false,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.QR_CODE,
            ],
            useBarCodeDetectorIfSupported: false,
          });
          html5QrRef.current = html5Qr;

          const isMobile = typeof navigator !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
          );

          const cameraConstraint = cameraId
            ? { deviceId: { exact: cameraId } }
            : (isMobile ? { facingMode: "environment" } : { video: true });

          await html5Qr.start(
            cameraConstraint,
            {
              fps: 10,
              qrbox: { width: 280, height: 180 }, // wider for 1D barcodes
              aspectRatio: 1.5,
            },
            (decodedText: string) => {
              handleHit(decodedText);
            },
            () => {
              // Ignore per-frame scan failures
            },
          );
          runningCamRef.current = cameraId ?? "default";

          // Detect torch support (Chrome only)
          try {
            const stream = (
              html5Qr as unknown as { getRunningTrackCameraCapabilities?: () => { torchFeature?: () => { isSupported: () => boolean } } }
            ).getRunningTrackCameraCapabilities?.();
            if (stream && typeof stream.torchFeature === "function") {
              const torch = stream.torchFeature();
              if (torch && torch.isSupported()) setTorchSupported(true);
            }
          } catch {
            // ignore
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("NotAllowedError") || message.includes("Permission")) {
            setError(
              "Không có quyền truy cập camera. Mở Cài đặt của trình duyệt để cấp quyền, hoặc chuyển sang USB / Nhập tay.",
            );
          } else if (
            message.includes("NotFoundError") ||
            message.includes("Requested device")
          ) {
            setError("Không tìm thấy camera. Chuyển sang USB hoặc Nhập tay.");
          } else if (message.includes("getUserMedia")) {
            setError("Trình duyệt không hỗ trợ camera trên HTTP (cần HTTPS).");
          } else {
            setError("Không thể khởi động camera: " + message);
          }
        } finally {
          setIsStarting(false);
        }
      });
      return opChainRef.current;
    },
    // KHÔNG phụ thuộc state nào → identity ổn định, effect lifecycle không bị
    // chạy lại oan khi enumerate camera. Mọi giá trị động đọc qua ref.
    [],
  );

  // Toggle torch
  const toggleTorch = useCallback(async () => {
    if (!html5QrRef.current) return;
    try {
      const scanner = html5QrRef.current as {
        applyVideoConstraints?: (c: MediaTrackConstraints) => Promise<void>;
      };
      // @ts-expect-error — torch is non-standard
      await scanner.applyVideoConstraints?.({ advanced: [{ torch: !torchOn }] });
      setTorchOn((v) => !v);
    } catch (err) {
      console.warn("Torch toggle failed", err);
    }
  }, [torchOn]);

  // Cảnh báo môi trường tối/khó đọc sau 10 giây
  useEffect(() => {
    if (isStarting || error || mode !== "camera" || !isOpen) {
      setShowLowLightWarning(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowLowLightWarning(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [isStarting, error, mode, isOpen]);

  // Timeout 15s nếu không quét được mã QR/Barcode (UC-FK-02_TC15 / UC-FK-03_TC18)
  useEffect(() => {
    if (isStarting || error || mode !== "camera" || !isOpen) {
      return;
    }
    const timer = setTimeout(() => {
      setError("Không đọc được mã QR. Vui lòng làm sạch mã, cải thiện ánh sáng hoặc nhập tay.");
    }, 15000);
    return () => clearTimeout(timer);
  }, [isStarting, error, mode, isOpen]);

  // -----------------------------------------------------------------
  // Mode switching
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }
    if (mode === "camera") {
      const timer = setTimeout(() => startCamera(activeCameraId ?? undefined), 250);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
    return undefined;
  }, [isOpen, mode, activeCameraId, startCamera, stopScanner]);

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset
    if (!file) return;
    setDecodingImage(true);
    setGalleryError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("bcs-file-reader");
      const decoded = await scanner.scanFile(file, false);
      try { await scanner.clear(); } catch { /* ignore */ }
      const code =
        typeof decoded === "string"
          ? decoded
          : (decoded as { decodedText?: string })?.decodedText;
      if (code) {
        handleHit(code);
      } else {
        setGalleryError("Lỗi quét thất bại. Không đọc được mã từ ảnh. Hãy thử ảnh rõ nét hơn hoặc nhập tay.");
      }
    } catch {
      setGalleryError("Lỗi quét thất bại. Không đọc được mã từ ảnh. Hãy chọn ảnh rõ nét hơn hoặc nhập tay.");
    } finally {
      setDecodingImage(false);
    }
  };

  // -----------------------------------------------------------------
  // Common scan-hit handler — used by all modes
  // -----------------------------------------------------------------
  function handleHit(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setRecent((r) => [trimmed, ...r.filter((x) => x !== trimmed)].slice(0, 5));
    onScan(trimmed);
    if (!continuous) {
      stopScanner();
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleHit(manualCode.trim());
      setManualCode("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[20px] text-primary">qr_code_scanner</span>
            <h3 className="font-semibold text-sm truncate">{title}</h3>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-low transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-outline-variant">
          {[
            { value: "camera" as Mode, label: "Camera", icon: "videocam" },
            { value: "gallery" as Mode, label: "Chọn ảnh", icon: "image" },
            { value: "manual" as Mode, label: "Nhập tay", icon: "edit" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                mode === opt.value
                  ? "text-primary border-primary bg-primary/5"
                  : "text-on-surface-variant border-transparent hover:bg-surface-low"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto">
          {mode === "camera" && (
            <>
              <p className="text-xs text-on-surface-variant mb-2 text-center">
                Màn hướng camera vào mã qr để quét tự động
              </p>
              <div className="w-full rounded-xl overflow-hidden bg-primary min-h-[260px] flex items-center justify-center relative">
                {/* INNER div — html5-qrcode mutates here, React không track */}
                <div id={innerIdRef.current} className="w-full" />
                {isStarting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white pointer-events-none">
                    <span className="material-symbols-outlined animate-spin text-[32px]">
                      progress_activity
                    </span>
                    <p className="text-sm">Đang khởi động camera...</p>
                  </div>
                )}
              </div>

              {/* Camera controls */}
              {!isStarting && !error && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {cameras.length > 1 && (
                    <select
                      value={activeCameraId ?? ""}
                      onChange={(e) => setActiveCameraId(e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1.5 border border-outline-variant rounded-lg text-xs"
                    >
                      {cameras.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {torchSupported && (
                    <button
                      onClick={toggleTorch}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                        torchOn
                          ? "bg-amber-100 text-amber-700"
                          : "bg-surface-low text-on-surface-variant hover:bg-surface-mid"
                      }`}
                      title="Bật/tắt đèn" aria-label="Bật/tắt đèn"
                    >
                      <span className="material-symbols-outlined text-[16px]">flashlight_on</span>
                      {torchOn ? "Tắt đèn" : "Đèn pin"}
                    </button>
                  )}
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={continuous}
                      onChange={(e) => setContinuous(e.target.checked)}
                      className="rounded"
                    />
                    Quét liên tục
                  </label>
                </div>
              )}

              {showLowLightWarning && (
                <div className="mt-2 text-center bg-amber-500/20 border border-amber-500/40 p-2.5 rounded-lg text-amber-300 text-xs flex items-center justify-center gap-1.5 animate-pulse">
                  <span className="material-symbols-outlined text-[16px]">wb_incandescent</span>
                  <span>Ánh sáng yếu hoặc mã mờ? Thử bật đèn pin 🔦 hoặc dùng Nhập tay / Ảnh.</span>
                </div>
              )}
            </>
          )}

          {mode === "gallery" && (
            <div className="text-center py-6 px-4 bg-surface-low rounded-xl">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-[28px] text-primary">image</span>
              </div>
              <p className="text-sm font-semibold mb-1">Quét từ thư viện ảnh</p>
              <p className="text-xs text-on-surface-variant mb-4">
                Chọn ảnh chứa mã vạch hoặc mã QR rõ nét để giải mã.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={decodingImage}
                className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/95 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {decodingImage ? "progress_activity" : "photo_library"}
                </span>
                {decodingImage ? "Đang giải mã..." : "Chọn ảnh"}
              </button>
              {galleryError && (
                <p className="mt-3 text-rose-600 text-xs font-semibold">{galleryError}</p>
              )}
            </div>
          )}

          {mode === "manual" && (
            <form onSubmit={handleManualSubmit}>
              <p className="text-xs text-on-surface-variant mb-2">Gõ mã hàng / QR / barcode:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="vd: VG-001 hoặc 8934567890123"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="flex-1 px-3 py-2 border border-outline-variant rounded-lg text-sm font-mono"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  Quét
                </button>
              </div>
            </form>
          )}

          {/* Error */}
          {mode === "camera" && error && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-500 text-[18px] mt-0.5">
                  warning
                </span>
                <div className="flex-1">
                  <p className="text-xs text-amber-700">{error}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setMode("gallery")}
                      className="px-2 py-1 bg-white border border-amber-300 rounded text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                    >
                      → Ảnh
                    </button>
                    <button
                      onClick={() => setMode("manual")}
                      className="px-2 py-1 bg-white border border-amber-300 rounded text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                    >
                      → Nhập tay
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent scans (when continuous) */}
          {recent.length > 0 && (
            <div className="mt-4 pt-3 border-t border-outline-variant">
              <p className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold mb-1.5">
                Vừa quét ({recent.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((c, i) => (
                  <span
                    key={`${c}-${i}`}
                    className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-mono text-emerald-700"
                  >
                    ✓ {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelected}
      />
      <div id="bcs-file-reader" className="hidden" />
    </div>
  );
}
