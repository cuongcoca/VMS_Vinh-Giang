"use client";

import React, { useEffect, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

// Trang debug camera + QR scan
// Dùng để chẩn đoán tại sao điện thoại không quét được QR.
// Mở: /wms/scan-debug trên chính điện thoại sẽ dùng để quét.

type CameraInfo = { id: string; label: string };

export default function ScanDebugPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [selectedCam, setSelectedCam] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string>("");
  const [scannerInstance, setScannerInstance] = useState<Html5Qrcode | null>(null);

  const ts = () => new Date().toLocaleTimeString("vi-VN");
  const log = (msg: string) => {
    console.log("[scan-debug]", msg);
    setLogs((prev) => [...prev.slice(-30), `${ts()} ${msg}`]);
  };

  // Browser info
  const ua = typeof window !== "undefined" ? navigator.userAgent : "—";
  const isSecure = typeof window !== "undefined" ? window.isSecureContext : false;
  const protocol = typeof window !== "undefined" ? window.location.protocol : "—";
  const hostname = typeof window !== "undefined" ? window.location.hostname : "—";
  const hasMediaDevices = typeof navigator !== "undefined" && !!navigator.mediaDevices;
  const hasGetUserMedia = hasMediaDevices && !!navigator.mediaDevices.getUserMedia;

  // List cameras
  const enumerateCameras = async () => {
    try {
      log("Yêu cầu quyền camera...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      log("✓ Cấp quyền camera OK");
      stream.getTracks().forEach((t) => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({ id: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 6)}` }));
      log(`Tìm thấy ${cams.length} camera`);
      cams.forEach((c, i) => log(`  ${i + 1}. ${c.label}`));
      setCameras(cams);

      // Tự chọn cam sau nếu có
      const rear = cams.find((c) => /back|rear|environment/i.test(c.label));
      if (rear) {
        setSelectedCam(rear.id);
        log(`Tự chọn camera sau: ${rear.label}`);
      } else if (cams.length > 0) {
        setSelectedCam(cams[cams.length - 1].id);
        log(`Không thấy "back/rear" — chọn cam cuối: ${cams[cams.length - 1].label}`);
      }
    } catch (e) {
      const err = e as DOMException;
      log(`✗ LỖI getUserMedia: ${err.name} — ${err.message}`);
      if (err.name === "NotAllowedError") log("→ Người dùng chưa cấp quyền camera");
      if (err.name === "NotFoundError") log("→ Không tìm thấy camera");
      if (err.name === "NotReadableError") log("→ Camera đang được app khác dùng");
      if (err.name === "OverconstrainedError") log("→ Camera không hỗ trợ constraint yêu cầu");
    }
  };

  const startScan = async () => {
    if (!selectedCam) {
      log("✗ Chưa chọn camera");
      return;
    }
    try {
      log("Khởi tạo Html5Qrcode...");
      const scanner = new Html5Qrcode("debug-scan-region", {
        verbose: true,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        useBarCodeDetectorIfSupported: false,
      });
      setScannerInstance(scanner);

      log(`Start scan với deviceId: ${selectedCam.slice(0, 12)}...`);
      await scanner.start(
        { deviceId: { exact: selectedCam } },
        // Khung quét RỘNG responsive (cho mã vạch 1D nằm ngang), không ép vuông —
        // khớp với cấu hình production ở shared/BarcodeScanner.tsx.
        {
          fps: 10,
          qrbox: (vfW: number, vfH: number) => {
            const width = Math.max(180, Math.floor(Math.min(vfW, 380) * 0.88));
            const height = Math.max(130, Math.floor(Math.min(width * 0.6, vfH * 0.7)));
            return { width, height };
          },
        },
        (decodedText) => {
          log(`✓ QUÉT THÀNH CÔNG: "${decodedText}"`);
          setLastScan(decodedText);
        },
        () => {
          // ignore decode failure (camera vẫn đang quét)
        }
      );
      log("✓ Camera đang chạy — đưa QR vào khung");
      setScanning(true);
    } catch (e) {
      const err = e as Error;
      log(`✗ LỖI start scan: ${err.message}`);
    }
  };

  const stopScan = async () => {
    if (scannerInstance) {
      try {
        await scannerInstance.stop();
        await scannerInstance.clear();
        log("Đã dừng scan");
      } catch (e) {
        log(`Lỗi stop: ${(e as Error).message}`);
      }
      setScannerInstance(null);
      setScanning(false);
    }
  };

  useEffect(() => {
    log("=== Trang scan-debug đã load ===");
    log(`Protocol: ${protocol} | Hostname: ${hostname}`);
    log(`Secure context: ${isSecure ? "✓ YES" : "✗ NO (camera sẽ bị chặn!)"}`);
    log(`navigator.mediaDevices: ${hasMediaDevices ? "✓" : "✗"}`);
    log(`getUserMedia: ${hasGetUserMedia ? "✓" : "✗"}`);
    log(`UA: ${ua.slice(0, 80)}...`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-3 max-w-2xl mx-auto">
      <h1 className="text-lg font-bold mb-3">🔬 Gỡ lỗi quét mã</h1>

      {/* Status box */}
      <div className="bg-white rounded-lg p-3 shadow-sm mb-3 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Giao thức:</span>
          <span className={protocol === "https:" ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
            {protocol}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Bối cảnh bảo mật:</span>
          <span className={isSecure ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
            {isSecure ? "✓ Camera được phép" : "✗ Camera BỊ CHẶN!"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">API mediaDevices:</span>
          <span className={hasGetUserMedia ? "text-emerald-600" : "text-rose-600"}>
            {hasGetUserMedia ? "✓" : "✗"}
          </span>
        </div>
        <div>
          <span className="text-gray-500">UA: </span>
          <span className="break-all text-[10px]">{ua}</span>
        </div>
      </div>

      {/* Camera list */}
      <div className="bg-white rounded-lg p-3 shadow-sm mb-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm">Camera trên thiết bị</h2>
          <button
            onClick={enumerateCameras}
            className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded font-semibold"
          >
            Liệt kê camera
          </button>
        </div>
        {cameras.length > 0 ? (
          <div className="space-y-1.5">
            {cameras.map((c, i) => (
              <label
                key={c.id}
                className={`flex items-center gap-2 p-2 rounded text-xs cursor-pointer ${
                  selectedCam === c.id ? "bg-indigo-50 border border-indigo-300" : "bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="cam"
                  checked={selectedCam === c.id}
                  onChange={() => setSelectedCam(c.id)}
                />
                <span className="font-semibold">{i + 1}.</span>
                <span className="truncate">{c.label}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Bấm "Liệt kê camera" — sẽ hỏi quyền camera trước.</p>
        )}
      </div>

      {/* Scan controls */}
      <div className="bg-white rounded-lg p-3 shadow-sm mb-3">
        <div className="flex gap-2 mb-3">
          {!scanning ? (
            <button
              onClick={startScan}
              disabled={!selectedCam}
              className="flex-1 py-2 text-sm bg-emerald-600 text-white rounded font-semibold disabled:opacity-50"
            >
              ▶ Bắt đầu quét
            </button>
          ) : (
            <button onClick={stopScan} className="flex-1 py-2 text-sm bg-rose-600 text-white rounded font-semibold">
              ⏹ Dừng quét
            </button>
          )}
        </div>
        <div className="w-full bg-black rounded-lg overflow-hidden relative flex items-center justify-center" style={{ minHeight: 300 }}>
          {/* Inner div — html5-qrcode mutates this; outer div for React layout */}
          <div id="debug-scan-region" className="w-full" />
        </div>
        {lastScan && (
          <div className="mt-3 p-2 bg-emerald-50 border border-emerald-300 rounded">
            <div className="text-[10px] font-bold text-emerald-700 uppercase">Mã quét được</div>
            <div className="font-mono text-base font-bold break-all">{lastScan}</div>
          </div>
        )}
      </div>

      {/* Logs */}
      <div className="bg-black text-green-400 rounded-lg p-3 text-[10px] font-mono whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
        <div className="text-white font-bold mb-1">📋 Nhật ký</div>
        {logs.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
        <p className="font-bold text-amber-700 mb-1">💡 Hướng dẫn dùng:</p>
        <ol className="list-decimal pl-5 space-y-1 text-amber-800">
          <li>Bấm "Liệt kê camera" — cấp quyền khi browser hỏi</li>
          <li>Chọn camera (thường camera **cuối cùng** là camera sau)</li>
          <li>Bấm "Bắt đầu quét" — giơ QR cách camera 15-25cm</li>
          <li>Nếu lỗi → chụp màn hình toàn bộ trang này gửi cho dev</li>
        </ol>
      </div>
    </div>
  );
}
