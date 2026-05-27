import { readState, readSteers, readApplied, readLog } from "../state.js";

export function verify(id: string): void {
  const state = readState(id);
  const steers = readSteers(id);
  const applied = readApplied(id);
  const log = readLog(id);

  const issues: string[] = [];

  const seqs = steers.map((s) => s.seq);
  const expected = seqs.map((_, i) => i + 1);
  if (JSON.stringify(seqs) !== JSON.stringify(expected)) {
    issues.push(`steer sequence is not contiguous starting at 1: ${seqs.join(",")}`);
  }

  const appliedSeqs = new Set(applied.map((a) => a.seq));
  const orphanApplied = [...appliedSeqs].filter((s) => !seqs.includes(s));
  if (orphanApplied.length) issues.push(`applied entries reference unknown steers: ${orphanApplied.join(",")}`);

  const pending = seqs.filter((s) => !appliedSeqs.has(s));
  if (state.status !== "running" && state.status !== "paused" && pending.length) {
    issues.push(`mission ${state.status} but ${pending.length} steer(s) still pending: ${pending.join(",")}`);
  }

  console.log(`mission ${id} verify`);
  console.log(`  steers:  ${steers.length}`);
  console.log(`  applied: ${applied.length}`);
  console.log(`  log:     ${log.length} events`);
  if (issues.length === 0) {
    console.log(`  result:  OK`);
  } else {
    console.log(`  result:  ${issues.length} issue(s)`);
    for (const i of issues) console.log(`    - ${i}`);
    process.exitCode = 1;
  }
}
