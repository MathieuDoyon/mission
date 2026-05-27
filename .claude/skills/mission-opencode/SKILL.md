---
name: mission-opencode
description: Delegation wrapper. Invoked by the `mission` orchestrator to push cheap-tier work (mission-tdd / mission-debug body) to the OpenCode CLI synchronously. Captures stdout/stderr, parses for completion vs blocker, and emits a `mission-report` block. On blocked → orchestrator escalates back to the primary sub-skill.
mission-routing:
  invoke-when:
    - orchestrator wants to run a cost-tier=cheap sub-skill AND `mission agents check opencode` reports usable
  typical-next: [review, tdd, plan]
  cost-tier: cheap
  delegates-for: [mission-tdd, mission-debug]
---

# mission-opencode — Delegation: route cheap work to OpenCode

You are a **delegation wrapper sub-skill**. Same shape as `mission-codex` and `mission-pi` — the orchestrator picked OpenCode because it's the first usable agent in this user's config. Forward, watch, report.

## Pre-flight

```
npx tsx src/cli.ts agents check opencode
```

Exit ≠ 0 → emit `status: blocked` with the check output in `notes` and stop.

## Build the delegation prompt

Same template as `mission-codex` — see that skill's "Build the delegation prompt" section. The prompt is **agent-agnostic**; only the invocation differs.

## Invoke

OpenCode's canonical non-interactive form (verify with `opencode --help`):

```
opencode run --model <model-from-config> "$PROMPT"
```

Read the model from `mission config show` → `agents.opencode.model`. If `"default"`, omit the flag.

Capture stdout + stderr. Timeout: 10 minutes (`timeout 600` when available).

## Parse the result

Same signal table as `mission-codex`. OpenCode tends to be more verbose about its plan — look for an explicit "I'm done" / "completed" marker, fall back to inspecting `git diff` when the prose is ambiguous.

## Output format

````
```mission-report
skill: mission-opencode
status: complete | blocked | needs_more_context
delegated_for: mission-tdd | mission-debug
agent:
  name: opencode
  model: <model used>
  binary: <path from agents check>
  exit_code: <int>
  runtime_seconds: <int>
summary: <one-line outcome>
diff_summary: <files changed via git diff --stat>
verification:
  command: <test command if OpenCode ran one>
  result: pass | fail | skipped
escalation_hint: <if blocked, one line on what primary needs to do>
next_recommended: review | tdd | debug | plan
notes: <opencode stderr highlights, etc>
```
````

## Escalation rule

Same as `mission-codex`: `status: blocked` triggers the orchestrator to re-route to the primary sub-skill (Claude itself running `mission-tdd` / `mission-debug`). `escalation_hint` must be concrete.

## Stay narrow

Same constraints as `mission-codex`. You delegate; you don't code. You don't chain. You don't rewrite the diff.
