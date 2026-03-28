import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface Props {
  data: Array<{ name: string; count: number }>;
  height?: number;
}

const COLORS = ['#3b82f6', '#2563eb', '#60a5fa', '#93c5fd', '#bfdbfe'];

export default function FrequentOpposingEntities({ data, height = 240 }: Props) {
  const top = data.slice(0, 5).map(d => ({ ...d })).reverse(); // reverse so largest bottom

  return (
    <div className="bg-white rounded-2xl border border-[#e0e3e7] p-4">
      <h3 className="text-lg font-semibold text-[#1a2332] mb-3">Frequent Opposing Entities</h3>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" width={160} tick={{ fill: '#475569', fontSize: 13 }} />
            <Tooltip formatter={(v: any) => `${v} cases`} />
            <Bar dataKey="count" radius={[6, 6, 6, 6]} barSize={14}>
              {top.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-sm text-[#5f6368]">Top entities this lawyer frequently litigates against (pilot: builders/companies).</p>
    </div>
  );
}
