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

type Row = { name: string; cases: number; winRate: number };

export default function TopOpponentsChart({
  data,
  showWinRateLabel = true,
}: {
  data?: Row[];
  /** When false, only case counts are shown (analytics chart columns). */
  showWinRateLabel?: boolean;
}) {
  const rows = useMemo<Row[]>(() => data ?? [], [data]);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height={300}>
        {rows.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-sm text-[#5f6368]">
            No opponent data for this lawyer.
          </div>
        ) : (
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 8, right: showWinRateLabel ? 56 : 44, left: -18, bottom: 0 }}
          >
            <CartesianGrid stroke="#e0e3e7" strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 12, fill: "#5f6368" }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: "#0f172a", fontWeight: 600 }}
              width={124}
              tickFormatter={(v) => (String(v).length > 26 ? `${String(v).slice(0, 24)}…` : String(v))}
            />
            <Tooltip
              formatter={(v: any, k: any) => (k === "winRate" ? `${v}%` : `${v} cases`)}
              contentStyle={{ borderRadius: 10, border: "1px solid #e0e3e7" }}
            />
            <Bar dataKey="cases" fill="#1e40af" radius={[6, 6, 6, 6]} barSize={24}>
              {showWinRateLabel ? (
                <LabelList
                  dataKey="winRate"
                  position="right"
                  formatter={(v: any) => `${v}% win`}
                  fill="#0f172a"
                  fontSize={11}
                />
              ) : (
                <LabelList
                  dataKey="cases"
                  position="right"
                  formatter={(v: any) => `${v}`}
                  fill="#0f172a"
                  fontSize={11}
                />
              )}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

