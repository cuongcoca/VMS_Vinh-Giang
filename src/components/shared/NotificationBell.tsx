"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { auth } from "@/lib/auth";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
};

// Centralized path translator to prevent 404 errors across different roles
function getNormalizedRoute(basePath: string, rawTarget: string): string {
  if (!rawTarget) return basePath || "/";

  // 1. Clean up duplicate slashes
  let target = rawTarget.replace(/\/+/g, "/");

  // 2. Extract entity type and ID
  const segments = target.split("/").filter(Boolean);
  let entityType = "";
  let entityId = "";

  if (segments.includes("stock-count")) {
    entityType = "stock-count";
    entityId = segments[segments.indexOf("stock-count") + 1] || "";
  } else if (segments.includes("adjustments")) {
    entityType = "adjustments";
    entityId = segments[segments.indexOf("adjustments") + 1] || "";
  } else if (segments.includes("inbound-temp")) {
    entityType = "inbound-temp";
    entityId = segments[segments.indexOf("inbound-temp") + 1] || "";
  } else if (segments.includes("adhoc")) {
    entityType = "inbound-temp";
    entityId = segments[segments.indexOf("adhoc") + 1] || "";
  } else if (segments.includes("inbound")) {
    entityType = "inbound";
    entityId = segments[segments.indexOf("inbound") + 1] || "";
  } else if (segments.includes("outbound")) {
    entityType = "outbound";
    entityId = segments[segments.indexOf("outbound") + 1] || "";
  } else if (segments.includes("release")) {
    entityType = "outbound";
    entityId = segments[segments.indexOf("release") + 1] || "";
  } else if (segments.includes("pallets")) {
    entityType = "pallet";
    entityId = segments[segments.indexOf("pallets") + 1] || "";
  } else if (segments.includes("pallet")) {
    entityType = "pallet";
    entityId = segments[segments.indexOf("pallet") + 1] || "";
  } else if (segments.includes("item-codes")) {
    entityType = "item-codes";
    entityId = segments[segments.indexOf("item-codes") + 1] || "";
  } else if (segments.includes("item-code")) {
    entityType = "item-codes";
    entityId = segments[segments.indexOf("item-code") + 1] || "";
  }

  // 3. Normalize according to the current role's basePath
  if (basePath === "/wms") {
    // Web Admin Desktop
    if (entityType === "stock-count") {
      return entityId ? `/wms/stock-count/${entityId}` : "/wms/stock-count";
    }
    if (entityType === "adjustments") {
      return entityId ? `/wms/inventory/adjustments/${entityId}` : "/wms/inventory/adjustments";
    }
    if (entityType === "inbound-temp") {
      return entityId ? `/wms/inbound-adhoc/${entityId}` : "/wms/inbound-adhoc";
    }
    if (entityType === "inbound") {
      return entityId ? `/wms/inbound/${entityId}` : "/wms/inbound";
    }
    if (entityType === "outbound") {
      return entityId ? `/wms/outbound/requests/${entityId}` : "/wms/outbound/requests";
    }
    if (entityType === "pallet") {
      return entityId ? `/wms/pallets/${entityId}` : "/wms/pallets";
    }
    if (entityType === "item-codes") {
      return "/wms/item-codes";
    }

    let clean = target;
    if (clean.startsWith("/ketoan/")) clean = clean.replace("/ketoan/", "/wms/");
    if (clean.startsWith("/thukho/")) clean = clean.replace("/thukho/", "/wms/");
    if (!clean.startsWith("/wms")) {
      clean = `/wms${clean.startsWith("/") ? "" : "/"}${clean}`;
    }
    return clean;
  }

  if (basePath === "/thukho") {
    // Warehouse Keeper Mobile
    if (entityType === "stock-count") {
      return "/thukho/warehouse/stocktake";
    }
    if (entityType === "adjustments") {
      return "/thukho/warehouse/movements";
    }
    if (entityType === "inbound-temp") {
      return entityId ? `/thukho/adhoc/${entityId}` : "/thukho/adhoc/new";
    }
    if (entityType === "inbound") {
      return entityId ? `/thukho/inbound/${entityId}` : "/thukho/inbound";
    }
    if (entityType === "outbound") {
      return "/thukho/warehouse/staging";
    }
    if (entityType === "pallet") {
      return entityId ? `/thukho/pallet/${entityId}` : "/thukho/pallet";
    }
    if (entityType === "item-codes") {
      return "/thukho/item-code/new";
    }
    return "/thukho";
  }

  if (basePath === "/kiemke") {
    // Stocktake Mobile
    if (entityType === "stock-count" && entityId) {
      return `/kiemke/tasks/${entityId}`;
    }
    return "/kiemke";
  }

  if (basePath === "/xenang") {
    // Forklift Mobile
    if (entityType === "pallet") {
      return "/xenang/forklift/pallet";
    }
    if (entityType === "outbound" && entityId) {
      return `/xenang/forklift/outbound/${entityId}`;
    }
    return "/xenang/forklift";
  }

  // Fallback
  let clean = target;
  if (basePath && clean.startsWith(basePath)) return clean;
  ["/wms", "/thukho", "/xenang", "/kiemke", "/ketoan"].forEach((p) => {
    if (clean.startsWith(p + "/")) {
      clean = clean.substring(p.length);
    }
  });
  return `${basePath}${clean.startsWith("/") ? "" : "/"}${clean}`;
}

// Phase 7.2 (BUG_REPORT TC_IN_REQ_027/_028): bell + dropdown thông báo cho
// thủ kho mobile / kế toán desktop. Poll mỗi 60s; click → mark-read +
// navigate đến link_url (prepend basePath để mount đúng instance).
export function NotificationBell({ className }: { className?: string }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const fetchSummary = useCallback(async () => {
    const token = auth.getToken();
    if (!token) return;
    try {
      const res = await fetch(`${basePath}/api/notifications?unread=true&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setItems(json.data || []);
        setUnreadCount(json.unread_count || 0);
      }
    } catch (e) {
      console.error("fetchSummary error:", e);
    }
  }, [basePath]);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 60_000); // 60s poll
    return () => clearInterval(interval);
  }, [fetchSummary]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    const token = auth.getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${basePath}/api/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setItems(json.data || []);
        setUnreadCount(json.unread_count || 0);
      }
    } catch (e) {
      console.error("open notifications:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (n: Notification) => {
    setOpen(false);
    const token = auth.getToken();
    if (!n.read_at && token) {
      try {
        await fetch(`${basePath}/api/notifications/${n.id}/read`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        console.error("mark read:", e);
      }
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (n.link_url) {
      window.location.href = getNormalizedRoute(basePath, n.link_url);
    }
  };

  const handleMarkAllRead = async () => {
    const token = auth.getToken();
    if (!token) return;
    try {
      await fetch(`${basePath}/api/notifications`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setUnreadCount(0);
      setItems((arr) => arr.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    } catch (e) {
      console.error("mark all read:", e);
    }
  };

  return (
    <div className={`relative ${className || ""}`} ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-low active:scale-95 transition-all text-on-surface-variant relative"
        aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ""}`}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-[320px] max-h-[420px] bg-white border border-outline-variant rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant">
            <span className="text-sm font-bold">Thông báo</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-[11px] text-primary font-semibold hover:underline">
                Đánh dấu đã đọc tất cả
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-xs text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              </div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-[36px] opacity-30 block">notifications_off</span>
                Chưa có thông báo
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`w-full text-left px-3 py-2.5 border-b border-outline-variant/60 hover:bg-surface-low ${
                    !n.read_at ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-on-surface truncate">{n.title}</div>
                      {n.body && <div className="text-[11px] text-on-surface-variant truncate">{n.body}</div>}
                      <div className="text-[10px] text-on-surface-variant/70 mt-0.5">
                        {new Date(n.created_at).toLocaleString("vi-VN")}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
