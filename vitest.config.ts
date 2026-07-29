import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Several suites run heavy Monte Carlo loops (200k-1M iterations) or
    // simulate hundreds of full matches; server-settlement.test.ts's
    // beforeAll also boots a real Express app via dynamic import. Give both
    // more room than the 5s/10s defaults.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Money-math coverage only: the pure logic that decides payouts, odds,
      // cash-out value, and the bid lifecycle — exactly the modules
      // tests/logic.test.ts, tests/bid-lifecycle.test.ts, etc. exercise.
      // Deliberately NOT "src/utils/**" wholesale: that folder also holds
      // unrelated helpers (careerUtils, motmUtils, playerRatingUtils,
      // highlightsUtils, storage, debounce, formUtils) with no tests today —
      // including them would dilute this floor rather than measure it.
      // UI/hooks/components are out of scope for this floor — see
      // CU_BET_HARDENING_PROMPT.md Phase 3.
      include: [
        "src/utils/betSettlement.ts",
        "src/utils/betBuilderUtils.ts",
        "src/utils/cashOutUtils.ts",
        "src/utils/oddsUtils.ts",
        "src/utils/wallet.ts",
        "src/utils/betSlipUtils.ts",
        "src/utils/statsUtils.ts",
        "src/utils/liveOdds.ts",
        "src/utils/playerUtils.ts",
        "src/engine/bidLifecycle.ts",
      ],
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 60,
        branches: 50,
      },
    },
  },
});
