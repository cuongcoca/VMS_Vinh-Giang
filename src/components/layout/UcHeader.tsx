"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/auth";
import { HelpGuideButton } from "./HelpGuideButton";
import { useSidebar } from "./sidebar-context";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

type SearchResult = {
  type: "PALLET" | "INBOUND" | "ITEM_CODE" | "SUPPLIER" | "LOCATION";
  id: string;
  code: string;
  label: string;
  subLabel?: string;
  href: string;
};

export function UcHeader({ title = "TỔNG QUAN" }: { title?: string }) {
  const router = useRouter();
  const { setOpen } = useSidebar(); // mở drawer sidebar (mobile)
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get user info
  const user = typeof window !== "undefined" ? auth.getUser() : null;
  const roleLabels: Record<string, string> = {
    ADMIN: "QUẢN LÝ",
    KE_TOAN: "KẾ TOÁN",
    THU_KHO: "THỦ KHO",
    XE_NANG: "XE NÂNG",
    KIEM_KE: "KIỂM KÊ",
    SUPER_USER: "QUẢN TRỊ TỐI CAO",
    MANAGER: "QUẢN LÝ",
    STAFF: "NHÂN VIÊN",
    QUAN_LY: "QUẢN LÝ",
  };

  // Global search
  useEffect(() => {
    // Gợi ý từ KÝ TỰ ĐẦU (đồng bộ với các ô tìm khác). Mỗi endpoint đã limit=5.
    if (!query || query.trim().length < 1) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const q = encodeURIComponent(query.trim());
        // Search across multiple endpoints in parallel
        const [palletRes, inboundRes, itemRes] = await Promise.allSettled([
          fetch(`${basePath}/api/pallets?q=${q}&limit=5`).then(r => r.json()),
          fetch(`${basePath}/api/inbound?q=${q}&limit=5`).then(r => r.json()),
          fetch(`${basePath}/api/item-codes?q=${q}`).then(r => r.json()),
        ]);

        const items: SearchResult[] = [];

        // Pallets
        if (palletRes.status === "fulfilled" && palletRes.value.success) {
          for (const p of palletRes.value.data?.slice(0, 3) || []) {
            items.push({
              type: "PALLET",
              id: p.id,
              code: p.code,
              label: p.code,
              subLabel: p.supplier?.name || p.status,
              href: `/pallets/${p.id}`,
            });
          }
        }

        // Inbound requests
        if (inboundRes.status === "fulfilled" && inboundRes.value.success) {
          for (const r of inboundRes.value.data?.slice(0, 3) || []) {
            items.push({
              type: "INBOUND",
              id: r.id,
              code: r.code,
              label: r.code,
              subLabel: r.supplier?.name || r.status,
              href: `/inbound/${r.id}`,
            });
          }
        }

        // Item codes
        if (itemRes.status === "fulfilled" && itemRes.value.success) {
          for (const ic of itemRes.value.data?.slice(0, 3) || []) {
            items.push({
              type: "ITEM_CODE",
              id: ic.id,
              code: ic.code,
              label: ic.code,
              subLabel: ic.short_name,
              href: `/item-codes`,
            });
          }
        }

        setResults(items);
        setShowResults(items.length > 0);
      } catch (err) {
        console.error("Global search error:", err);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keyboard shortcut: Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowResults(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const typeIcon: Record<string, string> = {
    PALLET: "inventory_2",
    INBOUND: "input",
    ITEM_CODE: "qr_code_2",
    SUPPLIER: "local_shipping",
    LOCATION: "grid_view",
  };

  const typeLabel: Record<string, string> = {
    PALLET: "Pallet",
    INBOUND: "Phiếu nhập",
    ITEM_CODE: "Mã hàng",
    SUPPLIER: "NCC",
    LOCATION: "Vị trí",
  };

  const handleSelect = (result: SearchResult) => {
    setQuery("");
    setShowResults(false);
    router.push(result.href);
  };

  return (
    <header className="sticky top-0 h-[64px] bg-surface border-b border-surface-variant flex items-center px-4 lg:px-6 z-20">
      {/* Hamburger mở menu — chỉ mobile (< lg) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden w-10 h-10 -ml-1 mr-1 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-low flex-shrink-0"
        aria-label="Mở menu"
      >
        <span className="material-symbols-outlined text-[24px]">menu</span>
      </button>
      <div className="flex-1 min-w-0 flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm min-w-0">
          {/* Ẩn tiền tố breadcrumb ở mobile cho gọn */}
          <span className="text-on-surface-variant label-caps hidden sm:inline">Vĩnh Giang WMS</span>
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant hidden sm:inline">chevron_right</span>
          <span className="font-semibold label-caps text-primary truncate">{title}</span>
        </div>
        
        {/* UC-INT-01: Global Search Bar */}
        <div className="relative w-96 hidden md:block" ref={containerRef}>
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            {searching ? "progress_activity" : "search"}
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Tra cứu mã pallet, phiếu nhập, SKU... (Ctrl+K)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            className="w-full pl-10 pr-16 py-2 bg-surface-low rounded-lg text-sm border-0 focus:ring-2 focus:ring-primary/20"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-on-surface-variant/70 border border-outline-variant rounded px-1.5 py-0.5 bg-white pointer-events-none">
            Ctrl K
          </kbd>

          {/* Results Dropdown */}
          {showResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-outline-variant rounded-xl shadow-2xl max-h-[400px] overflow-y-auto z-50">
              {results.length === 0 && !searching ? (
                <div className="p-4 text-center text-sm text-on-surface-variant">
                  Không tìm thấy kết quả cho &quot;{query}&quot;
                </div>
              ) : (
                <>
                  <div className="px-3 py-2 text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-wider border-b border-outline-variant/50">
                    {results.length} kết quả
                  </div>
                  {results.map((r, idx) => (
                    <button
                      key={`${r.type}-${r.id}-${idx}`}
                      onClick={() => handleSelect(r)}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-low transition-colors border-b border-outline-variant/30 last:border-b-0"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-primary">{typeIcon[r.type] || "search"}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-primary">{r.code}</span>
                          <span className="text-[10px] font-bold text-on-surface-variant/70 bg-surface-low px-1.5 py-0.5 rounded">{typeLabel[r.type]}</span>
                        </div>
                        {r.subLabel && (
                          <p className="text-xs text-on-surface-variant truncate mt-0.5">{r.subLabel}</p>
                        )}
                      </div>
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant/50">open_in_new</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <HelpGuideButton />
        <div className="h-8 w-px bg-surface-variant mx-1"></div>
        <div
          className="flex items-center gap-2.5 cursor-pointer hover:bg-surface-low pr-2 pl-1 py-1 rounded-lg transition-colors"
          onClick={() => router.push("/system/profile")}
        >
          <div className="text-right">
            <p className="text-sm font-semibold leading-tight">{user?.fullName || "Admin Vĩnh Giang"}</p>
            <p className="label-caps text-[9px] text-on-surface-variant leading-none">{roleLabels[user?.role || ""] || "QUẢN TRỊ TỐI CAO"}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold">
            {user?.fullName?.charAt(0)?.toUpperCase() || "V"}
          </div>
        </div>
      </div>
    </header>
  );
}
