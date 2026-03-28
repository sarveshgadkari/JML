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

type Row = {
  year: string;
  refund: number;
  possession: number;
  conciliation: number;
  dismissed: number;
};

export default function RERAResolutionMatrix({ data }: { data?: Row[] }) {
  const rows = useMemo<Row[]>(() => data ?? [], [data]);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height={300}>
        {rows.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-sm text-[#5f6368]">
            No resolution-matrix data for this lawyer.
          </div>
        ) : (
          <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e0e3e7" strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#5f6368" }} />
            <YAxis tick={{ fontSize: 12, fill: "#5f6368" }} allowDecimals={false} />
            <Tooltip formatter={(v: any) => `${v} cases`} contentStyle={{ borderRadius: 10, border: "1px solid #e0e3e7" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />

            <Bar dataKey="refund" name="Refund Ordered" stackId="a" fill="#22c55e" />
            <Bar dataKey="possession" name="Possession Ordered" stackId="a" fill="#06b6d4" />
            <Bar dataKey="conciliation" name="Settled via Conciliation" stackId="a" fill="#6366f1" />
            <Bar dataKey="dismissed" name="Dismissed" stackId="a" fill="#cbd5e1" />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

