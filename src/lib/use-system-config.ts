"use client";

/**
 * UC-SYS-01: Hook load cấu hình từ /api/system/config với cache global.
 *
 * Cách dùng:
 *   const { config, loading } = useSystemConfig();
 *   <img src={config.logo_url} />
 *   <span>{config.app_name}</span>
 *
 * Cache shared giữa các component (1 lần fetch / 30s).
 * Refetch khi gọi `refreshSystemConfig()` (vd: sau khi Lưu config thì gọi để header reload).
 */

import { useEffect, useState } from "react";

export type SystemConfig = Record<string, string>;

type CacheEntry = { data: SystemConfig; fetchedAt: number };
const CACHE: { current: CacheEntry | null } = { current: null };
const TTL_MS = 30 * 1000;
const SUBSCRIBERS = new Set<(c: SystemConfig) => void>();
let pendingPromise: Promise<SystemConfig> | null = null;

async function fetchConfig(force = false): Promise<SystemConfig> {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (!force && CACHE.current && Date.now() - CACHE.current.fetchedAt < TTL_MS) {
    return CACHE.current.data;
  }
  if (pendingPromise) return pendingPromise;
  pendingPromise = (async () => {
    try {
      const res = await fetch(`${basePath}/api/system/config`);
      const json = await res.json();
      const map: SystemConfig = {};
      if (json.success && Array.isArray(json.data)) {
        for (const c of json.data) {
          if (c?.key) map[c.key] = c.value ?? "";
        }
      }
      CACHE.current = { data: map, fetchedAt: Date.now() };
      SUBSCRIBERS.forEach((cb) => cb(map));
      return map;
    } finally {
      pendingPromise = null;
    }
  })();
  return pendingPromise;
}

/** Trigger refetch toàn app (mọi component dùng hook sẽ re-render với value mới) */
export function refreshSystemConfig() {
  return fetchConfig(true);
}

export function useSystemConfig() {
  const [config, setConfig] = useState<SystemConfig>(CACHE.current?.data ?? {});
  const [loading, setLoading] = useState(!CACHE.current);

  useEffect(() => {
    let mounted = true;
    const cb = (c: SystemConfig) => {
      if (mounted) setConfig(c);
    };
    SUBSCRIBERS.add(cb);

    fetchConfig()
      .then((c) => {
        if (mounted) {
          setConfig(c);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      SUBSCRIBERS.delete(cb);
    };
  }, []);

  return { config, loading };
}

/** Helper lấy 1 key sync (chỉ trả khi đã cache, ngược lại trả default) */
export function getCachedConfig(key: string, fallback = ""): string {
  return CACHE.current?.data?.[key] ?? fallback;
}
