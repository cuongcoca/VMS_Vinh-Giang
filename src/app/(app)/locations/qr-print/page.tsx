"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QrCodeImg } from "@/components/ui/QrCodeImg";

type LocationRow = { id: string; code: string; zone: string; rack: string; level: string };

// Trang in QR bulk cho danh sách vị trí
// URL: /locations/qr-print?ids=uuid1,uuid2,...  (hoặc ?zone=A để lọc theo dãy)
// Người dùng (Kế toán/Quản lý) nhấn Ctrl+P trên trang này → in cả grid QR.
export default function LocationsQRPrintPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-on-surface-variant">Đang tải...</div>}>
      <LocationsQRPrintContent />
    </Suspense>
  );
}

function LocationsQRPrintContent() {
  const params = useSearchParams();
  const ids = params.get("ids") || "";
  const zone = params.get("zone") || "";
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${basePath}/api/locations`);
        const result = await res.json();
        if (!result.success) return;
        let list: LocationRow[] = result.data;
        if (ids) {
          const idSet = new Set(ids.split(",").filter(Boolean));
          list = list.filter((l) => idSet.has(l.id));
        }
        if (zone) {
          list = list.filter((l) => l.zone === zone);
        }
        list.sort((a, b) => a.code.localeCompare(b.code));
        setLocations(list);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [ids, zone, basePath]);

  if (loading) {
    return <div className="p-10 text-center text-on-surface-variant">Đang tải...</div>;
  }

  return (
    <div className="bg-white min-h-screen p-6 print:p-0">
      <div className="max-w-6xl mx-auto">
        {/* Header — chỉ hiển thị trên màn hình, ẩn khi in */}
        <div className="print:hidden mb-6 flex items-center justify-between border-b border-outline-variant pb-4">
          <div>
            <h1 className="text-xl font-bold text-primary">In QR vị trí — {locations.length} mã</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              {zone ? `Lọc theo dãy: ${zone}` : "Tất cả vị trí"} · Mỗi QR = mã text trực tiếp (vd A-03-02)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-primary text-white rounded-lg font-semibold flex items-center gap-2 hover:bg-primary-hover"
            >
              <span className="material-symbols-outlined text-[18px]">print</span> In ngay
            </button>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 border border-outline-variant rounded-lg font-semibold hover:bg-surface-low"
            >
              Quay lại
            </button>
          </div>
        </div>

        {/* Grid QR — 4 cột trên màn hình, in ra A4 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="border border-outline-variant rounded-lg p-3 text-center break-inside-avoid print:border-2 print:border-black"
            >
              <QrCodeImg
                value={loc.code}
                size={300}
                alt={`QR ${loc.code}`}
                className="w-full aspect-square mb-2"
              />
              <div className="text-lg font-mono font-bold tracking-wider">{loc.code}</div>
              <div className="text-xs text-on-surface-variant mt-1">
                Dãy {loc.zone} · Kệ {loc.rack} · Tầng {loc.level}
              </div>
            </div>
          ))}
        </div>

        {locations.length === 0 && (
          <div className="text-center py-20 text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] opacity-30 block">qr_code_2</span>
            <p className="mt-2">Không có vị trí nào để in.</p>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          body { margin: 0; }
        }
      `}</style>
    </div>
  );
}
