import React from "react";

export interface Frame {
  t: number;
  ball: [number, number];
  players: Record<string, [number, number]>;
  owner: string | null;
}

interface Props {
  frame: Frame | null;
  homeTeamId: string;
  homeColor: string;
  awayColor: string;
  homeName?: string;
  awayName?: string;
}

// Top-down 2D pitch (105 x 68 m) as SVG. Player dots coloured by which team's id
// prefixes their footysim pid ("<teamId>__<playerId>"). Team names + attacking
// direction shown on each half.
export const FootballPitch2D: React.FC<Props> = ({ frame, homeTeamId, homeColor, awayColor, homeName, awayName }) => {
  const L = 105, W = 68;
  return (
    <svg viewBox={`-3 -3 ${L + 6} ${W + 10}`} className="w-full rounded-xl select-none" style={{ background: "linear-gradient(160deg,#0c4423,#082f18)" }}>
      {/* mowing stripes */}
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x={(i * L) / 7} y={0} width={L / 7} height={W} fill={i % 2 ? "rgba(255,255,255,0.03)" : "transparent"} />
      ))}
      {/* faint team-colour tint per half */}
      <rect x={0} y={0} width={L / 2} height={W} fill={homeColor} opacity={0.06} />
      <rect x={L / 2} y={0} width={L / 2} height={W} fill={awayColor} opacity={0.06} />
      {/* markings */}
      <g stroke="rgba(255,255,255,0.4)" strokeWidth={0.28} fill="none">
        <rect x={0} y={0} width={L} height={W} />
        <line x1={L / 2} y1={0} x2={L / 2} y2={W} />
        <circle cx={L / 2} cy={W / 2} r={9.15} />
        <circle cx={L / 2} cy={W / 2} r={0.6} fill="rgba(255,255,255,0.4)" stroke="none" />
        <rect x={0} y={W / 2 - 20.16} width={16.5} height={40.32} />
        <rect x={L - 16.5} y={W / 2 - 20.16} width={16.5} height={40.32} />
        <rect x={0} y={W / 2 - 9.16} width={5.5} height={18.32} />
        <rect x={L - 5.5} y={W / 2 - 9.16} width={5.5} height={18.32} />
        <rect x={-1.6} y={W / 2 - 3.66} width={1.6} height={7.32} stroke="rgba(255,255,255,0.7)" />
        <rect x={L} y={W / 2 - 3.66} width={1.6} height={7.32} stroke="rgba(255,255,255,0.7)" />
      </g>
      {/* team labels under the pitch */}
      {homeName && (
        <text x={L / 4} y={W + 5.5} fill={homeColor} fontSize={3.4} fontWeight="bold" textAnchor="middle" style={{ textTransform: "uppercase" }}>
          {homeName} →
        </text>
      )}
      {awayName && (
        <text x={(3 * L) / 4} y={W + 5.5} fill={awayColor} fontSize={3.4} fontWeight="bold" textAnchor="middle" style={{ textTransform: "uppercase" }}>
          ← {awayName}
        </text>
      )}
      {frame && Object.entries(frame.players).map(([pid, pos]) => {
        const isHome = pid.startsWith(homeTeamId + "__");
        const isOwner = frame.owner === pid;
        return (
          <g key={pid}>
            {isOwner && <circle cx={pos[0]} cy={pos[1]} r={2.6} fill="none" stroke="#fde047" strokeWidth={0.5} />}
            <circle cx={pos[0]} cy={pos[1]} r={1.45} fill={isHome ? homeColor : awayColor} stroke="rgba(0,0,0,0.6)" strokeWidth={0.25} />
          </g>
        );
      })}
      {frame && <circle cx={frame.ball[0]} cy={frame.ball[1]} r={0.85} fill="#fff" stroke="#111" strokeWidth={0.25} />}
    </svg>
  );
};
