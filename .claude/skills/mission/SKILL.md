---
name: mission
description: Run a long-running objective ("mission") where Claude IS the execution loop and the `mission` CLI is the durable state store. Use when the user types `/mission ...` or asks to start, steer, pause, resume, abort, inspect, or verify a mission.
---

# Mission Mode

A **mission** is a long-running objective the user hands to Claude. Claude drives the work step-by-step. Between steps, the user can refine the goal (`steer`), pause, resume, or abort — all without interrupting an in-flight tool call. The `mission` CLI (built from this repo's `src/`) is the single source of truth for mission state, stored under `.mission/<id>/`.

**Critical invariant:** Claude is the loop. The CLI does not run Claude. The CLI only reads/writes state. Every loop iteration in this skill corresponds to one Claude turn.

## SETUP — first-run wizard

Before doing anything else on a new objective, check if the user config exists:

```
npx tsx src/cli.ts config show
```

If this **errors or returns the default config without `~/.mission/config.json` having been written** (you can detect this by checking the file directly: `test -f ~/.mission/config.json`), run the **first-run wizard** with the `AskUserQuestion` tool. Ask exactly three questions, in order. After each batch, call `mission config set` to persist the answers, then `mission config init` at the end to seal the file. Do **not** start the mission until the wizard completes.

### Q1 — spike commits

> "When the mission spikes (experimental throwaway code), how should those changes be tracked?"
> - **Commit as you go** (recommended) — every spike step lands a `spike:` commit on the mission branch; recoverable, reviewable.
> - **Gitignore until promotion** — spike code lives in `.mission/<id>/spike/` and is git-ignored; promotion `git mv`s it into the source tree.

Persist with: `mission config set spike.commit true` (commit) or `false` (gitignore).

### Q2 — default turn budget

> "What's your default per-mission turn budget? Budget counts sub-skill invocations, not Claude turns."
> - **10 turns** (tight, surgical missions)
> - **20 turns** (recommended)
> - **40 turns** (multi-step features)
> - **Unlimited** — no cap, rely on `/mission abort` (sets maxTurns to a very large number like `99999`)

Persist with: `mission config set budget.maxTurns 20` (or chosen value).

### Q3 — available external agents (multi-select)

> "Which external coding agents do you have installed and want to delegate grunt work to? Multi-select."
> - **pi** (https://pi.dev/)
> - **codex** (OpenAI Codex CLI)
> - **opencode** (OpenCode CLI)
> - *(none — stay on primary)*

For **each** agent the user selected, ask a follow-up `AskUserQuestion`:

> "Which **<agent>** model? (Type the model id, or 'default' to let the agent CLI pick.)"

Persist per agent with two calls:
```
mission config set agents.<name>.available true
mission config set agents.<name>.model <model-or-default>
```

If the user picked none, the agents block stays as the defaults (`available: false`) and the orchestrator runs everything on the primary.

### Seal

After Q1–Q3 are persisted, run `mission config init` (no-op if file already written) and `mission config show` to display the final config back to the user as confirmation. Then proceed to **START**.

---

## ID auto-resolution — usually omit it

The CLI tracks the "active" mission in `.mission/current`. Any subcommand that takes an `<id>` will fall back to this pointer when the id is omitted. The pointer is set by `start`, cleared by `abort` and by `step --done`. So the user (and you) almost never need to pass an id — only when juggling multiple missions or referring to a completed one.

Heuristic in the CLI: an argument matching `^m_[a-f0-9]+$` is treated as an id; otherwise it's the steer text / subcommand payload, and `current` is used for the id.

## Subcommands

The user invokes the skill via `/mission <subcommand> [args]`. Parse `$ARGUMENTS` and dispatch:

| User types                                    | Action                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `/mission <objective>` (no known subcommand)  | Treat the entire argument as a new objective. Run **START** then **LOOP**. |
| `/mission status [id]`                        | Run `mission status [id]` and print output.                            |
| `/mission steer [id] <text>`                  | Run `mission steer [id] "<text>"`. Print confirmation, then **resume LOOP** on the active mission. |
| `/mission pause [id]`                         | Run `mission pause [id]`.                                              |
| `/mission resume [id]`                        | Run `mission resume [id]`, then **LOOP** on that id.                   |
| `/mission abort [id]`                         | Run `mission abort [id]`.                                              |
| `/mission log [id]`                           | Run `mission log [id]`.                                                |
| `/mission verify [id]`                        | Run `mission verify [id]`.                                             |
| `/mission current`                            | Print the active mission id (or "(no active mission)").                |

If the first word after `/mission` is not one of `start|status|steer|pause|resume|abort|log|verify|current`, treat the whole input as an objective (START + LOOP).

## CLI invocation

Run the CLI via Bash:

```
npx tsx src/cli.ts <subcommand> ...
```

(or `mission ...` if installed globally). Always quote multi-word arguments.

## START

1. `npx tsx src/cli.ts start "<objective>" [--max-turns N]` — capture the printed JSON; extract `id` and `budget`.
2. Announce: `mission <id> started — objective: <objective> (budget: N turns)`.
3. Proceed immediately to **LOOP** with that `id`.

### Budget

- Default budget is **20 turns** per mission.
- User can override at start: `/mission ship the auth refactor --max-turns 40` (pass `--max-turns` through to the CLI).
- Each `mission step` increments `turnsUsed`. When `turnsUsed >= maxTurns`, status flips to `budget_exhausted` and the loop ends at its next iteration.
- One Claude turn = one mission step. Steps should be **bounded** (~2 min of work) so the budget is a meaningful safety net, not a footgun.

## Sub-skills (co-pilots) — dynamic discovery

The orchestrator does not do detailed work itself — it **routes** each step to one of the available `mission-*` sub-skills, then consumes the sub-skill's `mission-report` block to decide the next route. Each sub-skill has a narrow sub-mission and refuses to step outside its lane.

**Discovery:** sub-skills live at `.claude/skills/mission-*/SKILL.md`. At the start of every LOOP iteration, glob for these files and read each one's frontmatter `mission-routing:` block:

```yaml
mission-routing:
  invoke-when: [<bullet conditions for routing TO this sub-skill>]
  typical-next: [<what this sub-skill usually recommends next>]
  cost-tier: primary | cheap
```

Use `invoke-when` to decide which sub-skill matches the current state; use `cost-tier` to decide whether to delegate to an external agent (see "External agents" later).

**Baseline routing fallback** (when frontmatter is ambiguous, fall back to this):

```
fresh mission                → mission-plan
plan complete (single-slice) → mission-tdd (or mission-debug if a failure is known)
plan complete (multi-part)   → mission-kanban (decompose into tasks)
plan needs_more_context      → mission-spike (resolve the unknown experimentally)
spike complete (definitive)  → mission-plan (re-plan with new evidence)
spike complete (impl-mode)   → mission-tdd (harden via promote_checklist) OR mission-review
kanban decompose complete    → mission-kanban (pick mode — choose next task)
kanban pick complete         → routes the scoped sub-skill it nominated (plan/tdd/debug/spike)
kanban reconcile complete    → mission-review (merge worktrees, judge done)
mission-debug complete       → mission-tdd (apply the proposed fix)
mission-debug needs_more     → mission-debug (next hypothesis) OR mission-plan
mission-tdd complete         → mission-review (checkpoint) OR mission-tdd (next behavior)
mission-tdd blocked          → mission-plan (rethink approach)
mission-review verdict=complete → step --done
mission-review verdict=continue → use its next_recommended
mission-review verdict=blocked  → stop loop, surface to user, await steer
```

The sub-skill's `mission-report` block is **authoritative**. Trust `next_recommended` unless it would violate a higher rule (e.g., it asks for `done` but verification didn't pass, or it bypasses `mission-review` entirely).

## External-agent delegation

When the orchestrator decides to route to a sub-skill whose frontmatter declares `cost-tier: cheap` (currently `mission-tdd` and `mission-debug`), check whether delegation should happen first:

1. **Probe agents** with one CLI call:
   ```
   npx tsx src/cli.ts agents list
   ```
   Output is JSON: `{ agents: [{ name, available, model, binaryPath, usable }, ...] }`.
2. **Pick the first usable agent.** Order: `pi → codex → opencode`. The first with `usable: true` wins.
3. **If a usable agent is found**, route to its delegation wrapper instead of the primary sub-skill:
   - `mission-tdd` (cheap) + usable pi → invoke `mission-pi`
   - `mission-debug` (cheap) + usable codex → invoke `mission-codex`
   - etc.
   The wrapper builds the delegation prompt, runs the agent CLI sync, parses, reports.
4. **If no usable agent**, run the primary sub-skill yourself (Claude). No delegation, no warning — this is the normal path.

### Escalation rule (the only one)

When a delegation wrapper emits `status: blocked`, the orchestrator's **very next step** must re-route the same sub-mission to the **primary** sub-skill (`mission-tdd` or `mission-debug`), with the wrapper's `escalation_hint` folded into the prompt. Do not retry the same agent. Do not try a different agent. Escalate once, then trust the primary.

If the primary also returns `blocked`, surface to the user via a `mission step` summary like `[primary-escalation] still blocked: <reason>` and let mission-review judge.

### Rules

- Never delegate `cost-tier: primary` sub-skills (`mission-plan`, `mission-spike`, `mission-review`, `mission-kanban`). Judgment and decomposition stay on the primary model.
- Never delegate twice in a row for the same sub-mission. After one blocked agent, primary takes over.
- Never delegate when the parent step is part of a chain that just emerged from `mission-review verdict: continue` — those chains are corrective and benefit from primary cohesion.

## Per-sub-skill budget

One `mission step` call = one sub-skill invocation. The budget (`maxTurns`) caps **sub-skill invocations**, not Claude turns. This makes the budget a meaningful cost cap once external agent delegation lands — each sub-skill may be a separate model call.

Practical impact:
- Chaining two sub-skills in one Claude turn = two `mission step` calls = two budget ticks.
- A chained sequence like `plan → tdd → review` consumes 3 budget units.
- Set `budget.maxTurns` accordingly during the first-run wizard.

## Chaining sub-skills

You may chain 2+ sub-skills within a single Claude turn when the next route is obvious from the previous report (e.g., `mission-debug` returns `complete` with a clear fix → chain directly into `mission-tdd` without yielding back to the user). Each chained sub-skill:

1. Records its own `mission step` call (budget tick).
2. Re-checks `mission pending` BEFORE invoking the next sub-skill — a steer or pause may have landed between steps and must be honored.

**Do not** chain across a `mission-review` boundary that returned `verdict: continue` or `blocked` — those verdicts always yield back to the user for visibility.

## LOOP — Claude IS the loop

For each iteration, in order:

1. **Check state and steers.** Run `npx tsx src/cli.ts pending <id>`. Parse the JSON. If `status` is `paused`, `aborted`, `completed`, `failed`, or `budget_exhausted`, **stop the loop** and report the terminal status. Also surface `budget.turnsUsed / budget.maxTurns` to the user when it crosses 75% — gives them a chance to bump the budget before exhaustion.
2. **Fold in pending steers.** If `pending[]` is non-empty, treat each entry's `text` as a refinement of the objective for this and subsequent steps. Mention briefly to the user: `applying steer #N: "<text>"`.
3. **Route to a sub-skill.** Based on the table above and the previous step's `next_recommended`, invoke exactly one sub-skill via the Skill tool: `mission-plan`, `mission-debug`, `mission-tdd`, or `mission-review`. Pass it the objective, applied steers, and recent log. The sub-skill does the work and emits a `mission-report` block.
4. **Parse the report.** Extract `status`, `next_recommended`, and (for review) `verdict`. If the report is malformed, treat it as `needs_more_context` and re-route to `mission-plan`.
5. **Record the step.** Run `npx tsx src/cli.ts step <id> "[<sub-skill>] <summary from report>"`. Add `--done` **only** if `mission-review` returned `verdict: complete`.
6. **Repeat** from (1) until the CLI reports a terminal status, or you marked `--done`.

**Do not** poll the CLI mid-step. **Do not** invoke more than one sub-skill per step. The steer queue is checked exactly once per iteration, between steps. This is by design — it gives the user a deterministic boundary at which their refinement applies, without us cancelling in-flight tool calls.

## Steer semantics

- `mission steer` is **queued, not preemptive**. The current step finishes first. The next iteration's `pending` call surfaces it.
- Steers do not replace the objective unless they explicitly say so ("override:", "new objective:", etc.). Default behavior: layer the refinement on top.
- Multiple steers between two steps are applied together in seq order.

### Truly non-interrupting steer — the `!` bash escape

A `/mission steer` typed while you are mid-loop **cannot reach disk before your current Claude turn ends** — slash commands queue as the next user turn. If the user wants to inject a steer without waiting for you to finish a long tool call, they should type:

```
!npx tsx src/cli.ts steer "focus on JWT only"
```

The leading `!` runs the command in the harness shell immediately, bypassing the model. The steer file is written in real time; your next `pending` check inside the LOOP picks it up. You don't stop. You don't even notice until the next iteration boundary.

Document this to the user the first time they start a mission, so they know the option exists.

## Pause / resume semantics

- `pause` flips status to `paused`. The loop's next `pending` call sees this and exits. The in-flight step is **not** interrupted — it completes and is recorded normally.
- `resume` flips it back. If the user follows `/mission resume <id>` in chat, re-enter **LOOP** with that id in the same Claude turn.

## Abort semantics

- `abort` is terminal. The loop exits at its next boundary. Already-recorded steps remain in the log; nothing is rolled back.

## When to stop on your own

Mark `--done` when you believe the objective is satisfied. Then briefly summarize what was accomplished and any follow-ups. Do not loop indefinitely — if you cannot make progress for two consecutive steps, stop and ask the user (the loop ends naturally because you decide not to call `step` again; instead, report blocker and await guidance).

## Examples

User: `/mission ship the auth refactor end-to-end`
→ `start` → loop: read code, plan, edit, test, edit, test, mark `--done`.

User (between steps): `/mission steer m_abc123 focus only on the JWT path; skip OAuth`
→ queued; next iteration begins with: `applying steer #1: "focus only on the JWT path; skip OAuth"`.

User: `/mission status` (no id)
→ resolves to active mission via `.mission/current`, prints CLI output. No loop.

User mid-loop, in the harness input: `!npx tsx src/cli.ts steer "focus only on the JWT path"`
→ harness runs CLI directly, file written, Claude continues uninterrupted, next LOOP iteration applies the steer.

## Failure modes to watch

- **Step too large.** If a single step is several tool calls of work, steers feel laggy. Split it.
- **Forgetting to record.** Every step must end with `mission step` or the cursor falls behind reality and steers won't be marked applied.
- **Looping when terminal.** Always trust the CLI's `status` field over your own assumption.
