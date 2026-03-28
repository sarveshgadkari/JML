import React from 'react';
import { Lock } from 'lucide-react';

const AVAILABLE = ['MahaRERA'];
const PLANNED = [
  'Consumer Disputes Redressal Commission (NCDRC)',
  'Bombay High Court',
  'Supreme Court'
];

interface Props {
  value?: string;
  onChange?: (v: string) => void;
}

export default function CourtFilterDropdown({ value = 'MahaRERA', onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-3">
      <label className="text-sm font-semibold text-[#1a2332]">Court</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#e0e3e7] bg-white text-sm"
        >
          {AVAILABLE.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
          {PLANNED.map(c => (
            <option key={c} value={c} disabled>{c} (Indexing Data...)</option>
          ))}
        </select>
      </div>
    </div>
  );
}
