import { readState, unappliedSteers } from "../state.js";

export function pending(id: string): void {
  const state = readState(id);
  const steers = unappliedSteers(id);
  console.log(
    JSON.stringify(
      { id, status: state.status, step: state.cursor, budget: state.budget, pending: steers },
      null,
      2,
    ),
  );
}
