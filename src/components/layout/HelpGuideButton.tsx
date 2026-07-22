"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { getGuideForPath } from "@/lib/help-guides";

/**
 * Nút "Hướng dẫn sử dụng" trên thanh tiêu đề — xuất hiện ở MỌI màn admin.
 * Bấm vào mở popup hướng dẫn riêng cho màn hình đang xem (chọn theo route).
 */
export function HelpGuideButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const guide = getGuideForPath(pathname || "/");

  // ESC để đóng + khóa cuộn nền khi mở
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 hover:bg-surface-low rounded-full text-on-surface-variant transition-colors"
        title="Hướng dẫn sử dụng màn này"
        aria-label="Hướng dẫn sử dụng"
      >
        <span className="material-symbols-outlined text-[22px]">help</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-[640px] max-w-[95vw] max-h-[88vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-outline-variant bg-surface-low/50">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[26px] mt-0.5">help</span>
                <div>
                  <h2 className="text-lg font-bold text-on-surface">{guide.title}</h2>
                  {guide.subtitle && (
                    <p className="text-sm text-on-surface-variant mt-0.5">{guide.subtitle}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-surface-low rounded-lg text-on-surface-variant shrink-0"
                aria-label="Đóng"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto space-y-5">
              {/* Khi nào dùng màn này */}
              {guide.whenToUse && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">target</span> Khi nào dùng màn này?
                  </p>
                  <p className="text-sm text-on-surface leading-relaxed">{guide.whenToUse}</p>
                </div>
              )}

              {/* Thuật ngữ cần biết */}
              {guide.concepts && guide.concepts.length > 0 && (
                <div className="rounded-lg border border-outline-variant bg-surface-low/50 p-4">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">menu_book</span> Thuật ngữ cần biết
                  </p>
                  <dl className="space-y-1.5">
                    {guide.concepts.map((c, i) => (
                      <div key={i} className="text-sm leading-relaxed">
                        <dt className="inline font-bold text-on-surface">{c.term}: </dt>
                        <dd className="inline text-on-surface-variant">{c.explain}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/* Các bước làm */}
              {guide.sections.map((s, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <h3 className="text-sm font-bold text-on-surface">{s.heading}</h3>
                    {s.role && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        Vai trò: {s.role}
                      </span>
                    )}
                  </div>
                  <ol className="space-y-2.5">
                    {s.steps.map((st, j) => (
                      <li key={j} className="text-sm text-on-surface-variant flex gap-3 leading-relaxed">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                          {j + 1}
                        </span>
                        <span className="flex-1">{st}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}

              {/* Lưu ý quan trọng */}
              {guide.notes && guide.notes.length > 0 && (
                <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3">
                  <p className="text-xs font-bold text-rose-700 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">warning</span> Lưu ý quan trọng
                  </p>
                  <ul className="space-y-1">
                    {guide.notes.map((n, k) => (
                      <li key={k} className="text-xs text-on-surface-variant leading-relaxed">⚠️ {n}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mẹo */}
              {guide.tips && guide.tips.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">lightbulb</span> Mẹo
                  </p>
                  <ul className="space-y-1">
                    {guide.tips.map((t, k) => (
                      <li key={k} className="text-xs text-on-surface-variant leading-relaxed">💡 {t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-outline-variant bg-surface-low/30 flex items-center justify-between gap-3">
              <span className="text-xs text-on-surface-variant">
                WMS Vĩnh Giang · Hướng dẫn theo màn hình
              </span>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-hover transition-colors shrink-0"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
