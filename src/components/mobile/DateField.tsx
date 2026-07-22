"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * DateField — ô chọn ngày TỰ VẼ (không dùng <input type="date"> native).
 *
 * Lý do: widget ngày native hiển thị KHÁC nhau giữa iOS / Android / desktop.
 * Component này render bằng React nên giống hệt nhau trên mọi nền tảng:
 * luôn hiện "dd/mm/yyyy" + icon lịch khi trống, bấm ra lịch chọn ngày.
 *
 * Giá trị dùng định dạng "YYYY-MM-DD" (giống type=date) để thay thế trực tiếp.
 *   <DateField value={d.expiry_date} onChange={(val) => ...} />
 */

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toDisplay(val: string) {
  if (!val) return "";
  const parts = val.split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}
function todayISO() {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

export function DateField({
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
  className = "border-outline-variant",
  disabled = false,
  id,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const base = value ? new Date(value + "T00:00:00") : new Date();
  const [view, setView] = useState<{ y: number; m: number }>({
    y: base.getFullYear(),
    m: base.getMonth(),
  });

  // Chế độ hiển thị: lịch theo ngày, hoặc lưới chọn năm
  const [mode, setMode] = useState<"day" | "year">("day");
  const [yearStart, setYearStart] = useState(0);

  const openYearPicker = () => {
    setYearStart(view.y - (view.y % 12));
    setMode("year");
  };
  const prevYears = () => setYearStart((s) => s - 12);
  const nextYears = () => setYearStart((s) => s + 12);
  const pickYear = (y: number) => {
    setView((v) => ({ ...v, y }));
    setMode("day");
  };

  // Mở lịch: nhảy tới tháng của giá trị đang chọn (nếu có), về lại chế độ ngày
  useEffect(() => {
    if (open && value) {
      const dt = new Date(value + "T00:00:00");
      if (!isNaN(dt.getTime())) setView({ y: dt.getFullYear(), m: dt.getMonth() });
    }
    if (open) setMode("day");
  }, [open, value]);

  // Đóng khi bấm ra ngoài / nhấn Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const prevMonth = () =>
    setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const nextMonth = () =>
    setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  const pick = (day: number) => {
    onChange(`${view.y}-${pad(view.m + 1)}-${pad(day)}`);
    setOpen(false);
  };

  // Dựng lưới ngày (tuần bắt đầu Thứ 2)
  const firstWeekday = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const tdy = todayISO();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`w-full min-h-[44px] px-3 py-2 text-sm border rounded-lg bg-white flex items-center justify-between gap-2 disabled:opacity-50 ${className}`}
      >
        <span className={value ? "text-on-surface" : "text-on-surface-variant/50"}>
          {value ? toDisplay(value) : placeholder}
        </span>
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant/70">
          calendar_month
        </span>
      </button>

      {open && (
        <>
          {/* Nền mờ phủ toàn màn hình — bấm ra ngoài để đóng */}
          <div className="fixed inset-0 z-[90] bg-black/30" onClick={() => setOpen(false)} aria-hidden="true" />
          {/* Lịch canh GIỮA màn hình (fixed) — không bao giờ tràn ra ngoài viewport */}
          <div className="fixed z-[100] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] max-w-[92vw] max-h-[90vh] overflow-auto bg-white border border-outline-variant rounded-xl shadow-xl p-3">
          {mode === "day" ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={prevMonth}
                  aria-label="Tháng trước"
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-low"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <span className="text-sm font-bold text-on-surface flex items-center gap-1">
                  <span>Tháng {view.m + 1} /</span>
                  <button
                    type="button"
                    onClick={openYearPicker}
                    className="px-1.5 py-0.5 rounded hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {view.y}
                  </button>
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  aria-label="Tháng sau"
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-low"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>

              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {WEEKDAYS.map((w) => (
                  <div
                    key={w}
                    className="h-7 flex items-center justify-center text-[11px] font-semibold text-on-surface-variant/70"
                  >
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((d, i) => {
                  if (d === null) return <div key={`e${i}`} />;
                  const cur = `${view.y}-${pad(view.m + 1)}-${pad(d)}`;
                  const isSel = cur === value;
                  const isToday = cur === tdy;
                  return (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => pick(d)}
                      className={`h-9 rounded-lg text-sm flex items-center justify-center transition-colors ${
                        isSel
                          ? "bg-primary text-white font-bold"
                          : isToday
                            ? "border border-primary text-primary font-semibold"
                            : "hover:bg-surface-low text-on-surface"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={prevYears}
                  aria-label="12 năm trước"
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-low"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <span className="text-sm font-bold text-on-surface">
                  {yearStart} - {yearStart + 11}
                </span>
                <button
                  type="button"
                  onClick={nextYears}
                  aria-label="12 năm sau"
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-low"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 py-1">
                {Array.from({ length: 12 }, (_, i) => yearStart + i).map((y) => {
                  const isSel = y === view.y;
                  const isThisYear = y === new Date().getFullYear();
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => pickYear(y)}
                      className={`h-10 rounded-lg text-sm flex items-center justify-center transition-colors ${
                        isSel
                          ? "bg-primary text-white font-bold"
                          : isThisYear
                            ? "border border-primary text-primary font-semibold"
                            : "hover:bg-surface-low text-on-surface"
                      }`}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex justify-between items-center mt-2 pt-2 border-t border-outline-variant/50">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="text-xs font-semibold text-rose-600 px-2 py-1.5 rounded hover:bg-rose-50"
            >
              Xóa
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(tdy);
                setOpen(false);
              }}
              className="text-xs font-semibold text-primary px-2 py-1.5 rounded hover:bg-primary/5"
            >
              Hôm nay
            </button>
          </div>
          </div>
        </>
      )}
    </div>
  );
}
