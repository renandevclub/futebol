'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface UploadProgressProps {
  progress: number;
  label?: string;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({ progress, label = 'Enviando arquivo...' }) => {
  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin" />
          <span>{label}</span>
        </div>
        <span className="font-extrabold text-brand-500">{progress}%</span>
      </div>
      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-amber-400 transition-all duration-300 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
