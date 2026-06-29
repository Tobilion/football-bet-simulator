import React, { useState } from "react";

interface HistoryPoint {
  timestamp: number;
  balance: number;
  detail: string;
}

interface BankrollChartProps {
  history: HistoryPoint[] | undefined;
  startingBalance?: number;
}

const W = 800;
const H = 120;
const PAD_X = 8;
const PAD_Y = 12;

export const BankrollChart: React.FC<BankrollChartProps> = ({ history, startingBalance = 1000 }) => {
  const [hovered, setHovered] = useState<number | null>(null);

  const pts = (history ?? []).filter((_, i, arr) =>
    arr.length <= 50 || i % Math.ceil(arr.length / 50) === 0 || i === arr.length - 1,
  );

  if (pts.length < 2) {
    return (
      <div className="w-full h-[120px] flex items-center justify-center text-slate-600 text-xs font-mono">
        No bankroll data yet — place bets to start tracking.
      </div>
    );
  }

  const minBal = Math.min(...pts.map((p) => p.balance));
  const maxBal = Math.max(...pts.map((p) => p.balance));
  const range = Math.max(maxBal - minBal, 1);

  const toX = (i: number) => PAD_X + (i / (pts.length - 1)) * (W - PAD_X * 2);
  const toY = (bal: number) => PAD_Y + (1 - (bal - minBal) / range) * (H - PAD_Y * 2);

  const refY = toY(startingBalance);
  const clampedRefY = Math.max(PAD_Y, Math.min(H - PAD_Y, refY));

  // Build SVG path
  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.balance).toFixed(1)}`)
    .join(" ");

  // Area fill path (close back along bottom)
  const lastX = toX(pts.length - 1).toFixed(1);
  const firstX = toX(0).toFixed(1);
  const bottomY = (H - PAD_Y).toFixed(1);
  const areaPath = `${linePath} L${lastX},${bottomY} L${firstX},${bottomY} Z`;

  const hoveredPt = hovered !== null ? pts[hovered] : null;
  const hoveredX = hovered !== null ? toX(hovered) : 0;
  const hoveredY = hovered !== null ? toY(pts[hovered].balance) : 0;

  const isPositive = (pts[pts.length - 1]?.balance ?? 0) >= startingBalance;

  return (
    <div className="w-full relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: "120px" }}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="bankroll-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Gradient fill */}
        <path d={areaPath} fill="url(#bankroll-grad)" />

        {/* Reference line at starting balance */}
        {startingBalance >= minBal && startingBalance <= maxBal && (
          <line
            x1={PAD_X} y1={clampedRefY} x2={W - PAD_X} y2={clampedRefY}
            stroke="#64748b" strokeWidth="1" strokeDasharray="4 4" opacity="0.5"
          />
        )}

        {/* Main line */}
        <path d={linePath} fill="none" stroke={isPositive ? "#10b981" : "#ef4444"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Hover crosshair */}
        {hovered !== null && (
          <>
            <line x1={hoveredX} y1={PAD_Y} x2={hoveredX} y2={H - PAD_Y}
              stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            <circle cx={hoveredX} cy={hoveredY} r="5" fill={isPositive ? "#10b981" : "#ef4444"} opacity="0.9" />
            <circle cx={hoveredX} cy={hoveredY} r="8" fill="none" stroke={isPositive ? "#10b981" : "#ef4444"} strokeWidth="1" opacity="0.4" />
          </>
        )}

        {/* Invisible hit areas for hover */}
        {pts.map((_, i) => (
          <rect
            key={i}
            x={toX(i) - (W / pts.length) / 2}
            y={0}
            width={W / pts.length}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
          />
        ))}

        {/* Start/end balance labels */}
        <text x={PAD_X + 2} y={H - 2} fontSize="9" fill="#64748b" fontFamily="monospace">
          ${pts[0].balance.toLocaleString()}
        </text>
        <text x={W - PAD_X - 2} y={H - 2} fontSize="9" fill={isPositive ? "#10b981" : "#ef4444"} fontFamily="monospace" textAnchor="end">
          ${pts[pts.length - 1].balance.toLocaleString()}
        </text>
      </svg>

      {/* Tooltip */}
      {hoveredPt && (
        <div
          className="absolute top-0 pointer-events-none z-10 bg-[#0b0e14] border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] font-mono shadow-xl"
          style={{ left: Math.min(hoveredX / W * 100, 75) + "%", transform: "translateX(-50%)" }}
        >
          <p className={`font-bold ${hoveredPt.balance >= startingBalance ? "text-emerald-400" : "text-red-400"}`}>
            ${hoveredPt.balance.toLocaleString()}
          </p>
          <p className="text-slate-500">{hoveredPt.detail}</p>
        </div>
      )}
    </div>
  );
};
