import React from 'react';
import { Lock } from 'lucide-react';

export default function Sidebar() {
  const available = ['MahaRERA'];
  const planned = ['NCDRC', 'Bombay High Court', 'Supreme Court'];

  return (
    <aside className="w-64 p-4 bg-white border-r border-[#e6e9ee] hidden lg:block">
      <h4 className="text-sm font-bold text-[#1a2332] mb-3">Courts</h4>
      <div className="space-y-2">
        {available.map(c => (
          <div key={c} className="flex items-center justify-between p-2 rounded-md bg-[#f8fafc]">
            <span className="text-sm font-medium text-[#1a2332]">{c}</span>
            <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Active</span>
          </div>
        ))}

        <div className="mt-3 text-xs text-[#5f6368]">Planned</div>
        {planned.map(c => (
          <div key={c} className="flex items-center justify-between p-2 rounded-md text-sm text-[#6b7280]">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#9ca3af]" />
              <span>{c}</span>
            </div>
            <span className="text-xs text-[#9ca3af] bg-[#f3f4f6] px-2 py-0.5 rounded-full">Indexing Data...</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
