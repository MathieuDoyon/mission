import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { MissionState, SteerEvent, AppliedEvent, LogEvent } from "./types.js";
import { DEFAULT_MAX_TURNS } from "./types.js";

const ROOT = ".mission";

export function missionDir(id: string): string {
  return join(ROOT, id);
}

const CURRENT = join(ROOT, "current");

export function setCurrent(id: string): void {
  mkdirSync(ROOT, { recursive: true });
  writeFileSync(CURRENT, id);
}

export function getCurrent(): string | null {
  if (!existsSync(CURRENT)) return null;
  const id = readFileSync(CURRENT, "utf8").trim();
  return id || null;
}

export function clearCurrentIfMatches(id: string): void {
  if (getCurrent() === id) {
    try {
      writeFileSync(CURRENT, "");
    } catch {
      // best-effort
    }
  }
}

export function newMissionId(): string {
  return `m_${randomBytes(8).toString("hex")}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export interface CreateMissionOpts {
  maxTurns?: number;
}

export function createMission(objective: string, opts: CreateMissionOpts = {}): MissionState {
  const id = newMissionId();
  const dir = missionDir(id);
  mkdirSync(dir, { recursive: true });
  const state: MissionState = {
    id,
    objective,
    status: "running",
    cursor: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    budget: {
      maxTurns: opts.maxTurns ?? DEFAULT_MAX_TURNS,
      turnsUsed: 0,
    },
  };
  writeState(state);
  setCurrent(id);
  // Touch append-only logs so callers can read them unconditionally.
  appendFileSync(join(dir, "steers.jsonl"), "");
  appendFileSync(join(dir, "applied.jsonl"), "");
  appendFileSync(join(dir, "log.jsonl"), "");
  return state;
}

export function readState(id: string): MissionState {
  const path = join(missionDir(id), "state.json");
  if (!existsSync(path)) throw new Error(`mission not found: ${id}`);
  return JSON.parse(readFileSync(path, "utf8")) as MissionState;
}

export function writeState(state: MissionState): void {
  const dir = missionDir(state.id);
  const tmp = join(dir, "state.json.tmp");
  const final = join(dir, "state.json");
  state.updatedAt = nowIso();
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, final);
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf8");
  const out: T[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      // Ignore partial/corrupt trailing line — append-only resilience.
    }
  }
  return out;
}

export function readSteers(id: string): SteerEvent[] {
  return readJsonl<SteerEvent>(join(missionDir(id), "steers.jsonl"));
}

export function readApplied(id: string): AppliedEvent[] {
  return readJsonl<AppliedEvent>(join(missionDir(id), "applied.jsonl"));
}

export function appendSteer(id: string, text: string): SteerEvent {
  const existing = readSteers(id);
  const seq = existing.length ? existing[existing.length - 1]!.seq + 1 : 1;
  const event: SteerEvent = { seq, at: nowIso(), text };
  appendFileSync(join(missionDir(id), "steers.jsonl"), JSON.stringify(event) + "\n");
  return event;
}

export function markApplied(id: string, seqs: number[], step: number): void {
  const at = nowIso();
  const lines = seqs.map((seq) => JSON.stringify({ seq, appliedAtStep: step, at } satisfies AppliedEvent)).join("\n");
  if (lines) appendFileSync(join(missionDir(id), "applied.jsonl"), lines + "\n");
}

export function unappliedSteers(id: string): SteerEvent[] {
  const applied = new Set(readApplied(id).map((a) => a.seq));
  return readSteers(id).filter((s) => !applied.has(s.seq));
}

export function appendLog(id: string, event: LogEvent): void {
  appendFileSync(join(missionDir(id), "log.jsonl"), JSON.stringify(event) + "\n");
}

export function readLog(id: string): LogEvent[] {
  return readJsonl<LogEvent>(join(missionDir(id), "log.jsonl"));
}
