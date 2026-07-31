"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import Link from "next/link";
import { BackLink } from "@/components/mobile/BackLink";
import { useClientPagination, ListPageFooter } from "@/components/ui/ListPagination";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type Pallet = {
  id: string;
  code: string;
  status: string;
  total_lines: number;
  total_weight_kg: string;
  confirmed_at: string | null;
  supplier: { id: string; code: string; name: string } | null;
  location: { id: string; code: string; zone: string } | null;
};

function PalletListContent() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Checks if scan=true in search params to auto-open scanner
  const shouldAutoScan = searchParams.get("scan") === "true";
  
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [filteredPallets, setFilteredPallets] = useState<Pallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "CONFIRMED" | "IN_STORAGE" | "IN_STAGING">("ALL");
  const [showScanner, setShowScanner] = useState(shouldAutoScan);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchPallets = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${basePath}/api/pallets`);
      const json = await res.json();
      if (json.success) {
        setPallets(json.data || []);
      }
    } catch (err) {
      console.error("Error fetching pallets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPallets();
  }, []);

  // Tự ẩn toast sau 4s.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Filter & Search logic
  useEffect(() => {
    let result = pallets;
    
    // Status Filter Tab
    if (activeTab !== "ALL") {
      result = result.filter(p => p.status === activeTab);
    }
    
    // Text Search (Pallet code or supplier name)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        p => p.code.toLowerCase().includes(q) || 
             (p.supplier?.name && p.supplier.name.toLowerCase().includes(q)) ||
             (p.location?.code && p.location.code.toLowerCase().includes(q))
      );
    }
    
    setFilteredPallets(result);
  }, [pallets, activeTab, searchQuery]);

  // Handle scanned code — UC-FK-03_TC09: quét pallet không tồn tại phải báo lỗi rõ
  // ràng ("Pallet không tồn tại") thay vì im lặng lọc ra danh sách rỗng (gây hiểu
  // nhầm là chưa quét). Mã quét hợp lệ = trùng đúng code 1 pallet đang có.
  const handleScan = async (code: string) => {
    setShowScanner(false);
    // Remove ?scan=true from URL if present to avoid reopening
    if (shouldAutoScan) {
      router.replace("/forklift/pallet");
    }
    const scanned = code.trim();
    const match = pallets.find(
      (p) => p.code.toLowerCase() === scanned.toLowerCase()
    );
    if (match) {
      // Khớp đúng pallet → lọc danh sách tới pallet đó.
      setSearchQuery(match.code);
      return;
    }

    // Nếu không tìm thấy trong danh sách đã load local, hỏi server bằng API trực tiếp
    try {
      setLoading(true);
      const res = await fetch(`${basePath}/api/pallets/by-code?code=${encodeURIComponent(scanned)}`);
      const json = await res.json();
      if (json.success && json.data) {
        const serverPallet = json.data;
        // Thêm pallet này vào danh sách pallets state nếu chưa có
        setPallets((prev) => {
          if (prev.some((p) => p.id === serverPallet.id)) return prev;
          return [serverPallet, ...prev];
        });
        setSearchQuery(serverPallet.code);
        setToast({
          message: `Tìm thấy pallet ${serverPallet.code}.`,
          type: "success",
        });
      } else {
        setSearchQuery("");
        setToast({
          message: `Pallet không tồn tại trong hệ thống (mã: ${scanned}).`,
          type: "error",
        });
      }
    } catch (err) {
      console.error("Error looking up pallet by code:", err);
      setSearchQuery("");
      setToast({
        message: "Lỗi kết nối khi tra cứu pallet.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Get localized status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return <span className="bg-blue-100 text-blue-800 text-[11px] md:text-xs font-bold px-2 py-0.5 rounded-full">Chờ xếp vị trí</span>;
      case "IN_STORAGE":
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] md:text-xs font-bold px-2 py-0.5 rounded-full">Đang lưu kho</span>;
      case "IN_STAGING":
        return <span className="bg-amber-100 text-amber-800 text-[11px] md:text-xs font-bold px-2 py-0.5 rounded-full">Khu chờ xuất</span>;
      default:
        return <span className="bg-surface-low text-on-surface text-[11px] md:text-xs font-bold px-2 py-0.5 rounded-full">{status}</span>;
    }
  };

  // Get action link/button based on pallet status
  const renderAction = (pallet: Pallet) => {
    switch (pallet.status) {
      case "CONFIRMED":
        return (
          <Link
            href={`/forklift/put-away?pallet_id=${pallet.id}`}
            className="flex-1 py-2 bg-primary text-white text-center rounded-lg text-xs font-semibold hover:bg-primary-hover active:scale-95 transition-all flex items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">input</span> Xếp vị trí kệ
          </Link>
        );
      case "IN_STORAGE":
        return (
          <Link
            href={`/forklift/relocate?pallet_id=${pallet.id}`}
            className="flex-1 py-2 bg-secondary text-white text-center rounded-lg text-xs font-semibold hover:bg-on-secondary-container active:scale-95 transition-all flex items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">swap_horiz</span> Luân chuyển
          </Link>
        );
      case "IN_STAGING":
        return (
          <Link
            href={`/forklift/return?pallet_id=${pallet.id}`}
            className="flex-1 py-2 bg-rose-600 text-white text-center rounded-lg text-xs font-semibold hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">undo</span> Hoàn trả
          </Link>
        );
      default:
        return null;
    }
  };

  const getKpis = (status: "CONFIRMED" | "IN_STORAGE" | "IN_STAGING") => {
    return pallets.filter(p => p.status === status).length;
  };

  // Phân trang client-side cho lưới card pallet — reset về trang 1 khi đổi tab/tìm kiếm.
  // Hoãn từ khoá tìm kiếm trước khi đưa vào resetKey: nếu dùng giá trị thô thì
  // mỗi ký tự gõ là một lần nhảy về trang 1.
  const debouncedSearch = useDebouncedValue(searchQuery);
  const pg = useClientPagination(filteredPallets, { resetKey: `${activeTab}|${debouncedSearch}` });
  const { paged: pagedPallets } = pg;

  return (
    <div className="px-margin-mobile py-md w-full flex flex-col gap-sm">
      
      {/* Toast — báo lỗi quét (UC-FK-03_TC09: "Pallet không tồn tại") */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
          <span className="material-symbols-outlined text-[18px]">{toast.type === "success" ? "check_circle" : "error"}</span>{toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-xs">
        <BackLink href="/forklift">Quay lại</BackLink>
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[24px]">inventory_2</span> Danh mục Pallet
        </h1>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-3 gap-xs bg-surface p-2 rounded-xl border border-outline-variant/40 text-center shadow-sm">
        <button 
          onClick={() => setActiveTab("CONFIRMED")} 
          className={`flex flex-col items-center p-1 rounded-lg transition-colors ${activeTab === "CONFIRMED" ? "bg-blue-50 text-blue-700" : ""}`}
        >
          <span className="text-xs font-bold">{getKpis("CONFIRMED")}</span>
          <span className="text-[11px] md:text-xs text-on-surface-variant font-medium">Chờ xếp</span>
        </button>
        <button 
          onClick={() => setActiveTab("IN_STORAGE")} 
          className={`flex flex-col items-center p-1 rounded-lg transition-colors ${activeTab === "IN_STORAGE" ? "bg-emerald-50 text-emerald-700" : ""}`}
        >
          <span className="text-xs font-bold">{getKpis("IN_STORAGE")}</span>
          <span className="text-[11px] md:text-xs text-on-surface-variant font-medium">Lưu kho</span>
        </button>
        <button 
          onClick={() => setActiveTab("IN_STAGING")} 
          className={`flex flex-col items-center p-1 rounded-lg transition-colors ${activeTab === "IN_STAGING" ? "bg-amber-50 text-amber-700" : ""}`}
        >
          <span className="text-xs font-bold">{getKpis("IN_STAGING")}</span>
          <span className="text-[11px] md:text-xs text-on-surface-variant font-medium">Chờ xuất</span>
        </button>
      </div>

      {/* Search & Scanner Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
          <input
            type="text"
            placeholder="Tìm pallet, nhà CC, vị trí..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-surface"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")} 
              className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
        <button
          onClick={() => setShowScanner(true)}
          className="px-3 py-2 bg-secondary text-white rounded-lg text-xs font-semibold hover:bg-on-secondary-container flex items-center gap-1 transition-colors whitespace-nowrap active:scale-95 shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
          Quét
        </button>
      </div>

      {/* Scrollable Filter Tabs */}
      <div className="flex border-b border-outline-variant overflow-x-auto custom-scroll-hide">
        {(["ALL", "CONFIRMED", "IN_STORAGE", "IN_STAGING"] as const).map((tab) => {
          const labels = {
            ALL: "Tất cả",
            CONFIRMED: "Chờ xếp vị trí",
            IN_STORAGE: "Lưu kho",
            IN_STAGING: "Chờ xuất"
          };
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-3 border-b-2 font-semibold text-xs whitespace-nowrap transition-colors ${
                isActive 
                  ? "border-primary text-primary" 
                  : "border-transparent text-on-surface-variant/60 hover:text-on-surface-variant"
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Pallet Cards List */}
      <div className="flex-1 flex flex-col gap-sm">
        {loading ? (
          <div className="py-10 text-center flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
            <span className="text-xs text-on-surface-variant font-medium">Đang tải danh sách pallet...</span>
          </div>
        ) : filteredPallets.length === 0 ? (
          <div className="industrial-card py-10 rounded-xl text-center bg-surface border border-outline-variant/40 shadow-sm flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[40px] opacity-30 text-on-surface-variant">inventory_2</span>
            <p className="text-sm text-on-surface-variant font-medium">Không tìm thấy pallet phù hợp.</p>
          </div>
        ) : (
          pagedPallets.map((p) => (
            <div
              key={p.id}
              className="industrial-card p-md rounded-xl flex flex-col gap-sm relative overflow-hidden bg-surface border border-outline-variant/40 shadow-sm hover:border-primary/30 transition-all"
            >
              {/* Left Color Edge decorator based on status */}
              <div 
                className={`absolute top-0 left-0 w-1.5 h-full ${
                  p.status === "CONFIRMED" ? "bg-blue-500" : p.status === "IN_STORAGE" ? "bg-emerald-500" : "bg-amber-500"
                }`}
              ></div>
              
              {/* Row 1: Code and Status */}
              <div className="flex justify-between items-start pl-1">
                <div className="flex flex-col">
                  <span className="font-mono text-sm font-bold text-primary">{p.code}</span>
                  <span className="text-[11px] md:text-xs text-on-surface-variant/80 font-medium truncate max-w-[200px]">
                    {p.supplier?.name || "Nhà cung cấp chưa rõ"}
                  </span>
                </div>
                {getStatusBadge(p.status)}
              </div>

              {/* Row 2: Specs info */}
              <div className="grid grid-cols-2 gap-xs pl-1 py-1.5 border-y border-outline-variant/30 text-[11px] md:text-xs text-on-surface-variant/80 bg-surface-low/30 rounded-lg">
                <div className="flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-[14px]">grid_on</span>
                  <span>Dòng hàng: <strong>{p.total_lines}</strong></span>
                </div>
                <div className="flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-[14px]">weight</span>
                  <span>Trọng lượng: <strong>{Number(p.total_weight_kg).toFixed(1)} kg</strong></span>
                </div>
                {p.location && (
                  <div className="col-span-2 flex items-center gap-1 font-medium mt-0.5">
                    <span className="material-symbols-outlined text-[14px] text-secondary">location_on</span>
                    <span>Vị trí hiện tại: <strong className="text-secondary">{p.location.code}</strong> (Zone {p.location.zone})</span>
                  </div>
                )}
              </div>

              {/* Row 3: Action Buttons */}
              <div className="flex gap-sm pl-1 mt-1">
                {renderAction(p)}
              </div>

            </div>
          ))
        )}

        {/* Phân trang client-side */}
        {!loading && filteredPallets.length > 0 && (
          <ListPageFooter {...pg} unit="pallet" />
        )}
      </div>

      {/* Barcode Scanner overlay */}
      <BarcodeScanner
        isOpen={showScanner}
        onScan={handleScan}
        onClose={() => {
          setShowScanner(false);
          if (shouldAutoScan) {
            router.replace("/forklift/pallet");
          }
        }}
        title="Quét mã Pallet"
      />
    </div>
  );
}

export default function PalletListPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[60vh]">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
      </div>
    }>
      <PalletListContent />
    </Suspense>
  );
}
