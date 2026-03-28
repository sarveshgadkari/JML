import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  individual: number;
  corporate: number;
  height?: number;
}

const COLORS = ['#3b82f6', '#f59e0b'];

export default function ClientRepresentationProfile({ individual, corporate, height = 220 }: Props) {
  const data = [
    { name: 'Individual Complainants', value: individual },
    { name: 'Corporate Respondents', value: corporate }
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#e0e3e7] p-4">
      <h3 className="text-lg font-semibold text-[#1a2332] mb-3">Representation Profile</h3>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={Math.min(80, height / 2 - 10)} label={({ name, percent }) => `${name.split(' ')[0]}: ${(percent! * 100).toFixed(0)}%`}>
              {data.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: any) => `${value}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-sm text-[#5f6368]">Shows whether the lawyer primarily represents individuals or corporate entities.</p>
    </div>
  );
}
