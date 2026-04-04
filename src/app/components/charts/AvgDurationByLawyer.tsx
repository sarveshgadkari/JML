"use client";

import React, { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { name: string; avgDays: number };

export default function AvgDurationByLawyer({ data, loading = false }: { data?: Row[]; loading?: boolean }) {
  const rows = useMemo<Row[]>(() => data ?? [], [data]);
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height={300}>
        {rows.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-sm text-[#5f6368]">
            {loading ? "loading please wait" : "No duration data available."}
          </div>
        ) : (
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
          >
            <CartesianGrid stroke="#e0e3e7" strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 12, fill: "#5f6368" }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: "#0f172a", fontWeight: 600 }}
              width={160}
            />
            <Tooltip formatter={(v: any) => `${v} days`} contentStyle={{ borderRadius: 10, border: "1px solid #e0e3e7" }} />
            <Bar dataKey="avgDays" fill="#0ea5e9" radius={[6, 6, 6, 6]} barSize={24}>
              <LabelList
                dataKey="avgDays"
                position="right"
                formatter={(v: any) => `${v}d`}
                fill="#0f172a"
                fontSize={11}
              />
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

