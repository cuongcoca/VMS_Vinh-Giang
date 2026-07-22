"use client";

/**
 * UC-INT-01: Component quét barcode / QR camera (reusable)
 *
 * Cách dùng:
 *   <BarcodeScanner onScan={(code) => ...} showTorch />
 *
 * Lưu ý:
 *   - Chỉ chạy trên client (browser API), phải bọc Suspense/dynamic import nếu render SSR.
 *   - Camera CHỈ hoạt động trong "secure context": HTTPS với chứng chỉ HỢP LỆ, hoặc localhost.
 *   - ⚠️ Mở bằng IP + chứng chỉ tự ký (vd https://188.166.210.73) → trình duyệt coi là KHÔNG
 *     bảo mật và CHẶN camera. Phải dùng tên miền HTTPS hợp lệ (vd khohangvinhgiang.io.vn).
 *   - Quyền camera bị deny / không có camera → onError được gọi với thông báo rõ ràng.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  type Html5QrcodeCameraScanConfig,
} from "html5-qrcode";

type Props = {
  /** Callback khi đọc được mã. Đã debounce 1 lần / 1.5s để tránh trigger liên tục */
  onScan: (text: string) => void;
  /** Callback lỗi (camera deny, không khởi tạo được, ...) */
  onError?: (err: Error) => void;
  /** Định dạng được hỗ trợ. Default: EAN-13, EAN-8, CODE-128, QR */
  formats?: Html5QrcodeSupportedFormats[];
  /** Hiện nút bật/tắt đèn pin (chỉ hoạt động trên một số camera Android) */
  showTorch?: boolean;
  /** Cấu hình scan, default fps=10, qrbox = khung chữ nhật rộng responsive (cho mã vạch 1D) */
  scanConfig?: Partial<Html5QrcodeCameraScanConfig>;
  /** Class wrapper */
  className?: string;
};

const DEFAULT_FORMATS: Html5QrcodeSupportedFormats[] = [
  Html5QrcodeSupportedFormats.EAN_13,   // Mã vạch sản phẩm FMCG thông dụng tại VN (893...)
  Html5QrcodeSupportedFormats.CODE_128, // Mã vạch pallet nội bộ và tem phụ
  Html5QrcodeSupportedFormats.QR_CODE,  // Mã QR thông thường
];

// Khung quét responsive: RỘNG GẦN HẾT bề ngang khung nhìn. html5-qrcode vẽ vùng quét
// xuống canvas có kích thước ĐÚNG BẰNG khung này (CSS px) rồi mới giải mã — nên khung
// càng rộng thì mã vạch 1D (EAN-13 có 95 vạch mảnh) càng nhiều pixel/vạch → đọc được.
// Khung hẹp/vuông là lý do điện thoại "không nhận mã vạch". Vẫn đủ cao để đọc QR.
function wideQrbox(viewfinderWidth: number, viewfinderHeight: number) {
  const width = Math.max(200, Math.floor(Math.min(viewfinderWidth, 640) * 0.95));
  const height = Math.max(150, Math.floor(Math.min(width * 0.5, viewfinderHeight * 0.6)));
  return { width, height };
}

export function BarcodeScanner({
  onScan,
  onError,
  formats,
  showTorch,
  scanConfig,
  className,
}: Props) {
  const innerIdRef = useRef(`bcs-${Math.random().toString(36).slice(2, 10)}`);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ text: string; ts: number }>({ text: "", ts: 0 });
  const isMountedRef = useRef(true);
  const startPromiseRef = useRef<Promise<any> | null>(null);

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamId, setSelectedCamId] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLowLightWarning, setShowLowLightWarning] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cảnh báo môi trường tối/khó đọc sau 10 giây
  useEffect(() => {
    if (!ready) {
      setShowLowLightWarning(false);
      return;
    }
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setShowLowLightWarning(true);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [ready]);

  // Timeout 15s nếu không quét được gì -> gọi onError báo lỗi (UC-FK-02_TC15 / UC-FK-03_TC18)
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        const errorMsg = "Không đọc được mã QR. Vui lòng làm sạch mã, cải thiện ánh sáng hoặc nhập tay.";
        setError(errorMsg);
        onErrorRef.current?.(new Error(errorMsg));
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [ready]);

  // 1. useEffect để liệt kê camera trên thiết bị (chạy 1 lần khi mount)
  useEffect(() => {
    let cancelled = false;

    // Camera cần "secure context". Mở bằng IP + chứng chỉ tự ký → mediaDevices bị chặn.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const insecure = typeof window !== "undefined" && !window.isSecureContext;
      onErrorRef.current?.(
        new Error(
          insecure
            ? "Trình duyệt chặn camera vì trang KHÔNG bảo mật (chứng chỉ không hợp lệ). Hãy mở app bằng tên miền HTTPS hợp lệ (vd https://khohangvinhgiang.io.vn) trên điện thoại."
            : "Thiết bị/trình duyệt này không hỗ trợ camera. Hãy dùng 'Nhập tay' hoặc 'Ảnh'.",
        ),
      );
      return;
    }

    const initCameras = async () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      try {
        // Hỏi quyền truy cập trước bằng getUserMedia để labels camera không bị rỗng
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());

        if (cancelled) return;

        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;

        const cams = devices
          .filter((d) => d.kind === "videoinput")
          .map((d) => ({
            id: d.deviceId,
            label: d.label || "",
          }));

        // Phân loại và gán nhãn thân thiện cho các camera vật lý
        const processedCams = cams.map((c, idx) => {
          const label = c.label.toLowerCase();
          let isRear = false;
          let isFront = false;

          if (/back|rear|environment|sau/i.test(label)) {
            isRear = true;
          } else if (/front|user|forward|trước/i.test(label)) {
            isFront = true;
          } else {
            // Đoán dựa trên vị trí index của camera nếu nhãn trống
            if (cams.length > 1) {
              if (idx === cams.length - 1) {
                isRear = true;
              } else if (idx === 0) {
                isFront = true;
              }
            } else {
              // Nếu chỉ có 1 camera
              if (isMobile) {
                isRear = true; // Mobile thường mặc định camera sau
              } else {
                isFront = true; // Laptop/Desktop thường là webcam trước
              }
            }
          }

          const prefix = isRear ? "📸 Camera sau" : isFront ? "👤 Camera trước" : "📷 Camera";
          const displayName = c.label
            ? `${prefix} (${c.label})`
            : `${prefix} ${idx + 1}`;

          return {
            id: c.id,
            label: displayName,
            isRear,
          };
        });

        // Chọn camera mặc định: ưu tiên camera sau vật lý, nếu không có thì lấy camera cuối cùng
        let defaultCamId = "";
        if (processedCams.length > 0) {
          const rearCam = processedCams.find((c) => c.isRear);
          if (rearCam) {
            defaultCamId = rearCam.id;
          } else {
            defaultCamId = processedCams[processedCams.length - 1].id;
          }
        }

        // Tạo danh sách camera cho dropdown
        const dropDownCams: { id: string; label: string }[] = [];
        processedCams.forEach((c) => {
          if (c.id && !dropDownCams.some((d) => d.id === c.id)) {
            dropDownCams.push({ id: c.id, label: c.label });
          }
        });

        // Fallback nếu không phát hiện được camera vật lý nào
        if (dropDownCams.length === 0) {
          if (isMobile) {
            dropDownCams.push({ id: "environment", label: "📸 Camera sau (Mặc định)" });
            dropDownCams.push({ id: "user", label: "👤 Camera trước" });
            defaultCamId = "environment";
          } else {
            dropDownCams.push({ id: "user", label: "📸 Webcam mặc định" });
            defaultCamId = "user";
          }
        }

        setCameras(dropDownCams);
        setSelectedCamId(defaultCamId);
      } catch (err) {
        if (cancelled) return;
        console.warn("Không liệt kê chi tiết được camera, dùng cấu hình mặc định:", err);
        
        // Fallback khi lỗi list camera: nạp cứng cấu hình mặc định để người dùng vẫn dùng được
        if (isMobile) {
          setCameras([
            { id: "environment", label: "📸 Camera sau (Mặc định)" },
            { id: "user", label: "👤 Camera trước" }
          ]);
          setSelectedCamId("environment");
        } else {
          setCameras([{ id: "user", label: "📸 Webcam mặc định" }]);
          setSelectedCamId("user");
        }
      }
    };

    initCameras();

    return () => {
      cancelled = true;
    };
  }, []);

  // 2. useEffect để start/stop camera khi selectedCamId thay đổi
  useEffect(() => {
    if (!selectedCamId) return;

    let cancelled = false;
    setReady(false);
    setTorchOn(false);

    const onDecode = async (decodedText: string) => {
      // Debounce: bỏ qua nếu cùng mã trong 1.5s gần đây
      const now = Date.now();
      if (
        decodedText === lastScanRef.current.text &&
        now - lastScanRef.current.ts < 1500
      ) {
        return;
      }
      lastScanRef.current = { text: decodedText, ts: now };

      // Tắt camera chủ động trước để tránh unmount race condition
      if (scannerRef.current && scannerRef.current.isScanning) {
        try {
          await scannerRef.current.stop();
        } catch (e) {
          console.warn("Không dừng được camera khi quét thành công:", e);
        }
      }
      onScanRef.current(decodedText);
    };

    const onDecodeFail = () => {
      // ignore decode failure (camera vẫn đang quét)
    };

    const stopCurrentScanner = async () => {
      // 1. Nếu đang có một tiến trình khởi động camera chạy, đợi nó hoàn thành trước
      if (startPromiseRef.current) {
        try {
          await startPromiseRef.current;
        } catch (e) {
          console.warn("Tiến trình khởi động trước đó đã lỗi, bỏ qua chờ:", e);
        }
        startPromiseRef.current = null;
      }

      // 2. Tiến hành stop scanner cũ nếu có
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (e) {
          console.warn("Không dừng được camera cũ trước khi khởi động mới:", e);
        }
        scannerRef.current = null;
      }
    };

    const startCamera = async () => {
      // Dừng camera hiện tại trước
      await stopCurrentScanner();

      if (cancelled) return;

      const container = document.getElementById(innerIdRef.current);
      if (!container) return;

      // Xóa nội dung cũ để tránh nhân đôi video
      container.innerHTML = "";

      try {
        setError(null);
        const scanner = new Html5Qrcode(innerIdRef.current, {
          verbose: false,
          formatsToSupport: formats || DEFAULT_FORMATS,
          useBarCodeDetectorIfSupported: false,
        });
        scannerRef.current = scanner;

        // Định nghĩa videoConstraints và gộp trực tiếp cameraSelector vào trong đó
        // để tránh việc html5-qrcode bỏ qua cameraSelector khi cấu hình videoConstraints được định nghĩa.
        const mergedVideoConstraints: MediaTrackConstraints = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          ...(selectedCamId === "environment"
            ? { facingMode: "environment" }
            : selectedCamId === "user"
            ? { facingMode: "user" }
            : { deviceId: { exact: selectedCamId } }),
        };

        const cfg: Html5QrcodeCameraScanConfig = {
          fps: 10,
          qrbox: wideQrbox,
          videoConstraints: mergedVideoConstraints,
          ...scanConfig,
        };

        // Xác định tham số thứ nhất cho start() có đúng 1 key
        let cameraSelector: any = selectedCamId;
        if (selectedCamId === "environment") {
          cameraSelector = { facingMode: "environment" };
        } else if (selectedCamId === "user") {
          cameraSelector = { facingMode: "user" };
        } else {
          // Nhắm mục tiêu chính xác bằng deviceId giống debug-scan
          cameraSelector = { deviceId: { exact: selectedCamId } };
        }

        // Lưu promise khởi động lại để tiến trình stop sau này có thể đợi nếu cần
        const promise = scanner.start(cameraSelector, cfg, onDecode, onDecodeFail);
        startPromiseRef.current = promise;

        await promise;

        // Xóa tham chiếu promise khi đã start xong thành công
        if (startPromiseRef.current === promise) {
          startPromiseRef.current = null;
        }

        if (cancelled) {
          if (scanner.isScanning) await scanner.stop().catch(() => {});
          return;
        }
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        console.error("Lỗi khi khởi động camera:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        setError(errMsg);
        const e = err instanceof Error ? err : new Error(String(err));
        onErrorRef.current?.(e);
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (!isMountedRef.current) {
        // Chỉ dọn dẹp khi thực sự unmount component
        const currentScanner = scannerRef.current;
        const currentStartPromise = startPromiseRef.current;
        scannerRef.current = null;
        startPromiseRef.current = null;

        const cleanup = async () => {
          if (currentStartPromise) {
            try { await currentStartPromise; } catch {}
          }
          if (currentScanner && currentScanner.isScanning) {
            try { await currentScanner.stop(); } catch (e) { console.warn("Lỗi stop camera khi unmount:", e); }
          }
        };
        cleanup();
      }
    };
  }, [selectedCamId, formats, scanConfig]);

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      // applyVideoConstraints theo MediaTrackConstraints — "torch" là extension
      // không có trong type chuẩn nên cần cast
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: !torchOn } as MediaTrackConstraintSet & { torch?: boolean }],
      } as MediaTrackConstraints);
      setTorchOn((v) => !v);
    } catch (err) {
      console.warn("Torch không được hỗ trợ trên thiết bị này:", err);
    }
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      {/* Dropdown chọn camera hiển thị nếu thiết bị có nhiều hơn 1 lựa chọn camera */}
      {cameras.length > 1 && (
        <div className="mb-2 flex items-center gap-2 bg-zinc-900/80 p-2 rounded-lg text-white border border-zinc-800">
          <span className="text-[11px] text-white/70 font-semibold whitespace-nowrap">Thiết bị camera:</span>
          <select
            value={selectedCamId}
            onChange={(e) => setSelectedCamId(e.target.value)}
            className="flex-1 text-[11px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white focus:outline-none"
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* KHÔNG ép khung vuông (aspect-square) — để video giữ khung hình ngang
          tự nhiên, mã vạch 1D mới đủ chỗ. min-h giữ khung khi camera đang khởi động. */}
      <div className="w-full min-h-[300px] bg-black rounded-lg overflow-hidden relative flex items-center justify-center">
        {/* INNER div — html5-qrcode mutates ở đây. KHÔNG dùng dangerouslySetInnerHTML="" để tránh bị React xóa thẻ video khi render lại */}
        <div id={innerIdRef.current} className="w-full" />

        {error && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-4 text-center text-amber-400 text-xs z-10 space-y-2">
            <span className="material-symbols-outlined text-[32px] text-amber-500">error</span>
            <p className="font-semibold text-white">Không thể khởi động camera này</p>
            <p className="font-mono opacity-80 text-[10px] break-all">{error}</p>
            <p className="text-white/60 text-[10px] mt-2">Vui lòng thử chọn camera khác từ danh sách ở trên.</p>
          </div>
        )}
      </div>

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-xs pointer-events-none">
          <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
          Đang khởi động camera...
        </div>
      )}

      {showTorch && ready && (
        <button
          type="button"
          onClick={toggleTorch}
          className={`absolute bottom-3 right-3 w-11 h-11 rounded-full flex items-center justify-center text-lg shadow-lg transition-colors ${
            torchOn ? "bg-amber-400 text-white" : "bg-white/90 text-on-surface"
          }`}
          aria-label="Bật/tắt đèn pin"
        >
          <span className="material-symbols-outlined text-[22px]">flashlight_on</span>
        </button>
      )}

      {showLowLightWarning && (
        <div className="mt-2 text-center bg-amber-500/20 border border-amber-500/40 p-2.5 rounded-lg text-amber-300 text-xs flex items-center justify-center gap-1.5 animate-pulse">
          <span className="material-symbols-outlined text-[16px]">wb_incandescent</span>
          <span>Ánh sáng yếu hoặc mã mờ? Thử bật đèn pin 🔦 hoặc dùng Nhập tay / Ảnh.</span>
        </div>
      )}
    </div>
  );
}
