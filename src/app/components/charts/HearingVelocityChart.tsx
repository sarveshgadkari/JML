"use client";

import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { bucket: string; cases: number };

export default function HearingVelocityChart({
  data,
  tribunalAvg = 6,
  loading = false,
}: {
  data?: Row[];
  tribunalAvg?: number;
  loading?: boolean;
}) {
  const rows = useMemo<Row[]>(() => data ?? [], [data]);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height={300}>
        {rows.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-sm text-[#5f6368]">
            {loading ? "loading please wait" : "No hearing-volume data for this lawyer."}
          </div>
        ) : (
        <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e0e3e7" strokeDasharray="3 3" />
          <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: "#5f6368" }}>
            <Label value="Hearing Buckets" position="insideBottom" offset={-2} fill="#475569" fontSize={12} />
          </XAxis>
          <YAxis tick={{ fontSize: 12, fill: "#5f6368" }} allowDecimals={false}>
            <Label value="Case Count" angle={-90} position="insideLeft" fill="#475569" fontSize={12} />
          </YAxis>
          <Tooltip formatter={(v: any) => `${v} cases`} contentStyle={{ borderRadius: 10, border: "1px solid #e0e3e7" }} />
          <ReferenceLine y={tribunalAvg} stroke="#b91c1c" strokeDasharray="3 3">
            <Label value="Tribunal Avg" position="insideTopRight" fill="#b91c1c" fontSize={11} />
          </ReferenceLine>
          <Bar dataKey="cases" fill="#1e40af" radius={[4, 4, 0, 0]} barSize={32} />
        </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

