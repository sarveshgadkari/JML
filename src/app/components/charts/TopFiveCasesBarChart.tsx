"use client";

import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TopFiveCaseRow = { name: string; cases: number };

export default function TopFiveCasesBarChart({
  data,
  emptyMessage = "No data.",
}: {
  data?: TopFiveCaseRow[];
  emptyMessage?: string;
}) {
  const rows = useMemo(() => (data ?? []).filter((r) => (r.cases ?? 0) > 0 || (r.name ?? "").trim()), [data]);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height={300}>
        {rows.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-sm text-[#5f6368]">{emptyMessage}</div>
        ) : (
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 48, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#e0e3e7" strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#5f6368" }} />
            <YAxis
              type="category"
              dataKey="name"
              width={138}
              tick={{ fontSize: 11, fill: "#0f172a", fontWeight: 600 }}
              tickFormatter={(v) => (String(v).length > 28 ? `${String(v).slice(0, 26)}…` : String(v))}
            />
            <Tooltip formatter={(v: any) => [`${v} cases`, "Cases"]} contentStyle={{ borderRadius: 10, border: "1px solid #e0e3e7" }} />
            <Bar dataKey="cases" fill="#1e40af" radius={[6, 6, 6, 6]} barSize={22}>
              <LabelList dataKey="cases" position="right" fill="#0f172a" fontSize={11} formatter={(v: number) => `${v}`} />
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
