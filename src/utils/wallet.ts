/** Central wallet helpers — the ONLY place balance math should happen. */

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Add funds. Rejects non-finite / negative amounts. */
export function credit(balance: number, amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) return balance;
  return round2(balance + amount);
}

/**
 * Remove funds. Returns null if the debit would overdraw (caller must abort),
 * making stale-state double-clicks safe.
 */
export function debit(balance: number, amount: number): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (amount > balance + 1e-9) return null;
  return round2(balance - amount);
}

/** Functional updater for React setState-style balances: debit or no-op. */
export function debitUpdater(amount: number): (prev: number) => number {
  return (prev) => debit(prev, amount) ?? prev;
}

/** Functional updater: credit. */
export function creditUpdater(amount: number): (prev: number) => number {
  return (prev) => credit(prev, amount);
}
