import React from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title?: string;
  children?: React.ReactNode;
  onClose: () => void;
}

export default function MetricExplanationSheet({ open, title = '', children, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full md:max-w-md lg:max-w-lg bg-white rounded-t-xl lg:rounded-xl p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[#1a2332]">{title}</h3>
            <p className="text-sm text-[#5f6368] mt-1">An empathetic explanation to help non-expert users interpret this metric.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100">
            <X className="w-5 h-5 text-[#6b7280]" />
          </button>
        </div>

        <div className="mt-4 text-sm text-[#374151]">
          {children}
        </div>
      </div>
    </div>
  );
}
