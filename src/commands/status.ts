import { readState, readSteers, readApplied } from "../state.js";

export function status(id: string): void {
  const state = readState(id);
  const steers = readSteers(id);
  const applied = new Set(readApplied(id).map((a) => a.seq));
  const pending = steers.filter((s) => !applied.has(s.seq));
  console.log(`mission ${state.id}`);
  console.log(`  status:    ${state.status}`);
  console.log(`  objective: ${state.objective}`);
  console.log(`  step:      ${state.cursor}`);
  console.log(`  budget:    ${state.budget.turnsUsed} / ${state.budget.maxTurns} turns`);
  console.log(`  steers:    ${steers.length} total, ${pending.length} pending`);
  console.log(`  updated:   ${state.updatedAt}`);
}
