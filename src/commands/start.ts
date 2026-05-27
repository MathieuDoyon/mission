import { createMission } from "../state.js";
import { readConfig } from "../config.js";

export interface StartOpts {
  maxTurns?: number;
}

export function start(objective: string, opts: StartOpts = {}): void {
  if (!objective) throw new Error("usage: mission start <objective> [--max-turns N]");
  const cfg = readConfig();
  const maxTurns = opts.maxTurns ?? cfg.budget.maxTurns;
  const state = createMission(objective, { maxTurns });
  console.log(
    JSON.stringify(
      { id: state.id, objective: state.objective, status: state.status, budget: state.budget },
      null,
      2,
    ),
  );
}
