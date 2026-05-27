---
name: mission-pi
description: Delegation wrapper. Invoked by the `mission` orchestrator to push cheap-tier work (mission-tdd / mission-debug body) to the Pi agent terminal (https://pi.dev/) synchronously. Captures stdout/stderr, parses for completion vs blocker, and emits a `mission-report` block. On blocked → orchestrator escalates back to the primary sub-skill.
mission-routing:
  invoke-when:
    - orchestrator wants to run a cost-tier=cheap sub-skill AND `mission agents check pi` reports usable
  typical-next: [review, tdd, plan]
  cost-tier: cheap
  delegates-for: [mission-tdd, mission-debug]
---

# mission-pi — Delegation: route cheap work to Pi (pi.dev)

You are a **delegation wrapper sub-skill**. Same shape as `mission-codex` and `mission-opencode`. The orchestrator picked Pi because it's the first usable agent in this user's config. Forward, watch, report.

## Pre-flight

```
npx tsx src/cli.ts agents check pi
```

Exit ≠ 0 → emit `status: blocked` with the check output in `notes` and stop.

## Build the delegation prompt

Same template as `mission-codex` — see that skill's "Build the delegation prompt" section. The prompt is agent-agnostic.

## Invoke

Pi's canonical non-interactive form (verify with `pi --help`):

```
pi --model <model-from-config> "$PROMPT"
```

Read the model from `mission config show` → `agents.pi.model`. If `"default"`, omit the flag.

Capture stdout + stderr. Timeout: 10 minutes (`timeout 600` when available).

## Parse the result

Same signal table as `mission-codex`. Inspect `git diff` after invocation; trust the diff over ambiguous prose.

## Output format

````
```mission-report
skill: mission-pi
status: complete | blocked | needs_more_context
delegated_for: mission-tdd | mission-debug
agent:
  name: pi
  model: <model used>
  binary: <path from agents check>
  exit_code: <int>
  runtime_seconds: <int>
summary: <one-line outcome>
diff_summary: <files changed via git diff --stat>
verification:
  command: <test command if Pi ran one>
  result: pass | fail | skipped
escalation_hint: <if blocked, one line on what primary needs to do>
next_recommended: review | tdd | debug | plan
notes: <pi stderr highlights, etc>
```
````

## Escalation rule

Same as `mission-codex`: `status: blocked` triggers the orchestrator to re-route to the primary sub-skill (Claude itself running `mission-tdd` / `mission-debug`). `escalation_hint` must be concrete.

## Stay narrow

Same constraints as `mission-codex`. You delegate; you don't code. You don't chain. You don't rewrite the diff.
