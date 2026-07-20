import React, { useEffect, useRef, useState } from "react";
import { Team, MatchEvent } from "../types";
import { simulateFixtureFootysim, FootysimMatch } from "../engine/footysimBridge";
import { FootballPitch2D, Frame } from "./FootballPitch2D";
import { TeamCrest } from "./TeamCrest";
import { cleanPlayerName } from "../utils/playerUtils";

interface Props {
  homeTeam: Team;
  awayTeam: Team;
  seed: number;
  knockout?: boolean;
  onClose: () => void;
  onApply: (m: FootysimMatch) => void;
}

const SPEEDS = [1, 2, 4, 8, 20];

export const FootysimMatchViewer: React.FC<Props> = ({ homeTeam, awayTeam, seed, knockout, onClose, onApply }) => {
  const [match, setMatch] = useState<FootysimMatch | null>(null);
  const [phase, setPhase] = useState<"simulating" | "playing" | "done">("simulating");
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(4);
  const [goalFlash, setGoalFlash] = useState<MatchEvent | null>(null);
  const applied = useRef(false);
  const shownGoalKeys = useRef<Set<string>>(new Set());

  // Simulate up front (deferred one tick so "Simulating…" paints).
  useEffect(() => {
    const id = setTimeout(() => {
      setMatch(simulateFixtureFootysim(homeTeam, awayTeam, seed, { knockout }));
      setPhase("playing");
    }, 30);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Frame playback.
  useEffect(() => {
    if (phase !== "playing" || !match || !playing) return;
    const iv = setInterval(() => {
      setIdx((i) => {
        if (i >= match.frames.length - 1) { setPhase("done"); return i; }
        return i + 1;
      });
    }, 340 / speed);
    return () => clearInterval(iv);
  }, [phase, match, playing, speed]);

  const frames = (match?.frames ?? []) as unknown as Frame[];
  const frame = frames[Math.min(idx, frames.length - 1)] ?? null;
  const minute = phase === "done" ? 90 : frame ? Math.min(90, Math.round(Number(frame.t) / 60)) : 0;
  const shownEvents = (match?.events ?? []).filter((e) => e.minute <= minute);
  const hs = shownEvents.filter((e) => e.type === "GOAL" && e.teamId === homeTeam.id).length;
  const as_ = shownEvents.filter((e) => e.type === "GOAL" && e.teamId === awayTeam.id).length;
  const isHalfTime = minute >= 45 && minute <= 47 && phase === "playing";

  // Goal celebration when a new goal is reached.
  useEffect(() => {
    for (const e of shownEvents) {
      if (e.type !== "GOAL") continue;
      const key = `${e.minute}-${e.playerId}`;
      if (!shownGoalKeys.current.has(key)) {
        shownGoalKeys.current.add(key);
        setGoalFlash(e);
        const t = setTimeout(() => setGoalFlash(null), 2200);
        return () => clearTimeout(t);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownEvents.length]);

  // Record the result once the match reaches full time (so it's always saved).
  useEffect(() => {
    if (phase === "done" && match && !applied.current) {
      applied.current = true;
      onApply(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, match]);

  const skipToResult = () => { if (match) { setIdx(match.frames.length - 1); setPhase("done"); setPlaying(false); } };
  const teamName = (id: string) => (id === homeTeam.id ? homeTeam.name : awayTeam.name);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="glass-panel border border-indigo-500/25 rounded-2xl w-full max-w-4xl max-h-[94vh] overflow-y-auto no-scrollbar p-4 space-y-3 shadow-2xl relative">
        {/* top bar */}
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="flex items-center gap-1.5 text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-slate-200 cursor-pointer">
            ← Back to Live
          </button>
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-indigo-300">🛰️ Spatial Engine · 2D Match</span>
          {phase === "done" ? <span className="text-[9px] font-mono text-emerald-400 uppercase">✓ Result saved</span> : <span className="w-16" />}
        </div>

        {/* scoreboard */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            <span className="text-sm font-black text-white truncate">{homeTeam.name}</span>
            <TeamCrest team={homeTeam} size={28} />
          </div>
          <div className="text-center shrink-0">
            <div className="font-mono text-2xl font-black text-white bg-black/40 px-4 py-1 rounded-lg">{hs} - {as_}</div>
            <div className="text-[10px] font-mono text-slate-400 mt-1">
              {phase === "simulating" ? "…" : phase === "done" ? "FULL TIME" : isHalfTime ? "HALF TIME" : `${minute}'`}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TeamCrest team={awayTeam} size={28} />
            <span className="text-sm font-black text-white truncate">{awayTeam.name}</span>
          </div>
        </div>

        {/* pitch */}
        <div className="relative">
          {phase === "simulating" ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm animate-pulse">Running the spatial simulation…</div>
          ) : (
            <FootballPitch2D frame={frame} homeTeamId={homeTeam.id} homeColor={homeTeam.primaryColor} awayColor={awayTeam.primaryColor} homeName={homeTeam.shortName} awayName={awayTeam.shortName} />
          )}
          {goalFlash && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-emerald-500/90 text-slate-950 font-black px-6 py-3 rounded-2xl text-xl shadow-2xl animate-bounce text-center">
                ⚽ GOAL!<div className="text-xs font-bold mt-1">{cleanPlayerName(goalFlash.playerName ?? "")} · {teamName(goalFlash.teamId ?? "")}</div>
              </div>
            </div>
          )}
          {isHalfTime && !goalFlash && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-amber-500/90 text-slate-950 font-black px-4 py-1 rounded-full text-xs">⏸ HALF TIME</div>
          )}
          {phase === "done" && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white/90 text-slate-950 font-black px-4 py-1 rounded-full text-xs">🏁 FULL TIME</div>
          )}
        </div>

        {/* event ticker */}
        <div className="h-16 overflow-y-auto bg-black/30 rounded-lg p-2 text-[11px] font-mono space-y-0.5 no-scrollbar border border-white/5">
          {shownEvents.length === 0 && <div className="text-slate-500">Kick-off…</div>}
          {[...shownEvents].reverse().slice(0, 6).map((e, i) => (
            <div key={i} className={e.type === "GOAL" ? "text-emerald-400 font-bold" : "text-slate-300"}>
              <span className="text-slate-500">{e.minute}'</span>{" "}
              {e.type === "GOAL" ? "⚽" : e.type === "SAVE" ? "🧤" : e.type === "YELLOW_CARD" ? "🟨" : e.type === "RED_CARD" ? "🟥" : "•"}{" "}
              {cleanPlayerName(e.playerName ?? "")} <span className="text-slate-500">· {teamName(e.teamId ?? "")}</span>
            </div>
          ))}
        </div>

        {/* controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            {phase === "playing" && (
              <button onClick={() => setPlaying((p) => !p)} className="text-[11px] font-bold uppercase bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-slate-200 cursor-pointer">
                {playing ? "⏸ Pause" : "▶ Play"}
              </button>
            )}
            {phase !== "simulating" && SPEEDS.map((s) => (
              <button key={s} onClick={() => setSpeed(s)} className={`text-[10px] font-bold px-2 py-1.5 rounded-lg cursor-pointer border ${speed === s ? "bg-indigo-500 text-white border-indigo-500" : "bg-white/5 text-slate-400 border-white/10"}`}>{s}x</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {phase === "playing" && (
              <button onClick={skipToResult} className="text-[11px] font-bold uppercase bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-slate-300 cursor-pointer">⏭ Sim straight through</button>
            )}
            <button onClick={onClose} className="text-[11px] font-black uppercase bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-1.5 rounded-lg cursor-pointer">
              {phase === "done" ? "Done → Live" : "Back to Live"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
