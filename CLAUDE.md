# CLAUDE.md

CU Bet — football tournament betting simulator: a single-page React app with match simulation, betting markets, a casino suite, club management, and a transfer market. All state is client-side (localStorage via `src/utils/storage.ts`); no backend.

## Stack

- React 19 + TypeScript 5.8, Vite 6, Tailwind CSS 4 (via `@tailwindcss/vite`)
- Redux Toolkit is in dependencies but app state largely lives in `App.tsx` + custom hooks
- recharts (charts), motion (animations), lucide-react (icons)
- Tests: plain TypeScript run with `tsx` (no test framework)

## Commands

- `npm run dev` — dev server on port 3000 (host 0.0.0.0)
- `npm run build` — Vite build to `dist/`
- `npm run lint` — `tsc --noEmit` (type-check only, no ESLint)
- `npm test` — runs `tests/logic.test.ts`, `tests/casino.test.ts`, `tests/site.test.ts` via tsx

## Structure

- `src/App.tsx` — root component; owns most top-level state and view routing
- `src/components/` — UI; subfolders: `casino/` (14 casino games + `shared.tsx`), `modals/`, `charts/`, `ui/` (Toast, Skeleton, InfoButton)
- `src/engine/` — simulation logic: `matchEngine`, `transferEngine`, `weatherEngine`, `foulCardEngine`
- `src/hooks/` — `useBetting`, `useSimulation`, `useRoundAdvance`, `useProfile`, `useChallenges`, `useTransferMarket`, `useToast`
- `src/utils/` — bet settlement (`betSettlement`, `settlementEngine`, `cashOutUtils`), odds (`oddsUtils`), wallet, storage, player/career/form/MOTM/highlights utils
- `src/data/` — static data: teams, tournament, challenges, tipsters, luxuryItems
- `src/types.ts` — shared types
- `tests/` — test scripts
- `.kiro/specs/` — feature specs; `MASTER_UPGRADE_PROMPT.md` — large upgrade spec doc

## Gotchas

- Vite alias `@` points to the **project root**, not `src/`.
- Duplicate `InfoButton` exists at `src/components/InfoButton.tsx` and `src/components/ui/InfoButton.tsx` — check which one a file imports.
- No ESLint/Prettier config; "lint" means type-checking. No test runner — tests are scripts that throw on failure.
- Money display uses comma formatting; default sim speed is 90s; odds suspension logic was fixed in commit e02cbb8 — be careful when touching those areas.
- **File truncation on large files (recurring, serious):** past sessions repeatedly saw big files (`App.tsx` 1400+ lines, `FixturesOdds`, `LiveMatches`) silently truncated mid-file after edits — writes report success but the tail is cut. For any file over ~400 lines: avoid partial in-place edits; prefer Python string-replacement scripts on the file, and run `npm run lint` (`tsc --noEmit`) **after every single edit**, not at the end of a batch. If truncation is found, recover the file from git before patching. Long-term fix is keeping files small — continue splitting App.tsx.

## Maintenance

Keep this file concise. Replace stale info rather than appending.
