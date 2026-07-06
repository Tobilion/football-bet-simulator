import React from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: "bet" | "ticket" | "transfer" | "default";
  ctaText?: string;
  onCtaClick?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = "default",
  ctaText,
  onCtaClick,
  className = "",
}) => {
  const renderIllustration = () => {
    switch (icon) {
      case "bet":
        return (
          <svg className="w-24 h-24 text-emerald-500/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {/* A clean, modern ticket/bet-slip outline */}
            <rect x={3} y={3} width={18} height={18} rx={3} stroke="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h10M7 16h6" />
            <circle cx={16} cy={16} r={1.5} fill="currentColor" className="text-emerald-400/50" />
          </svg>
        );
      case "ticket":
        return (
          <svg className="w-24 h-24 text-emerald-500/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {/* Betting tickets layout */}
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-12h9c.621 0 1.13.433 1.25 1a1.5 1.5 0 000 3 1.5 1.5 0 000 3 1.5 1.5 0 000 3c-.12.567-.629 1-1.25 1h-9c-.621 0-1.13-.433-1.25-1a1.5 1.5 0 000-3 1.5 1.5 0 000-3 1.5 1.5 0 000-3c.12-.567.629-1 1.25-1z" />
          </svg>
        );
      case "transfer":
        return (
          <svg className="w-24 h-24 text-cyan-500/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {/* Players transfer loop */}
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            <circle cx={12} cy={7.5} r={2} className="text-cyan-400/50" fill="currentColor" />
            <circle cx={12} cy={16.5} r={2} className="text-cyan-400/50" fill="currentColor" />
          </svg>
        );
      default:
        return (
          <svg className="w-24 h-24 text-slate-500/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <circle cx={12} cy={12} r={9} />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
          </svg>
        );
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-[#12151c]/30 border border-white/5 backdrop-blur-md ${className}`}>
      <div className="mb-4 flex items-center justify-center">
        {renderIllustration()}
      </div>
      <h3 className="text-sm font-bold text-slate-200 mb-1">{title}</h3>
      <p className="text-[11px] text-slate-400 max-w-[240px] mb-4 leading-normal">{description}</p>
      {ctaText && onCtaClick && (
        <button
          onClick={onCtaClick}
          className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] rounded-xl shadow-lg hover:shadow-emerald-500/10 active:scale-95 transition-all cursor-pointer"
        >
          {ctaText}
        </button>
      )}
    </div>
  );
};
