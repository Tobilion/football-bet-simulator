import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

interface InfoButtonProps {
  text: string;
}

export const InfoButton: React.FC<InfoButtonProps> = ({ text }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="text-slate-500 hover:text-slate-300 transition-colors p-1"
        title="Tap for information"
      >
        <Info size={14} />
      </button>
      
      {open && (
        <div className="absolute top-6 left-0 z-50 w-48 p-2 text-xs text-white bg-slate-800 border border-slate-600 rounded-md shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-start mb-1">
            <span className="font-bold text-emerald-400">Info</span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white"><X size={12} /></button>
          </div>
          <p className="leading-tight text-slate-300">{text}</p>
        </div>
      )}
    </div>
  );
};
