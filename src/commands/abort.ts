import { readState, writeState, clearCurrentIfMatches } from "../state.js";

export function abort(id: string): void {
  const state = readState(id);
  if (state.status === "completed" || state.status === "aborted") {
    console.log(`mission ${id} is already ${state.status}`);
    return;
  }
  state.status = "aborted";
  writeState(state);
  clearCurrentIfMatches(id);
  console.log(`mission ${id} aborted`);
}
