---
name: mission-kanban
description: Sub-skill of the `mission` orchestrator for multi-part missions. Decomposes the parent objective into kanban tasks, picks the next one to advance each iteration, decides per-task isolation (worktree or shared tree), and defers cross-task reconciliation to mission-review at completion.
mission-routing:
  invoke-when:
    - the parent objective is clearly multi-part (multiple independent slices, separate concerns)
    - mission-plan returned a plan with 3+ independent steps that can be reordered
    - the user explicitly asked for kanban / parallel slice tracking
  typical-next: [plan, tdd, debug, spike, review]
  cost-tier: primary   # orchestration decisions stay on the primary model
---

# mission-kanban — Sub-mission: orchestrate child tasks toward the parent objective

You are a sub-skill of the **mission orchestrator**, invoked when the parent mission's work splits into multiple independent (or partially independent) slices. You don't do the slice's work yourself — you decide which slice is next, decide its isolation strategy, and delegate.

## Sub-mission contract

Per invocation, do exactly one of the following:

1. **Decompose** — if the task list is empty or the parent objective has just been clarified, break it into 3–8 kanban tasks via `mission task add`.
2. **Pick next** — read the current task list (`mission task list`), choose the highest-value task to advance now, decide its isolation strategy, and route the parent loop's next sub-skill (`plan`/`spike`/`tdd`/`debug`) toward that task.
3. **Reconcile** — when all kanban tasks are `done` or `blocked`, signal the parent loop to route to `mission-review` for the merge-and-judge step.

## Decomposition rules

- Each task is a one-sentence outcome (e.g. "add JWT refresh endpoint", not "edit auth.ts").
- Tasks are **independent enough** that they could in principle be worked in different worktrees without touching the same files. If you cannot split that way, you don't need kanban — return `status: needs_more_context` and recommend `plan`.
- Mark tasks with `--worktree` when isolation will actually help (different subsystems, conflicting test setup, dependency churn). Skip `--worktree` for surgical edits in the same module.

```
mission task add "implement JWT refresh endpoint" --worktree
mission task add "add regression tests for auth flows"
mission task add "update API docs for /token endpoint"
```

## Picking the next task

Score candidates by:
1. **Unblocks others** — does completing this clear a dependency for ready/wip tasks? Prefer.
2. **Closes the riskiest unknown** — prefer tasks where the work informs subsequent choices.
3. **Currently `wip`** — finishing in-flight work beats starting new.
4. **Smallest verification surface** — easier-to-verify tasks land sooner.

Avoid round-robin for the sake of it — kanban here is "sequential simulated lanes," not "fair scheduling." Pick what moves the parent objective fastest.

When you pick a task:
```
mission task move <task-id> wip
mission task worktree <task-id> <path>     # if you also created a worktree
```

Then the parent loop's next sub-skill (`tdd`, `debug`, `plan`, `spike`) operates **only within the scope of this task** for the next step.

## Isolation decisions

For each task moved to `wip`:

- **Shared tree (default)** — task edits live in the main working copy. Use when changes are surgical or unlikely to collide with other tasks.
- **Worktree** — create via the `worktrunk` skill (or `git worktree add`), record the path with `mission task worktree <task-id> <path>`. Use when:
  - Two `wip` tasks would touch overlapping files.
  - The task needs a different branch / configuration / dependency version.
  - Long-running task you want to keep separable from quick fixes.

Default to shared tree until you observe a real collision; switch to worktree on the next task in that area.

## Cross-task conflict — deferred to mission-review

When all tasks are `done` (or terminally `blocked`), invoke `mission-review` and let it merge worktrees one by one against the main tree. Do **not** try to merge inside kanban — review is the judge, and merge conflicts are part of "is this really done."

## Output format

````
```mission-report
skill: mission-kanban
status: complete            # complete | blocked | needs_more_context
mode: decompose | pick | reconcile
summary: <one line>
parent_objective: <objective + active steers, condensed>
tasks:
  - id: t_01  status: wip      text: "implement JWT refresh endpoint"   worktree: .wt/auth-refresh
  - id: t_02  status: ready    text: "add regression tests for auth flows"
  - id: t_03  status: blocked  text: "update API docs"                  reason: "waiting on spec"
  - id: t_04  status: done     text: "..."
picked: <task-id, only in pick mode>
isolation: shared | worktree:<path>     # only in pick mode
next_recommended: plan | spike | tdd | debug | review
notes: <e.g. "t_03 blocked until user confirms API surface in steer">
```
````

## When to stop using kanban

If the parent objective collapses to a single remaining task, or you find yourself adding `--worktree` to every task, you've over-decomposed. Move all but the active task back to `ready`, finish what's `wip`, and let the parent orchestrator drop back to direct routing (`plan`/`tdd`/`review`) without kanban.

## Stay narrow

- Don't do the task's coding work yourself. You decompose, pick, and reconcile. The parent loop routes downstream sub-skills.
- Don't create worktrees unless the next sub-skill genuinely needs isolation. Worktree overhead isn't free.
- Don't reorder a task to `done` without verification — only `mission-review` declares done at the parent-mission level; kanban-level `done` means "this slice is verified locally and ready for parent review."
- Don't poll: between sub-skill invocations on the same task, you must still re-run `mission pending` (steers/pauses may have landed and may reshape the task list).
