import React, { useState, useMemo } from "react";
import {
  Trophy, Users, Settings, BarChart3, Shield, Zap, Target,
  ArrowUpDown, Star, TrendingUp, TrendingDown, Award, RefreshCw
} from "lucide-react";
import { Team, Player, Formation, Mentality, PressingStyle, ClubOwnership } from "../types";
import { formatMoney } from "../utils";

interface ClubManagerProps {
  ownedTeamId: string;
  ownedTeamIds?: string[];
  teams: Team[];
  balance: number;
  onUpdateOwnership: (teamId: string, updates: Partial<ClubOwnership>) => void;
  onUpgradeFacility: (teamId: string, type: "training" | "stadium") => void;
  onUpdateBalance: (delta: number) => void;
}

const FORMATIONS: Formation[] = ["4-4-2", "4-3-3", "3-5-2", "4-2-3-1", "5-3-2", "3-4-3"];
const MENTALITIES: Mentality[] = ["Defensive", "Balanced", "Attacking", "Ultra Attack"];
const PRESSING: PressingStyle[] = ["Low Press", "Mid Block", "High Press", "Gegenpressing"];

// Formation player dot positions as [xPct, yPct] on a 0-100 grid, from GK end
const FORMATION_POSITIONS: Record<Formation, [number, number][]> = {
  "4-4-2":    [[5,50],[22,15],[22,38],[22,62],[22,85],[42,15],[42,38],[42,62],[42,85],[60,35],[60,65]],
  "4-3-3":    [[5,50],[22,15],[22,38],[22,62],[22,85],[42,20],[42,50],[42,80],[60,20],[60,50],[60,80]],
  "3-5-2":    [[5,50],[22,20],[22,50],[22,80],[42,10],[42,30],[42,50],[42,70],[42,90],[60,35],[60,65]],
  "4-2-3-1":  [[5,50],[22,15],[22,38],[22,62],[22,85],[38,30],[38,70],[50,15],[50,50],[50,85],[63,50]],
  "5-3-2":    [[5,50],[18,10],[18,30],[18,50],[18,70],[18,90],[40,20],[40,50],[40,80],[60,35],[60,65]],
  "3-4-3":    [[5,50],[20,20],[20,50],[20,80],[40,12],[40,38],[40,62],[40,88],[58,20],[58,50],[58,80]],
};

const MENTALITY_BONUS: Record<Mentality, string> = {
  "Defensive":    "DEF +5 ATT -3",
  "Balanced":     "No stat changes",
  "Attacking":    "ATT +5 DEF -3",
  "Ultra Attack": "ATT +10 DEF -8 MID -2",
};

const PRESS_BONUS: Record<PressingStyle, string> = {
  "Low Press":     "Stamina conserved, less interceptions",
  "Mid Block":     "Balanced pressing game",
  "High Press":    "More interceptions, higher fatigue",
  "Gegenpressing": "Max intensity, big fatigue cost",
};

function positionColor(pos: string) {
  if (pos === "GK") return "#f59e0b";
  if (pos === "DEF") return "#3b82f6";
  if (pos === "MID") return "#10b981";
  return "#ef4444";
}

export const ClubManager: React.FC<ClubManagerProps> = ({
  ownedTeamId,
  ownedTeamIds,
  teams,
  balance,
  onUpdateOwnership,
  onUpgradeFacility,
  onUpdateBalance,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "squad" | "tactics" | "finance">("overview");

  const ownedIds = (ownedTeamIds && ownedTeamIds.length > 0) ? ownedTeamIds : (ownedTeamId ? [ownedTeamId] : []);
  const [selectedClubId, setSelectedClubId] = useState<string>(ownedTeamId);
  const activeId = ownedIds.includes(selectedClubId) ? selectedClubId : (ownedIds[0] ?? ownedTeamId);

  const team = useMemo(() => teams.find(t => t.id === activeId), [teams, activeId]);
  const ownership = team?.ownership;

  const starters = useMemo(() => {
    if (!team || !ownership) return team?.players.slice(0, 11) ?? [];
    const ids = new Set(ownership.starterIds);
    const starters = team.players.filter(p => ids.has(p.id));
    if (starters.length < 11) {
      const rest = team.players.filter(p => !ids.has(p.id));
      return [...starters, ...rest].slice(0, 11);
    }
    return starters;
  }, [team, ownership]);

  const subs = useMemo(() => {
    const startIds = new Set(starters.map(p => p.id));
    return (team?.players ?? []).filter(p => !startIds.has(p.id));
  }, [team, starters]);

  if (!team) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 p-8">
        <div className="text-center space-y-2">
          <Trophy size={40} className="mx-auto opacity-30" />
          <p className="text-sm">Team not found.</p>
        </div>
      </div>
    );
  }

  const formation: Formation = ownership?.formation ?? "4-4-2";
  const mentality: Mentality = ownership?.mentality ?? "Balanced";
  const pressing: PressingStyle = ownership?.pressingStyle ?? "Mid Block";
  const trainingLvl = ownership?.trainingFacilityLevel ?? 1;
  const stadiumLvl = ownership?.stadiumLevel ?? 1;
  const upgradeTrainingCost = trainingLvl * 2000000;
  const upgradeStadiumCost = stadiumLvl * 5000000;

  const won = ownership?.wins ?? 0;
  const drawn = ownership?.draws ?? 0;
  const lost = ownership?.losses ?? 0;
  const played = won + drawn + lost;
  const pts = won * 3 + drawn;
  const gf = ownership?.totalGoalsFor ?? 0;
  const ga = ownership?.totalGoalsAgainst ?? 0;

  const PitchView = () => {
    const positions = FORMATION_POSITIONS[formation];
    return (
      <div className="relative w-full aspect-[16/9] bg-gradient-to-b from-[#0d3518] via-[#155228] to-[#0d3518] rounded-xl overflow-hidden border border-white/10 select-none">
        {/* Grass stripes */}
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute inset-y-0" style={{
            left: `${i * 12.5}%`, width: "12.5%",
            background: i % 2 === 0 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.03)"
          }} />
        ))}
        {/* Field lines */}
        <div className="absolute inset-[3%] border border-white/20 rounded-sm" />
        <div className="absolute inset-y-[3%] left-1/2 w-px bg-white/20" />
        {/* Center circle */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[16%] aspect-square rounded-full border border-white/20" />
        {/* Penalty areas */}
        <div className="absolute top-[25%] left-[3%] w-[15%] h-[50%] border border-white/15" />
        <div className="absolute top-[25%] right-[3%] w-[15%] h-[50%] border border-white/15" />
        {/* Goal boxes */}
        <div className="absolute top-[38%] left-[3%] w-[6%] h-[24%] border border-white/10" />
        <div className="absolute top-[38%] right-[3%] w-[6%] h-[24%] border border-white/10" />

        {/* Player dots */}
        {starters.map((player, idx) => {
          const [xPct, yPct] = positions[idx] ?? [50, 50];
          return (
            <div
              key={player.id}
              className="absolute flex flex-col items-center gap-0.5 transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-10"
              style={{ left: `${xPct}%`, top: `${yPct}%` }}
              title={`${player.name} | ${player.position} | ${player.rating}`}
            >
              <div
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white/60 shadow-lg flex items-center justify-center text-[7px] font-black text-white group-hover:scale-125 transition-transform"
                style={{ backgroundColor: positionColor(player.position) }}
              >
                {idx + 1}
              </div>
              <span className="text-[7px] font-bold text-white drop-shadow-md bg-black/60 px-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {player.name.split(" ").pop()}
              </span>
            </div>
          );
        })}

        {/* Formation label */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[9px] font-bold px-2 py-0.5 rounded-full border border-white/10">
          {formation}
        </div>
      </div>
    );
  };

  const toggleStarter = (player: Player) => {
    const currentIds = new Set(starters.map(p => p.id));
    let newIds: string[];
    if (currentIds.has(player.id)) {
      // Remove from starters — add best sub instead
      newIds = starters.filter(p => p.id !== player.id).map(p => p.id);
    } else if (starters.length < 11) {
      newIds = [...starters.map(p => p.id), player.id];
    } else {
      // Swap: replace worst rated starter (not GK)
      const nonGK = starters.filter(p => p.position !== "GK").sort((a, b) => a.rating - b.rating);
      const toRemove = nonGK[0]?.id;
      newIds = starters.filter(p => p.id !== toRemove).map(p => p.id).concat(player.id);
    }
    onUpdateOwnership(team.id, { starterIds: newIds });
  };

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: <BarChart3 size={13} /> },
    { id: "squad" as const, label: "Squad", icon: <Users size={13} /> },
    { id: "tactics" as const, label: "Tactics", icon: <Settings size={13} /> },
    { id: "finance" as const, label: "Finance", icon: <TrendingUp size={13} /> },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 max-w-6xl mx-auto animate-fade-in">
      {/* Multi-club switcher */}
      {ownedIds.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {ownedIds.map((id) => {
            const t = teams.find((tt) => tt.id === id);
            if (!t) return null;
            const isActive = id === activeId;
            const trophyCount = t.ownership?.trophies?.length ?? 0;
            return (
              <button key={id} onClick={() => setSelectedClubId(id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${isActive ? "border-emerald-400 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-slate-400 hover:text-white hover:bg-white/5"}`}>
                <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: t.primaryColor }} />
                {t.shortName}
                {trophyCount > 0 && <span className="text-amber-400">🏆{trophyCount}</span>}
              </button>
            );
          })}
        </div>
      )}
      {/* Header */}
      <div className="glass-panel p-4 flex items-center gap-4 border border-white/10 rounded-2xl">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg border-2 border-white/20 shadow-lg"
          style={{ backgroundColor: team.primaryColor }}
        >
          {team.shortName.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-black text-white tracking-tight truncate">{team.name}</h2>
          <p className="text-xs text-slate-400 font-mono">
            Manager Dynasty · {formation} · {mentality}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-center">
          <div><p className="text-xs text-slate-500 font-mono">PLAYED</p><p className="text-lg font-black text-white">{played}</p></div>
          <div><p className="text-xs text-slate-500 font-mono">POINTS</p><p className="text-lg font-black text-emerald-400">{pts}</p></div>
          <div><p className="text-xs text-slate-500 font-mono">GD</p><p className={`text-lg font-black ${gf - ga >= 0 ? "text-emerald-400" : "text-red-400"}`}>{gf - ga > 0 ? "+" : ""}{gf - ga}</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/5 pb-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
              activeTab === tab.id
                ? "border-emerald-400 text-emerald-400 bg-emerald-400/5"
                : "border-transparent text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <PitchView />
          {(ownership?.trophies?.length ?? 0) > 0 ? (
            <div className="glass-panel p-4 border border-amber-500/20 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={16} className="text-amber-400" />
                <h3 className="text-sm font-black text-amber-300 uppercase tracking-wide">Trophy Cabinet — {team.shortName}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {(ownership?.trophies ?? []).map((tr, i) => (
                  <div key={i} className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5">
                    <span className="text-lg">🏆</span>
                    <div>
                      <p className="text-[11px] font-bold text-amber-200">{tr.competition}</p>
                      <p className="text-[9px] text-slate-400 font-mono">{tr.wonAt}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-panel p-3 border border-white/5 rounded-2xl text-center text-[11px] text-slate-500 font-mono">
              🏆 No trophies yet — win your league or cup to fill {team.shortName}'s cabinet.
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Wins", value: won, color: "text-emerald-400" },
              { label: "Draws", value: drawn, color: "text-yellow-400" },
              { label: "Losses", value: lost, color: "text-red-400" },
              { label: "Points", value: pts, color: "text-purple-400" },
            ].map(s => (
              <div key={s.label} className="glass-panel rounded-xl p-3 text-center border border-white/5">
                <p className="text-[10px] text-slate-500 font-mono uppercase">{s.label}</p>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Record */}
          <div className="glass-panel rounded-xl p-4 border border-white/5 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">Season Record</h3>
            <div className="flex items-center gap-2 h-3 rounded-full overflow-hidden bg-white/5">
              <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${played ? (won / played) * 100 : 0}%` }} />
              <div className="h-full bg-yellow-400" style={{ width: `${played ? (drawn / played) * 100 : 0}%` }} />
              <div className="h-full bg-red-500 rounded-r-full flex-1" />
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-emerald-400">{won}W</span>
              <span className="text-yellow-400">{drawn}D</span>
              <span className="text-red-400">{lost}L</span>
            </div>
            <div className="text-xs text-slate-400 font-mono">{gf} Goals For · {ga} Goals Against · GD {gf - ga > 0 ? "+" : ""}{gf - ga}</div>
          </div>

          {/* Facilities */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="glass-panel rounded-xl p-4 border border-white/5 space-y-3">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-yellow-400" />
                <span className="text-xs font-bold text-slate-300">Training Facility</span>
                <span className="ml-auto text-xs font-black text-yellow-400">Lvl {trainingLvl}</span>
              </div>
              <div className="flex gap-1">{[...Array(5)].map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i < trainingLvl ? "bg-yellow-400" : "bg-white/10"}`} />
              ))}</div>
              <p className="text-[10px] text-slate-500">+{trainingLvl * 2}% player rating growth per match</p>
              <button
                onClick={() => onUpgradeFacility(team.id, "training")}
                disabled={balance < upgradeTrainingCost}
                className="w-full py-1.5 text-xs font-bold rounded-lg bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/25 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-all"
              >
                Upgrade → {formatMoney(upgradeTrainingCost)}
              </button>
            </div>

            <div className="glass-panel rounded-xl p-4 border border-white/5 space-y-3">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-sky-400" />
                <span className="text-xs font-bold text-slate-300">Stadium</span>
                <span className="ml-auto text-xs font-black text-sky-400">Lvl {stadiumLvl}</span>
              </div>
              <div className="flex gap-1">{[...Array(5)].map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i < stadiumLvl ? "bg-sky-400" : "bg-white/10"}`} />
              ))}</div>
              <p className="text-[10px] text-slate-500">+{formatMoney(stadiumLvl * 50000)} passive income per match</p>
              <button
                onClick={() => onUpgradeFacility(team.id, "stadium")}
                disabled={balance < upgradeStadiumCost}
                className="w-full py-1.5 text-xs font-bold rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30 hover:bg-sky-500/25 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-all"
              >
                Upgrade → {formatMoney(upgradeStadiumCost)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Squad tab */}
      {activeTab === "squad" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono bg-white/3 p-3 rounded-xl border border-white/5">
            <ArrowUpDown size={12} />
            Tap a player to toggle them in/out of the starting XI. You need exactly 11 starters.
          </div>

          {/* Starters */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono">Starting XI ({starters.length}/11)</p>
            <div className="space-y-1">
              {starters.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => toggleStarter(p)}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/10 transition-all"
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-slate-900 shrink-0"
                    style={{ backgroundColor: positionColor(p.position) }}>
                    {idx + 1}
                  </div>
                  <span className="text-xs font-bold text-white flex-1 truncate">{p.name}</span>
                  <span className="text-[9px] font-mono text-slate-400 px-1.5 py-0.5 bg-white/5 rounded">{p.position}</span>
                  <span className="text-xs font-black text-emerald-400 w-8 text-right">{p.rating}</span>
                  {p.injured && <span className="text-[8px] text-red-400 font-bold">INJ</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Subs */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Bench ({subs.length})</p>
            <div className="space-y-1">
              {subs.map((p) => (
                <div
                  key={p.id}
                  onClick={() => toggleStarter(p)}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3 border border-white/5 cursor-pointer hover:bg-white/5 transition-all opacity-60 hover:opacity-100"
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-slate-900 bg-white/20 shrink-0" />
                  <span className="text-xs font-bold text-slate-300 flex-1 truncate">{p.name}</span>
                  <span className="text-[9px] font-mono text-slate-500 px-1.5 py-0.5 bg-white/5 rounded">{p.position}</span>
                  <span className="text-xs font-black text-slate-400 w-8 text-right">{p.rating}</span>
                  {p.injured && <span className="text-[8px] text-red-400 font-bold">INJ</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tactics tab */}
      {activeTab === "tactics" && (
        <div className="space-y-5">
          <PitchView />

          {/* Formation */}
          <div className="glass-panel rounded-xl p-4 border border-white/5 space-y-3">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono flex items-center gap-2">
              <Target size={12} /> Formation
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {FORMATIONS.map(f => (
                <button
                  key={f}
                  onClick={() => onUpdateOwnership(team.id, { formation: f })}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    formation === f
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                      : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Mentality */}
          <div className="glass-panel rounded-xl p-4 border border-white/5 space-y-3">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono flex items-center gap-2">
              <Zap size={12} /> Team Mentality
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MENTALITIES.map(m => (
                <button
                  key={m}
                  onClick={() => onUpdateOwnership(team.id, { mentality: m })}
                  className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all cursor-pointer text-center ${
                    mentality === m
                      ? "bg-purple-500/20 text-purple-400 border-purple-500/50"
                      : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 font-mono">{MENTALITY_BONUS[mentality]}</p>
          </div>

          {/* Pressing */}
          <div className="glass-panel rounded-xl p-4 border border-white/5 space-y-3">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono flex items-center gap-2">
              <Shield size={12} /> Pressing Style
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESSING.map(ps => (
                <button
                  key={ps}
                  onClick={() => onUpdateOwnership(team.id, { pressingStyle: ps })}
                  className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all cursor-pointer text-center ${
                    pressing === ps
                      ? "bg-sky-500/20 text-sky-400 border-sky-500/50"
                      : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {ps}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 font-mono">{PRESS_BONUS[pressing]}</p>
          </div>
        </div>
      )}

      {/* Finance tab */}
      {activeTab === "finance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Purchase Price", value: formatMoney(ownership?.purchasePrice ?? 0), icon: <Trophy size={14} />, color: "text-amber-400" },
              { label: "Total Invested", value: formatMoney(ownership?.totalInvested ?? 0), icon: <TrendingUp size={14} />, color: "text-red-400" },
              { label: "Passive Income/Match", value: formatMoney(ownership?.passiveIncomePerMatch ?? 0), icon: <Star size={14} />, color: "text-emerald-400" },
            ].map(s => (
              <div key={s.label} className="glass-panel rounded-xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className={s.color}>{s.icon}</span>
                  <p className="text-[10px] text-slate-500 font-mono uppercase">{s.label}</p>
                </div>
                <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="glass-panel rounded-xl p-4 border border-white/5 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase font-mono tracking-widest">Revenue Streams</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Match Day Revenue (per match)</span>
                <span className="text-emerald-400 font-bold">{formatMoney((stadiumLvl * 50000))}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Training Bonus (player growth)</span>
                <span className="text-yellow-400 font-bold">+{trainingLvl * 2}% ratings</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Win Bonus</span>
                <span className="text-emerald-400 font-bold">{formatMoney(25000 * (team.rating ?? 1))}/win</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
