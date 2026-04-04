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

export type SettlementRateRow = {
  label: string;
  pct: number;
  n: number;
  kind?: string | null;
};

export default function TopSettlementRatesChart({ data }: { data?: SettlementRateRow[] }) {
  const rows = useMemo(() => {
    const base = data ?? [];
    return base
      .filter((r) => r && (r.n ?? 0) >= 1 && r.label)
      .map((r) => ({
        ...r,
        label: String(r.label).length > 32 ? `${String(r.label).slice(0, 30)}…` : String(r.label),
      }));
  }, [data]);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height={300}>
        {rows.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-sm text-[#5f6368]">
            No settlement-rate context with at least 3 cases found.
          </div>
        ) : (
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 52, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#e0e3e7" strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: "#5f6368" }} unit="%" />
            <YAxis type="category" dataKey="label" width={148} tick={{ fontSize: 11, fill: "#0f172a", fontWeight: 600 }} />
            <Tooltip
              formatter={(v: any, _k: string, item: any) => {
                const n = item?.payload?.n;
                return [`${v}% settled (${n} cases)`, "Rate"];
              }}
              contentStyle={{ borderRadius: 10, border: "1px solid #e0e3e7" }}
            />
            <Bar dataKey="pct" name="Settlement %" fill="#92400e" radius={[6, 6, 6, 6]} barSize={22}>
              <LabelList
                dataKey="pct"
                position="right"
                fill="#0f172a"
                fontSize={11}
                formatter={(v: number) => `${v}%`}
              />
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
