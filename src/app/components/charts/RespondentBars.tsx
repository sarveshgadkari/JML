"use client";

import React, { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { label: string; value: number };

export default function RespondentBars({ data }: { data?: Row[] }) {
  const rows = useMemo<Row[]>(() => data ?? [], [data]);
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height={300}>
        {rows.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-sm text-[#5f6368]">
            No outcome data available.
          </div>
        ) : (
          <BarChart data={rows} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e0e3e7" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#5f6368" }} />
            <YAxis tick={{ fontSize: 12, fill: "#5f6368" }} />
            <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ borderRadius: 10, border: "1px solid #e0e3e7" }} />
            <Bar dataKey="value" fill="#334155" radius={[6, 6, 0, 0]} barSize={28}>
              <LabelList dataKey="value" position="top" formatter={(v: any) => `${v}%`} fill="#0f172a" fontSize={11} />
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

