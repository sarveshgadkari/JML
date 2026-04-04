"use client";

import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { name: string; cases: number; winRate: number; lossRate: number; settlementRate: number };

export default function TopOpponentLawyersOutcomeChart({
  data,
  emptyMessage = "No data available.",
}: {
  data?: Row[];
  emptyMessage?: string;
}) {
  const rows = useMemo<Row[]>(() => (data ?? []).map((r) => ({ ...r })), [data]);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height={300}>
        {rows.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-sm text-[#5f6368]">
            {emptyMessage}
          </div>
        ) : (
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="wonGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
              <linearGradient id="lostGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#b91c1c" />
              </linearGradient>
              <linearGradient id="settledGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e0e3e7" strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: "#5f6368" }} />
            <YAxis
              type="category"
              dataKey="name"
              width={138}
              tick={{ fontSize: 12, fill: "#0f172a", fontWeight: 600 }}
            />
            <Tooltip
              formatter={(v: any, key: any, payload: any) => {
                if (key === "cases") return [`${payload?.payload?.cases ?? v} cases`, "Cases"];
                return [`${Number(v).toFixed(2)}%`, key === "winRate" ? "Win rate" : key === "lossRate" ? "Loss rate" : "Settlement rate"];
              }}
              contentStyle={{ borderRadius: 10, border: "1px solid #e0e3e7" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="winRate" name="Win rate" stackId="a" fill="url(#wonGradient)" barSize={24} />
            <Bar dataKey="lossRate" name="Loss rate" stackId="a" fill="url(#lostGradient)" barSize={24} />
            <Bar dataKey="settlementRate" name="Settlement rate" stackId="a" fill="url(#settledGradient)" barSize={24}>
              <LabelList dataKey="cases" position="right" fill="#0f172a" fontSize={11} formatter={(v: number) => `${v} cases`} />
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

