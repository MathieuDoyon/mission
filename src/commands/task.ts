import { addTask, moveTask, blockTask, setWorktree, deriveTasks, type Task, type TaskStatus } from "../tasks.js";

export function taskAdd(missionId: string, text: string, worktree: boolean): void {
  const ev = addTask(missionId, text, { worktree });
  console.log(JSON.stringify({ ok: true, taskId: ev.taskId, status: "ready", worktreeRequested: worktree }, null, 2));
}

export function taskList(missionId: string): void {
  const tasks = deriveTasks(missionId);
  if (tasks.length === 0) {
    console.log(`(no tasks for ${missionId})`);
    return;
  }
  const groups: Record<TaskStatus, Task[]> = { wip: [], ready: [], blocked: [], done: [] };
  for (const t of tasks) groups[t.status].push(t);
  for (const status of ["wip", "ready", "blocked", "done"] as TaskStatus[]) {
    const list = groups[status];
    if (list.length === 0) continue;
    console.log(`[${status}] ${list.length}`);
    for (const t of list) {
      const wt = t.worktreePath ? ` worktree=${t.worktreePath}` : t.worktreeRequested ? " (worktree requested)" : "";
      const reason = t.blockedReason ? ` — ${t.blockedReason}` : "";
      console.log(`  ${t.id}  ${t.text}${wt}${reason}`);
    }
  }
}

export function taskMove(missionId: string, taskId: string, to: string): void {
  const ev = moveTask(missionId, taskId, to as TaskStatus);
  console.log(JSON.stringify({ ok: true, taskId, status: ev.to }, null, 2));
}

export function taskBlock(missionId: string, taskId: string, reason: string): void {
  if (!reason) throw new Error("usage: mission task block <task-id> <reason>");
  const ev = blockTask(missionId, taskId, reason);
  console.log(JSON.stringify({ ok: true, taskId, status: "blocked", reason: ev.reason }, null, 2));
}

export function taskWorktree(missionId: string, taskId: string, path: string): void {
  if (!path) throw new Error("usage: mission task worktree <task-id> <path>");
  setWorktree(missionId, taskId, path);
  console.log(JSON.stringify({ ok: true, taskId, worktreePath: path }, null, 2));
}
