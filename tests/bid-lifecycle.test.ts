/**
 * Tests for the pure bid-lifecycle state machine (src/engine/bidLifecycle.ts).
 * Run with: npx vitest run tests/bid-lifecycle.test.ts
 */
import { describe, it, expect } from "vitest";
import { transition, settleAllBids, type Bid } from "../src/engine/bidLifecycle";

describe("normal win (place -> settle won)", () => {
  it("place debits the full amount, settle-won has no further wallet delta", () => {
    const { bid: placed, walletDelta: d1 } = transition(null, { type: "PLACE", amount: 500 });
    expect(d1).toBe(-500);
    expect(placed?.status).toBe("PLACED");

    const { bid: settled, walletDelta: d2 } = transition(placed, { type: "SETTLE", won: true });
    expect(d2).toBe(0); // money already spent at placement
    expect(settled?.status).toBe("SETTLED");
    expect(settled?.outcome).toBe("WON");

    // Double-settle guard: re-applying SETTLE on an already-settled bid must
    // not re-credit or re-debit anything.
    const { bid: settledAgain, walletDelta: d3 } = transition(settled, { type: "SETTLE", won: true });
    expect(d3).toBe(0);
    expect(settledAgain?.status).toBe("SETTLED");
  });
});

describe("normal loss (outbid -> refund)", () => {
  it("settle-lost refunds the full reserved amount, exactly once", () => {
    const { bid: placed } = transition(null, { type: "PLACE", amount: 300 });
    const { bid: settled, walletDelta } = transition(placed, { type: "SETTLE", won: false });
    expect(walletDelta).toBe(300);
    expect(settled?.status).toBe("SETTLED");
    expect(settled?.outcome).toBe("LOST");

    // Double-settle guard on the loss path too.
    const { walletDelta: d2 } = transition(settled, { type: "SETTLE", won: false });
    expect(d2).toBe(0);
  });
});

describe("withdrawal before settlement", () => {
  it("withdrawing refunds the reserved amount; a later settle is inert", () => {
    const { bid: placed } = transition(null, { type: "PLACE", amount: 150 });
    const { bid: withdrawn, walletDelta } = transition(placed, { type: "WITHDRAW" });
    expect(walletDelta).toBe(150);
    expect(withdrawn?.status).toBe("WITHDRAWN");

    // A settle arriving after withdrawal (e.g. a stale round-advance pass)
    // must not pay out or refund again — the bid already left the auction.
    const { walletDelta: d2 } = transition(withdrawn, { type: "SETTLE", won: true });
    expect(d2).toBe(0);
  });
});

describe("withdrawal after already being marked outbid (must not double-refund)", () => {
  it("marking outbid moves money zero; the withdrawal that follows refunds exactly once", () => {
    const { bid: placed } = transition(null, { type: "PLACE", amount: 400 });
    const { bid: outbid, walletDelta: markDelta } = transition(placed, { type: "MARK_OUTBID" });
    expect(markDelta).toBe(0);
    expect(outbid?.status).toBe("OUTBID");

    const { bid: withdrawn, walletDelta: d1 } = transition(outbid, { type: "WITHDRAW" });
    expect(d1).toBe(400);

    const { bid: withdrawnAgain, walletDelta: d2 } = transition(withdrawn, { type: "WITHDRAW" });
    expect(d2).toBe(0); // second withdrawal attempt refunds nothing
    expect(withdrawnAgain?.status).toBe("WITHDRAWN");
  });
});

describe("updating a live bid nets old-out/new-in", () => {
  it("raising then lowering a live bid nets the correct delta each time", () => {
    const { bid: placed } = transition(null, { type: "PLACE", amount: 200 });
    const { bid: updated, walletDelta } = transition(placed, { type: "UPDATE", amount: 350 });
    expect(walletDelta).toBe(-150); // refund 200, debit 350 -> net -150
    expect(updated?.amount).toBe(350);
    expect(updated?.status).toBe("PLACED");

    // Lowering a bid should net a refund.
    const { walletDelta: d2 } = transition(updated, { type: "UPDATE", amount: 100 });
    expect(d2).toBe(250); // refund 350, debit 100 -> net +250
  });
});

describe("two overlapping bids on different listings settling in the same tick", () => {
  it("each bid resolves to exactly one outcome with no cross-contamination", () => {
    const bids: Bid[] = [
      { listingId: "L1", amount: 500, status: "PLACED" },
      { listingId: "L2", amount: 300, status: "PLACED" },
    ];
    // L1 wins, L2 loses — settled in one batch pass.
    const { bids: nextBids, totalWalletDelta } = settleAllBids(bids, new Set(["L1"]));
    const l1 = nextBids.find((b) => b.listingId === "L1")!;
    const l2 = nextBids.find((b) => b.listingId === "L2")!;
    expect(l1.status).toBe("SETTLED");
    expect(l1.outcome).toBe("WON");
    expect(l2.status).toBe("SETTLED");
    expect(l2.outcome).toBe("LOST");
    expect(totalWalletDelta).toBe(300); // only L2's refund, no double-counting

    // Re-running the same batch on the already-settled bids must be fully inert.
    const { totalWalletDelta: replay } = settleAllBids(nextBids, new Set(["L1"]));
    expect(replay).toBe(0);
  });
});

describe("placing on top of an existing live bid is treated as an update, not a duplicate debit", () => {
  it("re-PLACE on a live bid nets like an UPDATE", () => {
    const { bid: placed } = transition(null, { type: "PLACE", amount: 100 });
    const { bid: placedAgain, walletDelta } = transition(placed, { type: "PLACE", amount: 250 });
    expect(walletDelta).toBe(-150);
    expect(placedAgain?.amount).toBe(250);
  });
});
