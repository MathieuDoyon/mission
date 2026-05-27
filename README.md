# Mission

> A persistent, steerable autonomous coding loop for Claude Code — durable state on disk, queued mid-flight steering, and a set of focused sub-skills the orchestrator routes between.

![status: alpha](https://img.shields.io/badge/status-alpha-orange)
![version](https://img.shields.io/badge/version-0.0.1-blue)
![license: MIT](https://img.shields.io/badge/license-MIT-green)
![node: ≥20](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)
![typescript](https://img.shields.io/badge/typescript-5.6-3178c6?logo=typescript&logoColor=white)

A user gives Claude a durable objective. Claude keeps working across turns — planning, spiking, coding, reviewing — until the mission is complete, blocked, paused, aborted, or out of budget. The user can refine the goal mid-flight without interrupting in-flight work.

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Installation](#installation)
- [Quick start](#quick-start)
- [CLI reference](#cli-reference)
- [Sub-skills](#sub-skills)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Status](#status)
- [License](#license)

## Features

- **Persistent objective loop** — `/mission <objective>` runs across many Claude turns until done.
- **Queued non-preemptive steering** — `mission steer "<refinement>"` lands at the next step boundary, never cancels an in-flight tool call.
- **Per-sub-skill budget** — every sub-skill invocation ticks the turn budget; default 20, configurable.
- **9 focused sub-skills** with clear lanes: plan, spike, debug, tdd, review, kanban, plus three external-agent delegation wrappers (pi, codex, opencode).
- **Dynamic discovery** — orchestrator globs `.claude/skills/mission-*/SKILL.md` and reads each skill's `mission-routing:` frontmatter; drop in a new sub-skill, no rewiring needed.
- **JSONL event sourcing** — steers, applied marks, tasks, and a generic timeline log are immutable append-only files; `state.json` is the rewritten snapshot.
- **First-run wizard** with `AskUserQuestion` for spike-commit policy, default budget, and available external agents.
- **Spike-then-promote** — implementation spikes carry a `MISSION-SPIKE:` marker; `mission spike promote <id>` strips them when the spike graduates to real code.
- **Kanban under a mission** — `mission task add/move/done` for multi-part objectives; orchestrator picks the next task each iteration and decides worktree vs shared tree.
- **External-agent delegation** — push cheap-tier work (tdd/debug) to the first usable agent on PATH; escalate to primary on `blocked`.
- **Crash-safe** — JSONL appends are atomic under the pipe-buffer size; `state.json` writes use tmp+rename. Partial trailing lines are ignored on resume.

## How it works

Mission Mode has two halves:

1. **A CLI (`mission`)** that is a *pure state store*. It does not run Claude; it only reads and writes JSONL/JSON files under `.mission/<id>/` (per-project, per-mission state) and `~/.mission/config.json` (user-level config).
2. **Claude Code skills** that drive the loop. The orchestrator skill (`.claude/skills/mission/SKILL.md`) is the durable LOOP definition; nine sub-skills are the lanes the orchestrator routes between. Claude *is* the loop — the CLI is just the memory.

Between every step the orchestrator checks the steer queue, applies any pending refinements, picks a sub-skill, runs it, records the step, ticks the budget, and continues until the mission reaches a terminal status.

## Installation

```bash
git clone git@github.com:MathieuDoyon/mission.git
cd mission
npm install
npm run build               # compile TypeScript to dist/
npm link                    # expose `mission` on your PATH globally
```

Verify:

```bash
mission --help
```

For development without building, you can also run the CLI directly:

```bash
npx tsx src/cli.ts <command>
```

The Claude Code skills live under `.claude/skills/`. To use Mission Mode in another project, copy or symlink the `mission` and `mission-*` skill directories into that project's `.claude/skills/`.

## Quick start

```bash
# 1. One-time user config (you'll be walked through this by the wizard on first /mission)
mission config init

# 2. Inside Claude Code in any project, type:
#    /mission ship the auth refresh refactor end-to-end
#
#    Claude will start a mission, route to mission-plan, then mission-tdd, etc.
#    The mission state lives in ./.mission/<id>/

# 3. Refine the goal mid-flight without interrupting Claude:
#    type this in the harness shell (the `!` prefix runs it now, bypassing Claude)
!mission steer "skip the OAuth path; focus on JWT only"

# 4. Inspect:
mission status              # quick summary of the active mission
mission log                 # full timeline
mission pending             # any queued steers + current budget
mission verify              # integrity check

# 5. Pause, resume, or abort:
mission pause
mission resume
mission abort

# 6. Programmatic flow (the same primitives the LOOP uses internally):
mission start "add a /healthcheck endpoint with tests"
mission step "[plan] outline: route + handler + test"
mission step "[tdd] failing test, then implementation, green"
mission step "[review] verdict=complete, all tests pass" --done
mission status              # status: completed, budget: 3/20 turns
```

## CLI reference

```text
LIFECYCLE
  mission start <objective> [--max-turns N]
  mission status   [id]
  mission pending  [id]
  mission step     [id] <summary> [--done]
  mission steer    [id] <text>
  mission pause    [id]
  mission resume   [id]
  mission abort    [id]
  mission log      [id]
  mission verify   [id]
  mission current

CONFIG  (writes ~/.mission/config.json)
  mission config show
  mission config init
  mission config set <key> <value>            # dotted: spike.commit, budget.maxTurns,
                                              # agents.pi.available, agents.pi.model

SPIKE
  mission spike list <id>
  mission spike promote <id> [--dry-run]      # strips MISSION-SPIKE markers

KANBAN  (operates on active mission via current pointer)
  mission task add "<text>" [--worktree]
  mission task list
  mission task move <task-id> <ready|wip|blocked|done>
  mission task done <task-id>                 # alias for move … done
  mission task block <task-id> <reason>
  mission task worktree <task-id> <path>

AGENTS  (external delegation)
  mission agents list
  mission agents check <pi|codex|opencode>
```

When `[id]` is omitted, the CLI resolves it from `.mission/current` (set automatically by `start`; cleared on `--done` and `abort`).

## Sub-skills

The orchestrator routes one sub-skill per step. Each declares a `mission-routing:` block in its frontmatter; the orchestrator discovers them by glob.

| Skill              | Sub-mission                                                                 | Cost tier |
| ------------------ | --------------------------------------------------------------------------- | --------- |
| `mission-plan`     | Frame the next 1–5 actions; set an exit condition                           | primary   |
| `mission-spike`    | Resolve one unknown experimentally; exploratory or implementation mode      | primary   |
| `mission-debug`    | Reproduce + one hypothesis + proposed fix (does not patch)                  | cheap     |
| `mission-tdd`      | One behavior, failing test first, minimum implementation                    | cheap     |
| `mission-review`   | Mission Judge — verdict: complete / continue / blocked                      | primary   |
| `mission-kanban`   | Decompose multi-part missions; pick next task; defer merge to review        | primary   |
| `mission-pi`       | Delegate cheap-tier work to pi.dev's CLI                                    | cheap     |
| `mission-codex`    | Delegate cheap-tier work to the OpenAI Codex CLI                            | cheap     |
| `mission-opencode` | Delegate cheap-tier work to the OpenCode CLI                                | cheap     |

Each sub-skill ends its turn with a `mission-report` fenced block that the orchestrator parses to choose the next route. Sub-skills refuse to step outside their lane — `mission-debug` won't apply fixes, `mission-tdd` won't refactor unrelated code, `mission-review` won't lower the bar to declare done.

Routing default (sub-skills can override via their `next_recommended` field):

```text
fresh mission                → mission-plan
plan complete (single slice) → mission-tdd  (or mission-debug if a failure is known)
plan complete (multi-part)   → mission-kanban
plan needs more context      → mission-spike
spike complete (definitive)  → mission-plan
spike complete (impl-mode)   → mission-tdd or mission-review
tdd complete                 → mission-review (checkpoint) or mission-tdd
review verdict=complete      → mission step --done
review verdict=continue      → use next_recommended
review verdict=blocked       → stop loop, surface to user
```

When routing to a `cost-tier: cheap` sub-skill, the orchestrator first checks `mission agents list`; the first usable agent gets the delegation. On `status: blocked` from a delegation, the orchestrator escalates exactly once to the primary sub-skill, then trusts it.

## Configuration

`~/.mission/config.json` is user-level (not shared across machines). The wizard writes it on first `/mission`; you can edit it any time with `mission config set <dotted.key> <value>`.

```json
{
  "version": 1,
  "spike":  { "commit": true },
  "budget": { "maxTurns": 20 },
  "agents": {
    "pi":       { "available": false, "model": null },
    "codex":    { "available": false, "model": null },
    "opencode": { "available": false, "model": null }
  }
}
```

| Key                          | Meaning                                                                   |
| ---------------------------- | ------------------------------------------------------------------------- |
| `spike.commit`               | `true` → spike steps land `spike:` commits; `false` → stay in working tree |
| `budget.maxTurns`            | Cap on sub-skill invocations per mission                                  |
| `agents.<name>.available`    | Whether this agent is allowed for delegation                              |
| `agents.<name>.model`        | Model id to pass via `--model`; `"default"` to omit the flag              |

## Architecture

Each mission writes to `./.mission/<id>/`:

```text
state.json        # mutable snapshot — status, cursor, budget; atomic tmp+rename
steers.jsonl      # append-only operator steers (queued refinements)
applied.jsonl     # append-only marks for which steers were folded at which step
tasks.jsonl       # append-only kanban events (add/move/block/worktree)
log.jsonl         # append-only timeline of turns + status changes
```

Append-only JSONL files give crash-safe history; `state.json` gives a fast snapshot. Derived state (current task statuses, applied vs pending steers) is computed by replay. This mirrors the pattern of Kafka, event-sourced systems, and Git's reflog: immutable events plus a snapshot.

The active-mission pointer at `.mission/current` lets every subcommand auto-resolve the id — you almost never have to pass it explicitly.

The full design spec lives at [`docs/research/mission_mode_autonomous_flow_spec.md`](./docs/research/mission_mode_autonomous_flow_spec.md).

## Status

Alpha. The lifecycle and steering are exercised end-to-end (see live demo notes in the project history). Real external-agent delegation has been wired but not yet smoke-tested against live CLIs. Worktree reconciliation in `mission-review` is documented but not yet implemented in code — it currently relies on manual `git worktree` operations.

Known follow-ups:

- Smoke-test delegation against real pi.dev / codex / opencode CLIs.
- Add `mission spike commit <topic>` helper for the spike-then-commit flow.
- Auto-merge worktrees during kanban reconciliation.
- Project-level config overrides (today only user-level `~/.mission/config.json` is honored).

## License

MIT — see [LICENSE](./LICENSE).
