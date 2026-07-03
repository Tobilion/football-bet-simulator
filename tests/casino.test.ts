/**
 * Casino RTP guard suite. Run with: npx tsx tests/casino.test.ts
 *
 * These tests mirror the payout constants baked into each casino game component and
 * assert that expected return-to-player (RTP) is < 1.0 — i.e. the house always keeps an
 * edge. They also replay the specific strategies that used to be exploitable (single-round
 * cashouts, always-optimal Hi-Lo guesses, small Keno tickets) to make sure they can no
 * longer be gamed. If someone re-inflates a payout, the matching test fails.
 *
 * Keep the constants below in sync with the components in src/components/casino/.
 */

let pass = 0, fail = 0;
function ok(cond: boolean, name: string) {
  if (cond) { pass++; } else { fail++; console.log("  ❌ FAIL:", name); }
}
// Assert a measured RTP sits in a plausible house-favorable band.
function rtpOk(name: string, rtp: number, hi = 1.0) {
  ok(rtp < hi, `${name} RTP ${(rtp * 100).toFixed(1)}% < ${(hi * 100).toFixed(0)}%`);
}

const comb = (n: number, k: number): number => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
};
const MC = 400_000;
const rnd = (n: number) => Math.floor(Math.random() * n);

console.log("casino RTP guards");

// ---------- Wheel of Wealth (weighted, exact) ----------
{
  const seg = [[0.2,16],[1.5,6],[2,7],[0,17],[3,2],[1,13],[5,1],[0.5,17],[10,1],[0,15],[20,1],[4,1]];
  const tw = seg.reduce((s,[,w]) => s + w, 0);
  const rtp = seg.reduce((s,[m,w]) => s + m * w, 0) / tw;
  rtpOk("Wheel of Wealth", rtp);
}

// ---------- Plinko (binomial 7, exact) ----------
{
  const bins = [15,2,1,0.36,0.36,1,2,15];
  const rtp = bins.reduce((s,m,k) => s + (comb(7,k) / 128) * m, 0);
  rtpOk("Plinko", rtp);
}

// ---------- Over/Under Dice (exact) ----------
{
  const p = (pred: (s:number)=>boolean) => {
    let c = 0; for (let a=1;a<=6;a++) for (let b=1;b<=6;b++) if (pred(a+b)) c++; return c/36;
  };
  rtpOk("Dice OVER 7",  p(s=>s>7) * 2.35);
  rtpOk("Dice UNDER 7", p(s=>s<7) * 2.35);
  rtpOk("Dice EXACT 7", p(s=>s===7) * 5.85);
}

// ---------- Red or Black: single-round cashout exploit (win prob 0.49) ----------
{
  const M = [2.0, 4.0, 8.2, 16.8];
  M.forEach((m,i) => rtpOk(`RedBlack cash after round ${i+1}`, Math.pow(0.49, i+1) * m));
}

// ---------- Spin the Bottle (win prob 0.49, 1.98x) ----------
rtpOk("Spin the Bottle", 0.49 * 1.98);

// ---------- Penalty Shootout: every cashout depth (score prob 0.38) ----------
{
  const M = [2.5, 6, 15, 40]; const score = 0.38;
  M.forEach((m,i) => rtpOk(`Penalty cash after ${i+1} goals`, Math.pow(score, i+1) * m));
}

// ---------- Football Slots (weighted reels, Monte Carlo) ----------
{
  const syms = ["Cup","Boot","Ball","Whistle","Card"];
  const W: Record<string,number> = { Cup:4, Boot:12, Ball:18, Whistle:20, Card:26 };
  const TRIP: Record<string,number> = { Cup:100, Boot:50, Ball:30, Whistle:0, Card:0 };
  const PAIR: Record<string,number> = { Cup:4, Boot:3, Ball:2, Whistle:0, Card:0 };
  const total = syms.reduce((s,x)=>s+W[x],0);
  const spin = () => { let r = Math.random()*total; for (const s of syms){ r-=W[s]; if (r<=0) return s; } return syms[4]; };
  let ret = 0;
  for (let n=0;n<MC;n++){
    const [a,b,c] = [spin(),spin(),spin()];
    if (a===b && b===c && TRIP[a]>0) ret += TRIP[a];
    else { const m = a===b?a:(b===c?b:(a===c?a:null)); if (m && PAIR[m]>0) ret += PAIR[m]; }
  }
  rtpOk("Football Slots", ret / MC);
}

// ---------- Scratch Card (controlled generation → EV = plantProb * weightedMean) ----------
{
  const PRIZE: Record<string,number> = {"💎":50,"👑":30,"⭐":20,"🏆":10,"⚽":5,"🥅":3,"🎯":2,"🎽":1.5,"👟":1};
  const WW: Record<string,number> = {"💎":1,"👑":2,"⭐":4,"🏆":10,"⚽":20,"🥅":40,"🎯":60,"🎽":70,"👟":80};
  const PLANT = 0.335;
  const tw = Object.values(WW).reduce((a,b)=>a+b,0);
  const mean = Object.keys(WW).reduce((s,k)=>s + WW[k]*PRIZE[k],0)/tw;
  rtpOk("Scratch Card", PLANT * mean);
}

// ---------- Hi-Lo: always play the best (highest win-prob) direction ----------
{
  const HOUSE = 0.97;
  const stepMulti = (count:number) => count>0 ? (HOUSE*13)/count : 0;
  let ret = 0;
  for (let n=0;n<MC;n++){
    let pool = 1, rank = rnd(13)+1, alive = true;
    for (let step=0; step<8 && alive; step++){
      const hi = 13-rank, lo = rank-1;
      // exploit attempt: pick the more likely direction every time
      const dir = hi >= lo ? "higher" : "lower";
      const count = dir==="higher"?hi:lo;
      if (count===0) break; // can't bet; walk with current pool
      const next = rnd(13)+1;
      const correct = dir==="higher" ? next>rank : next<rank; // ties lose
      if (!correct){ pool = 0; alive = false; break; }
      pool *= stepMulti(count); rank = next;
    }
    ret += pool;
  }
  rtpOk("Hi-Lo (optimal play)", ret / MC);
}

// ---------- Keno: every pick-count table (exact hypergeometric) ----------
{
  const TABLES: Record<number, Record<number, number>> = {
    1:{1:3}, 2:{2:13}, 3:{2:1,3:45}, 4:{3:6,4:130}, 5:{3:3,4:20,5:400},
    6:{3:2,4:12,5:90,6:1000}, 7:{4:5,5:35,6:220,7:1800},
    8:{4:3,5:20,6:110,7:700,8:3000}, 9:{4:2,5:10,6:55,7:320,8:1500,9:4500},
    10:{5:5,6:28,7:130,8:600,9:2200,10:5000},
  };
  const N = 40, D = 10;
  const P = (p:number,h:number) => comb(p,h)*comb(N-p,D-h)/comb(N,D);
  for (let p=1;p<=10;p++){
    let rtp = 0;
    for (let h=0;h<=p;h++) rtp += P(p,h) * (TABLES[p][h] ?? 0);
    rtpOk(`Keno ${p}-pick`, rtp);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
