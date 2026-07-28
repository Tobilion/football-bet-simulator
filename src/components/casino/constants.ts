// Shared payout constants for all casino games.
// Imported by game components AND the RTP test so changes are cross-checked.

// ── Plinko ──
export const PLINKO_BINS = [
  { multi: 15.0, label: "15x", color: "bg-red-500/20 border-red-500/40 text-red-400" },
  { multi: 2.0, label: "2x", color: "bg-amber-500/20 border-amber-500/40 text-amber-400" },
  { multi: 1.0, label: "1x", color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" },
  { multi: 0.36, label: "0.36x", color: "bg-slate-700/30 border-white/5 text-slate-400" },
  { multi: 0.36, label: "0.36x", color: "bg-slate-700/30 border-white/5 text-slate-400" },
  { multi: 1.0, label: "1x", color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" },
  { multi: 2.0, label: "2x", color: "bg-amber-500/20 border-amber-500/40 text-amber-400" },
  { multi: 15.0, label: "15x", color: "bg-red-500/20 border-red-500/40 text-red-400" },
];
export const PLINKO_MULTIS = PLINKO_BINS.map((b) => b.multi);

// ── Over/Under Dice ──
export const DICE_MULTI_OVER_UNDER = 2.35;
export const DICE_MULTI_EXACT = 5.85;

// ── Wheel of Wealth ──
export const WHEEL_SEGMENTS: { label: string; multiplier: number; color: string; weight: number }[] = [
  { label: "0.2x", multiplier: 0.2, color: "#ef4444", weight: 16 },
  { label: "1.5x", multiplier: 1.5, color: "#f59e0b", weight: 6 },
  { label: "2x", multiplier: 2, color: "#10b981", weight: 7 },
  { label: "0x", multiplier: 0, color: "#1e293b", weight: 17 },
  { label: "3x", multiplier: 3, color: "#8b5cf6", weight: 2 },
  { label: "1x", multiplier: 1, color: "#64748b", weight: 13 },
  { label: "5x", multiplier: 5, color: "#f97316", weight: 1 },
  { label: "0.5x", multiplier: 0.5, color: "#0ea5e9", weight: 17 },
  { label: "10x", multiplier: 10, color: "#ec4899", weight: 1 },
  { label: "0x", multiplier: 0, color: "#1e293b", weight: 15 },
  { label: "20x", multiplier: 20, color: "#fcd34d", weight: 1 },
  { label: "4x", multiplier: 4, color: "#34d399", weight: 1 },
];

// ── Spin the Bottle ──
export const SPIN_MULTIPLIER = 1.98;
export const SPIN_FREEZE_PROB = 0.02;
export const SPIN_WIN_PROB = 0.49;

// ── Penalty Shootout ──
export const PENALTY_SHOT_MULTIS = [2.5, 6.0, 15.0, 40.0];
export const PENALTY_SAVE_PROB = 0.62;

// ── Red or Black ──
export const REDBLACK_ROUND_MULTIS = [2.0, 4.0, 8.2, 16.8];
export const REDBLACK_JOKER_PROB = 0.02;

// ── Football Slots ──
export const SLOTS_REEL_WEIGHTS: Record<string, number> = { Cup: 4, Boot: 12, Ball: 18, Whistle: 20, Card: 26 };
export const SLOTS_TRIPLE_PAY: Record<string, number> = { Cup: 100, Boot: 50, Ball: 30, Whistle: 0, Card: 0 };
export const SLOTS_PAIR_PAY: Record<string, number> = { Cup: 4, Boot: 3, Ball: 2, Whistle: 0, Card: 0 };
export const SLOTS_REEL_SYMS = ["Cup", "Boot", "Ball", "Whistle", "Card"];

// ── Scratch Card ──
export const SCRATCH_PRIZE_TABLE: Record<string, number> = { "💎": 50, "👑": 30, "⭐": 20, "🏆": 10, "⚽": 5, "🥅": 3, "🎯": 2, "🎽": 1.5, "👟": 1, "🥋": 0 };
export const SCRATCH_PLANT_PROB = 0.335;
export const SCRATCH_WIN_WEIGHTS: Record<string, number> = { "💎": 1, "👑": 2, "⭐": 4, "🏆": 10, "⚽": 20, "🥅": 40, "🎯": 60, "🎽": 70, "👟": 80 };

// ── Hi-Lo ──
export const HILO_HOUSE_EDGE = 0.97;
export const HILO_MAX_STEPS = 8;

// ── Keno ──
export const KENO_TOTAL = 40;
export const KENO_DRAW = 10;
export const KENO_PAYOUTS: Record<number, Record<number, number>> = {
  1: { 1: 3 },
  2: { 2: 13 },
  3: { 2: 1, 3: 45 },
  4: { 3: 6, 4: 130 },
  5: { 3: 3, 4: 20, 5: 400 },
  6: { 3: 2, 4: 12, 5: 90, 6: 1000 },
  7: { 4: 5, 5: 35, 6: 220, 7: 1800 },
  8: { 4: 3, 5: 20, 6: 110, 7: 700, 8: 3000 },
  9: { 4: 2, 5: 10, 6: 55, 7: 320, 8: 1500, 9: 4500 },
  10: { 5: 5, 6: 28, 7: 130, 8: 600, 9: 2200, 10: 5000 },
};

// ── Tower Climber ──
export const TOWER_FLOORS = 10;
export const TOWER_COLS = 3;
export const TOWER_FLOOR_MULTIPLIERS = [1.4, 2.0, 2.9, 4.1, 6.0, 8.8, 13.0, 19.5, 30.0, 50.0];