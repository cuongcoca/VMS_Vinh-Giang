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
// Nhãn tháng cho lưới chọn tháng (Th1…Th12).
const MONTHS = Array.from({ length: 12 }, (_, i) => `Th${i + 1}`);

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
// Tự chèn dấu "/" khi gõ: chỉ giữ số, tối đa 8 chữ số (ddmmyyyy) → "dd/mm/yyyy".
function formatTyping(raw: string) {
  const dg = raw.replace(/\D/g, "").slice(0, 8);
  let out = dg.slice(0, 2);
  if (dg.length >= 3) out += "/" + dg.slice(2, 4);
  if (dg.length >= 5) out += "/" + dg.slice(4, 8);
  return out;
}
// Parse "dd/mm/yyyy" → "YYYY-MM-DD" nếu là NGÀY THẬT (chặn 31/02, 00/…), else null.
function parseDisplay(s: string): string | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
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

  // Cho phép GÕ TAY dd/mm/yyyy: `text` là chuỗi đang gõ, đồng bộ với `value`
  // khi không focus (để lịch/parent cập nhật vẫn hiển thị đúng).
  const [text, setText] = useState(() => toDisplay(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(toDisplay(value));
  }, [value, focused]);

  const handleTextChange = (raw: string) => {
    const f = formatTyping(raw);
    setText(f);
    if (f === "") {
      onChange("");
      return;
    }
    const iso = parseDisplay(f);
    if (iso) onChange(iso); // chỉ commit khi đã là ngày thật, đủ dd/mm/yyyy
  };
  const handleBlur = () => {
    setFocused(false);
    const iso = parseDisplay(text);
    if (iso) onChange(iso);
    else if (text.trim() === "") onChange("");
    else setText(toDisplay(value)); // gõ dở/sai → khôi phục giá trị hợp lệ gần nhất
  };

  const base = value ? new Date(value + "T00:00:00") : new Date();
  const [view, setView] = useState<{ y: number; m: number }>({
    y: base.getFullYear(),
    m: base.getMonth(),
  });

  // Chế độ hiển thị: lịch theo ngày · lưới chọn tháng · lưới chọn năm
  const [mode, setMode] = useState<"day" | "month" | "year">("day");
  const [yearStart, setYearStart] = useState(0);

  const openMonthPicker = () => setMode("month");
  const pickMonth = (m: number) => {
    setView((v) => ({ ...v, m }));
    setMode("day");
  };

  const openYearPicker = () => {
    setYearStart(view.y - (view.y % 12));
    setMode("year");
  };
  const prevYears = () => setYearStart((s) => s - 12);
  const nextYears = () => setYearStart((s) => s + 12);
  const pickYear = (y: number) => {
    setView((v) => ({ ...v, y }));
    // Về lại lịch ngày cho nhất quán với nút chọn tháng và giống lịch chuẩn:
    // chỉ đổi năm thì không phải chọn lại tháng. Muốn đổi tháng thì bấm nút tháng.
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
      {/* Ô nhập: GÕ TAY dd/mm/yyyy (tự chèn "/"), + icon lịch để chọn bằng lịch */}
      <div
        className={`relative w-full min-h-[44px] border rounded-lg bg-white flex items-center ${disabled ? "opacity-50" : ""} ${className}`}
      >
        <input
          type="text"
          id={id}
          inputMode="numeric"
          disabled={disabled}
          placeholder={placeholder}
          value={text}
          maxLength={10}
          onFocus={() => setFocused(true)}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleBlur();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-full min-h-[44px] pl-3 pr-10 py-2 text-sm text-on-surface bg-transparent rounded-lg outline-none placeholder:text-on-surface-variant/50"
        />
        <button
          type="button"
          disabled={disabled}
          tabIndex={-1}
          onClick={() => !disabled && setOpen((o) => !o)}
          aria-label="Mở lịch chọn ngày"
          className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-low text-on-surface-variant/70"
        >
          <span className="material-symbols-outlined text-[18px]">calendar_month</span>
        </button>
      </div>

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
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-low shrink-0"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                {/* Hai nút bấm rõ ràng: bấm tháng → lưới tháng, bấm năm → lưới năm.
                    Mũi tên xổ báo cho người dùng biết đây là nút chọn, không phải chữ. */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={openMonthPicker}
                    aria-label="Chọn tháng"
                    className="flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-sm font-bold text-on-surface bg-surface-low hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    Tháng {view.m + 1}
                    <span className="material-symbols-outlined text-[18px] -mr-1">arrow_drop_down</span>
                  </button>
                  <button
                    type="button"
                    onClick={openYearPicker}
                    aria-label="Chọn năm"
                    className="flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-sm font-bold text-on-surface bg-surface-low hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {view.y}
                    <span className="material-symbols-outlined text-[18px] -mr-1">arrow_drop_down</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={nextMonth}
                  aria-label="Tháng sau"
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-low shrink-0"
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
          ) : mode === "month" ? (
            <>
              {/* Lưới chọn THÁNG — mũi tên đổi năm, tiêu đề giữa mở lưới chọn năm. */}
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setView((v) => ({ ...v, y: v.y - 1 }))}
                  aria-label="Năm trước"
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-low shrink-0"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <button
                  type="button"
                  onClick={openYearPicker}
                  aria-label="Chọn năm"
                  className="flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-sm font-bold text-on-surface bg-surface-low hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {view.y}
                  <span className="material-symbols-outlined text-[18px] -mr-1">arrow_drop_down</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView((v) => ({ ...v, y: v.y + 1 }))}
                  aria-label="Năm sau"
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-low shrink-0"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 py-1">
                {MONTHS.map((label, i) => {
                  const isSel = i === view.m;
                  const now = new Date();
                  const isThisMonth = i === now.getMonth() && view.y === now.getFullYear();
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => pickMonth(i)}
                      className={`h-10 rounded-lg text-sm flex items-center justify-center transition-colors ${
                        isSel
                          ? "bg-primary text-white font-bold"
                          : isThisMonth
                            ? "border border-primary text-primary font-semibold"
                            : "hover:bg-surface-low text-on-surface"
                      }`}
                    >
                      {label}
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
