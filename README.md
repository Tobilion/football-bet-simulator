### 1. The Time-Warp Match Simulation Engine (`matchEngine.js`)

Unlike simple random simulators, the core simulation runs on an asynchronous event-driven loop mapping a 90-minute football match into a compressed real-time framework.

- **Deterministic Clock Warp:** Utilizes structured interval loops executing every 1000ms, where 1 second of real-world time translates exactly to 1 virtual match minute ($90\\text{ ticks} = 90\\text{ seconds}$).
- **Offensive-to-Defensive Capability Ratios:** Goal distributions and chance generation are calculated dynamically through an algorithmic capability ratio:
  $$\\text{Probability Coefficient} = \\frac{\\text{Attack}_{\\text{Team A}}}{\\text{Attack}_{\\text{Team A}} + \\text{Defense}_{\\text{Team B}}} \\times \\text{Clutch Factor}$$
- **Live In-Game Match Events:** Every tick evaluates granular event probabilities:
  - **Possession & Chance Creation:** Weighted by midfield strength vs. opponent midfield, maintaining an organic $\\sim14\\%$ base chance creation probability.
  - **Shot Resolution & Save Checks:** Evaluates `attackRating` against `defenseRating` alongside randomized variance controls. If a shot beats the defensive line, a separate advanced Goalkeeper Check triggers dynamically using a custom ratio:
    $$\\text{Save Chance} = \\frac{\\text{GK Rating}}{\\text{GK Rating} + \\text{Attack Rating} \\times 0.5}$$
  - **Fouls, Set Pieces, & Cards:** Models random real-time foul chances ($3.5\\% - 5.5\\%$). Includes corner deflections, penalty duels, and disciplinary bookings (yellow/red cards).
  - **Red Card Tactical Debuffs:** When a team receives a red card, its effective midfield and defensive ratings instantly drop by $15\\%$ for the remainder of the match duration, organically shifting match momentum.

### 2. Multi-Slip Accumulator & Sports Betting Ledger (`betting.js`)

Features a fully reactive financial tracking system utilizing robust ES6 object patterns.

- **Dynamic Odds Generation Matrix:** Match winner, exact score, and anytime goalscorer odds are computed dynamically based on team star-rating differentials and statistical mathematical distributions (Poisson distribution logic) rather than hardcoded metrics.
- **Accumulator (Multi-Slip) Compounding:** Supports multi-layered bet slips where total payout odds compound as a product of individual selection legs ($O_{\\text{total}} = O_1 \\times O_2 \\times \\dots \\times O_n$). It strictly enforces production-grade accumulator validation—if a single leg loses, the entire slip status resolves to `LOST`.
- **Idempotent Transaction Guards:** Incorporates structural sequence locking via a finish-match state verification guard. This eliminates potential race conditions or double-settlement bugs between synchronous ticks and async callbacks, guaranteeing transactions apply exactly once.

### 3. Deterministic Seeded Roster Generator (`generator.js`)

- **Dynamic Name Pools:** Dynamically generates a roster of 11 position-specific players (1 GK, 4 DEF, 4 MID, 2 FWD) mapping from an internal database array of over 600+ unique surnames.
- **Star Hierarchy Tier Structures:** Teams are structured according to a strict Premier League/FIFA-tier hierarchy (5-Star Elite, 4-Star Strong, 3-Star Mid-Tier). Player overall ratings (OVR) and specific subsets (e.g., Goalkeeper diving, reflexes, handling) scale directly within strict bounds dictated by their global team star rating.

---

## 📂 Modular Directory Architecture

```micro-repo
football-simulator-desktop/
├── index.html                # Premium presentation SPA layout with data-tab routing
├── style.css                 # Glassmorphism visual theme tailored for high contrast
└── src/
    ├── app.js                # Master UI controller orchestrating view states & hooks
    ├── database.js           # Structural baseline for 32 teams & global rating parameters
    ├── generator.js          # Deterministic procedural player roster constructor
    ├── betting.js            # Isolated transaction ledger, Wallet, & Accumulator manager
    └── matchEngine.js        # The 90-second Time-Warp simulation loop engine
```
