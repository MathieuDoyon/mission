import { readState, writeState } from "../state.js";

export function resume(id: string): void {
  const state = readState(id);
  if (state.status !== "paused") {
    console.log(`mission ${id} is ${state.status}; cannot resume`);
    return;
  }
  state.status = "running";
  writeState(state);
  console.log(`mission ${id} resumed`);
}
