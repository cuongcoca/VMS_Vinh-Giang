"use client";
import Link from "next/link";
import { mobileHref } from "@/lib/mobile-href";

const menuItems = [
  { href: "/thukho/warehouse/queue", icon: "pending_actions", label: "Pallet chờ xếp", desc: "Pallet đã xác nhận chờ xe nâng", color: "text-blue-600 bg-blue-50" },
  { href: "/thukho/warehouse/staging", icon: "local_shipping", label: "Khu chờ xuất", desc: "Hàng ở khu staging-out", color: "text-amber-600 bg-amber-50" },
  { href: "/thukho/warehouse/inventory", icon: "inventory", label: "Tồn kho theo mã", desc: "Xem tồn kho chi tiết theo SKU", color: "text-green-600 bg-green-50" },
  { href: "/thukho/pallet", icon: "inventory_2", label: "Tồn kho pallet", desc: "Danh sách pallet trong kho", color: "text-purple-600 bg-purple-50" },
  { href: "/thukho/warehouse/stocktake", icon: "fact_check", label: "Kiểm kê vị trí", desc: "Phiên kiểm kê được phân công", color: "text-rose-600 bg-rose-50" },
  { href: "/thukho/warehouse/movements", icon: "swap_horiz", label: "Lịch sử luân chuyển", desc: "Tra cứu di chuyển pallet", color: "text-cyan-600 bg-cyan-50" },
];

export default function ThukhoWarehousePage() {
  return (
    <div className="px-margin-mobile py-md flex flex-col gap-md">
      <h1 className="text-lg sm:text-xl font-bold text-primary flex items-center gap-2"><span className="material-symbols-outlined text-[22px] sm:text-[26px]">local_shipping</span> Kho hàng</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-gutter">
        {menuItems.map(item => (
          <Link key={item.href} href={mobileHref(item.href)} className="industrial-card p-md sm:p-lg rounded-xl bg-surface shadow-sm hover:border-primary/30 active:scale-[0.98] transition-all flex flex-col gap-sm aspect-square justify-between">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center ${item.color}`}><span className="material-symbols-outlined text-[28px] sm:text-[32px]">{item.icon}</span></div>
            <div className="flex flex-col gap-1">
              <span className="text-sm sm:text-base font-bold text-primary">{item.label}</span>
              <span className="text-[11px] md:text-xs text-on-surface-variant leading-tight">{item.desc}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
