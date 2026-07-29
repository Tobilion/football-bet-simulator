import { app } from "./index";

// Hosts like Render/Railway inject PORT and expect the process to bind it;
// CU_BET_SERVER_PORT stays as the local-dev override (see README/CLAUDE.md).
const PORT = Number(process.env.PORT || process.env.CU_BET_SERVER_PORT || 4400);

// Bind 0.0.0.0, not just localhost — required for the process to be reachable
// at all when running inside a hosted container.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Matchday Exchange wallet/settlement server listening on port ${PORT}`);
});
