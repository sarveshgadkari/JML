"use client";

import React from "react";
import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Slice = { name: string; value: number; fill: string };

export default function ClientRepresentationChart({
  data,
}: {
  data?: Slice[];
}) {
  const safeData = data ?? [];
  const homebuyerPct = Math.round(
    (safeData.find((d) => d.name.toLowerCase().includes("homebuyer"))?.value ?? 0)
  );

  return (
    <div className="relative h-[300px] w-full">
      <div className="text-center text-sm font-semibold text-slate-900 mb-2">
        {homebuyerPct}% Homebuyer Focus{" "}
        <span className="text-slate-600 font-medium">• MahaRERA appearances</span>
      </div>
      {safeData.length === 0 ? (
        <div className="mt-10 flex items-center justify-center text-sm text-[#5f6368]">
          No representation data for this lawyer.
        </div>
      ) : (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={safeData} dataKey="value" innerRadius={60} outerRadius={80} paddingAngle={2} />
          <Tooltip formatter={(v: any) => `${v}`} contentStyle={{ borderRadius: 10, border: "1px solid #e0e3e7" }} />
        </PieChart>
      </ResponsiveContainer>
      )}

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-900">{homebuyerPct}%</div>
          <div className="mt-0.5 text-xs text-slate-600 font-medium">Homebuyers</div>
        </div>
      </div>
    </div>
  );
}

