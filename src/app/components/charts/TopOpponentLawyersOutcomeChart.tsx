"use client";

import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { name: string; cases: number; won: number; lost: number; settled: number };

export default function TopOpponentLawyersOutcomeChart({ data }: { data?: Row[] }) {
  const rows = useMemo<Row[]>(() => (data ?? []).map((r) => ({ ...r })), [data]);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height={300}>
        {rows.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-sm text-[#5f6368]">
            No opponent-lawyer data for this lawyer.
          </div>
        ) : (
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#e0e3e7" strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#5f6368" }} />
            <YAxis
              type="category"
              dataKey="name"
              width={138}
              tick={{ fontSize: 12, fill: "#0f172a", fontWeight: 600 }}
            />
            <Tooltip formatter={(v: any) => `${v}`} contentStyle={{ borderRadius: 10, border: "1px solid #e0e3e7" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="won" name="Won" stackId="a" fill="#166534" barSize={24} />
            <Bar dataKey="lost" name="Lost" stackId="a" fill="#b91c1c" barSize={24} />
            <Bar dataKey="settled" name="Settled" stackId="a" fill="#f59e0b" barSize={24} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

