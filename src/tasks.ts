import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { missionDir, nowIso } from "./state.js";

export type TaskStatus = "ready" | "wip" | "blocked" | "done";

export type TaskOp = "add" | "move" | "block" | "worktree" | "note";

export interface TaskEvent {
  seq: number;
  at: string;
  op: TaskOp;
  taskId: string;
  text?: string;
  to?: TaskStatus;
  worktreePath?: string;
  worktreeRequested?: boolean;
  reason?: string;
}

export interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  worktreeRequested: boolean;
  worktreePath?: string;
  blockedReason?: string;
  history: { at: string; op: TaskOp; details?: string }[];
}

function tasksPath(missionId: string): string {
  return join(missionDir(missionId), "tasks.jsonl");
}

function readEvents(missionId: string): TaskEvent[] {
  const path = tasksPath(missionId);
  if (!existsSync(path)) return [];
  const out: TaskEvent[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as TaskEvent);
    } catch {
      // skip partial trailing line
    }
  }
  return out;
}

function appendEvent(missionId: string, ev: Omit<TaskEvent, "seq" | "at">): TaskEvent {
  const existing = readEvents(missionId);
  const seq = existing.length ? existing[existing.length - 1]!.seq + 1 : 1;
  const full: TaskEvent = { seq, at: nowIso(), ...ev };
  appendFileSync(tasksPath(missionId), JSON.stringify(full) + "\n");
  return full;
}

export function deriveTasks(missionId: string): Task[] {
  const events = readEvents(missionId);
  const byId = new Map<string, Task>();
  for (const e of events) {
    let t = byId.get(e.taskId);
    if (e.op === "add") {
      t = {
        id: e.taskId,
        text: e.text ?? "",
        status: "ready",
        worktreeRequested: e.worktreeRequested ?? false,
        history: [{ at: e.at, op: "add", details: e.text }],
      };
      byId.set(e.taskId, t);
      continue;
    }
    if (!t) continue;
    t.history.push({ at: e.at, op: e.op, details: e.text ?? e.reason ?? e.to ?? e.worktreePath });
    switch (e.op) {
      case "move":
        if (e.to) t.status = e.to;
        if (e.to !== "blocked") delete t.blockedReason;
        break;
      case "block":
        t.status = "blocked";
        t.blockedReason = e.reason;
        break;
      case "worktree":
        if (e.worktreePath) t.worktreePath = e.worktreePath;
        break;
      case "note":
        // history-only
        break;
    }
  }
  return [...byId.values()];
}

function nextTaskId(missionId: string): string {
  const events = readEvents(missionId);
  const adds = events.filter((e) => e.op === "add").length;
  return `t_${String(adds + 1).padStart(2, "0")}`;
}

export interface AddOpts {
  worktree?: boolean;
}

export function addTask(missionId: string, text: string, opts: AddOpts = {}): TaskEvent {
  if (!text) throw new Error("task text is required");
  const taskId = nextTaskId(missionId);
  return appendEvent(missionId, { op: "add", taskId, text, worktreeRequested: opts.worktree ?? false });
}

export function moveTask(missionId: string, taskId: string, to: TaskStatus): TaskEvent {
  if (!isValidStatus(to)) throw new Error(`invalid status: ${to}`);
  ensureTaskExists(missionId, taskId);
  return appendEvent(missionId, { op: "move", taskId, to });
}

export function blockTask(missionId: string, taskId: string, reason: string): TaskEvent {
  ensureTaskExists(missionId, taskId);
  return appendEvent(missionId, { op: "block", taskId, reason });
}

export function setWorktree(missionId: string, taskId: string, path: string): TaskEvent {
  ensureTaskExists(missionId, taskId);
  return appendEvent(missionId, { op: "worktree", taskId, worktreePath: path });
}

function isValidStatus(s: string): s is TaskStatus {
  return s === "ready" || s === "wip" || s === "blocked" || s === "done";
}

function ensureTaskExists(missionId: string, taskId: string): void {
  const found = deriveTasks(missionId).some((t) => t.id === taskId);
  if (!found) throw new Error(`unknown task: ${taskId}`);
}
