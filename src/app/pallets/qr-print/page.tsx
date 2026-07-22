"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type PalletRow = { id: string; code: string; status: string; total_lines: number };

// Trang in QR bulk cho pallet
// URL: /pallets/qr-print?ids=uuid1,uuid2,...
export default function PalletsQRPrintPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-on-surface-variant">Đang tải...</div>}>
      <PalletsQRPrintContent />
    </Suspense>
  );
}

function PalletsQRPrintContent() {
  const params = useSearchParams();
  const ids = params.get("ids") || "";
  const [pallets, setPallets] = useState<PalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${basePath}/api/pallets`);
        const result = await res.json();
        if (!result.success) return;
        let list: PalletRow[] = result.data;
        if (ids) {
          const idSet = new Set(ids.split(",").filter(Boolean));
          list = list.filter((p) => idSet.has(p.id));
        }
        list.sort((a, b) => a.code.localeCompare(b.code));
        setPallets(list);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [ids, basePath]);

  if (loading) {
    return <div className="p-10 text-center text-on-surface-variant">Đang tải...</div>;
  }

  return (
    <div className="bg-white min-h-screen p-6 print:p-0">
      <div className="max-w-6xl mx-auto">
        <div className="print:hidden mb-6 flex items-center justify-between border-b border-outline-variant pb-4">
          <div>
            <h1 className="text-xl font-bold text-primary">In QR pallet — {pallets.length} mã</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Dán lên pallet để xe nâng / kiểm kê quét. Mỗi QR = mã pallet text.
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
          {pallets.map((p) => (
            <div
              key={p.id}
              className="border border-outline-variant rounded-lg p-3 text-center break-inside-avoid print:border-2 print:border-black"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${basePath}/api/pallets/${p.id}/qr-png?size=400`}
                alt={`QR ${p.code}`}
                className="w-full aspect-square mb-2"
              />
              <div className="text-lg font-mono font-bold tracking-wider">{p.code}</div>
              <div className="text-xs text-on-surface-variant mt-1">{p.total_lines} dòng hàng</div>
            </div>
          ))}
        </div>

        {pallets.length === 0 && (
          <div className="text-center py-20 text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] opacity-30 block">qr_code_2</span>
            <p className="mt-2">Không có pallet nào để in.</p>
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
