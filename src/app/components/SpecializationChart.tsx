import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export type SpecData = Array<{
  category: string;
  value: number;
  subcategories?: Array<{ name: string; value: number }>;
}>;

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface Props {
  data: SpecData;
  height?: number;
}

/**
 * SpecializationChart
 * - If the dataset has only one parent category and that parent contains subcategories,
 *   the chart auto-drills-down and renders subcategories instead.
 * - Otherwise shows the parent-level breakdown.
 * - Domain-agnostic labels and simple donut presentation.
 */
export default function SpecializationChart({ data, height = 240 }: Props) {
  const [drilled, setDrilled] = useState(false);

  const parentCount = data.length;

  const parentTotal = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  const singleWithSubs = parentCount === 1 && data[0].subcategories && data[0].subcategories.length > 0;

  const displayData = useMemo(() => {
    if (singleWithSubs && drilled) {
      return data[0].subcategories!.map((s) => ({ name: s.name, value: s.value }));
    }
    // parent-level
    return data.map((d) => ({ name: d.category, value: d.value }));
  }, [data, drilled, singleWithSubs]);

  return (
    <div className="bg-white rounded-2xl border border-[#e0e3e7] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-[#1a2332]">Specializations</h3>
        {singleWithSubs && (
          <button
            onClick={() => setDrilled((s) => !s)}
            className="text-sm text-[#1a2332] bg-[#f0f2f5] px-3 py-1 rounded-md"
          >
            {drilled ? 'Show parent' : 'Auto‑drilldown'}
          </button>
        )}
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={displayData} dataKey="value" nameKey="name" innerRadius={height / 6} outerRadius={Math.min(80, height / 2 - 10)} paddingAngle={2} label={({ name, percent }) => `${name}: ${(percent! * 100).toFixed(0)}%`}>
              {displayData.map((entry, idx) => (
                <Cell key={`c-${idx}`} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: any) => `${value}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 text-sm text-[#5f6368]">
        {singleWithSubs && !drilled && (
          <span>Dataset contains a single parent category — click ‘Auto‑drilldown’ to view subcategories.</span>
        )}
      </div>
    </div>
  );
}
