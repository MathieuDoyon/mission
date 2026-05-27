import { appendSteer, readState } from "../state.js";

export function steer(id: string, text: string): void {
  if (!text) throw new Error("usage: mission steer <id> <text>");
  const state = readState(id);
  const event = appendSteer(id, text);
  console.log(`steer #${event.seq} queued for mission ${id}`);
  if (state.status === "running") {
    console.log(`will apply after the current step completes`);
  } else {
    console.log(`mission is ${state.status}; steer will apply on resume`);
  }
}
