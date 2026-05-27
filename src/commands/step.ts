import {
  readState,
  writeState,
  unappliedSteers,
  markApplied,
  appendLog,
  nowIso,
  clearCurrentIfMatches,
} from "../state.js";

export interface StepOpts {
  summary: string;
  done?: boolean;
}

export function step(id: string, opts: StepOpts): void {
  const state = readState(id);
  if (state.status !== "running") {
    console.error(`mission ${id} is ${state.status}; cannot record step`);
    process.exitCode = 1;
    return;
  }

  const pending = unappliedSteers(id);
  if (pending.length) {
    markApplied(id, pending.map((s) => s.seq), state.cursor);
    appendLog(id, { at: nowIso(), step: state.cursor, kind: "steer", data: pending });
  }

  appendLog(id, { at: nowIso(), step: state.cursor, kind: "turn", data: { summary: opts.summary } });
  state.cursor += 1;
  state.budget.turnsUsed += 1;

  if (opts.done) {
    state.status = "completed";
  } else if (state.budget.turnsUsed >= state.budget.maxTurns) {
    state.status = "budget_exhausted";
    appendLog(id, {
      at: nowIso(),
      step: state.cursor,
      kind: "status",
      data: { reason: "budget_exhausted", turnsUsed: state.budget.turnsUsed, maxTurns: state.budget.maxTurns },
    });
  }

  writeState(state);
  if (state.status !== "running") clearCurrentIfMatches(id);

  console.log(
    JSON.stringify(
      {
        id,
        status: state.status,
        step: state.cursor,
        budget: state.budget,
        appliedSteers: pending.map((s) => s.seq),
      },
      null,
      2,
    ),
  );
}
