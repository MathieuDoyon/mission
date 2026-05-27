import { readState, writeState } from "../state.js";

export function pause(id: string): void {
  const state = readState(id);
  if (state.status !== "running") {
    console.log(`mission ${id} is ${state.status}; nothing to pause`);
    return;
  }
  state.status = "paused";
  writeState(state);
  console.log(`mission ${id} paused (takes effect after current step)`);
}
