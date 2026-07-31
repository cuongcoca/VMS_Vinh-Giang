"use client";

/**
 * UC-OUT-02: 2 chart phụ trợ cho báo cáo xuất kho.
 *   - Bar chart: Top 5 mã xuất nhiều nhất
 *   - Pie chart: Tỷ trọng theo nhóm hàng
 * Component này được dynamic-import để code-split recharts (~150KB) ra khỏi initial bundle.
 */

import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";

type ReportItem = {
  item_code?: string;
  item_name?: string;
  group_name?: string | null;
  total_qty_box: number;
};

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316"];

export default function ReportCharts({ data }: { data: ReportItem[] }) {
  // Top 5 SKU theo SL xuất
  const top5 = [...data]
    .sort((a, b) => b.total_qty_box - a.total_qty_box)
    .slice(0, 5)
    .map((r) => ({
      name: r.item_code || "—",
      label: r.item_name?.slice(0, 18) || r.item_code || "—",
      qty: r.total_qty_box,
    }));

  // Aggregate theo group_name
  const groupMap: Record<string, number> = {};
  for (const r of data) {
    const g = r.group_name || "Khác";
    groupMap[g] = (groupMap[g] || 0) + r.total_qty_box;
  }
  const groupData = Object.entries(groupMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  if (data.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Bar chart top 5 */}
      <div className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm">
        <h4 className="text-sm font-bold text-primary mb-2 flex items-center gap-1">
          🏆 Top 5 mã xuất nhiều nhất
        </h4>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={top5} margin={{ top: 10, right: 10, left: -20, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "#64748b" }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}
              formatter={(v) => [Number(v).toLocaleString(), "SL xuất"]}
              labelFormatter={(name, payload) => {
                const item = top5.find((t) => t.name === name);
                return item?.label || name;
              }}
            />
            <Bar dataKey="qty" fill="#3b82f6" radius={[4, 4, 0, 0]}>
              {top5.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie chart theo nhóm */}
      <div className="bg-white p-4 rounded-xl border border-outline-variant shadow-sm">
        <h4 className="text-sm font-bold text-primary mb-2 flex items-center gap-1">
          📊 Xuất theo nhóm hàng
        </h4>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={groupData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={35}
              paddingAngle={2}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
              fontSize={10}
            >
              {groupData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}
              formatter={(v) => [Number(v).toLocaleString(), "SL xuất"]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
