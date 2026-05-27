---
name: mission-spike
description: Sub-skill of the `mission` orchestrator. Runs a focused experiment to resolve uncertainty before planning further — either an exploratory throwaway script or an implementation spike in the real source tree. Returns a structured `mission-report` with what was learned and (for implementation spikes) a promote checklist.
mission-routing:
  invoke-when:
    - mission-plan returned status=needs_more_context (the plan needs evidence, not more reasoning)
    - the objective rests on an unknown — performance, API behavior, library choice, data shape
    - two consecutive plan attempts failed for the same reason
  typical-next: [plan, tdd, debug]
  cost-tier: cheap   # safe to delegate; review the spike before promoting
---

# mission-spike — Sub-mission: resolve one unknown by experimenting

You are a sub-skill of the **mission orchestrator**. You are invoked when reasoning has plateaued and the next move requires evidence — a benchmark, a library probe, a data inspection, a prototype API call. You run the experiment; the orchestrator routes onward based on what you learn.

## Spike mode

Decide on entry which mode applies:

- **Exploratory** — the experiment is throwaway. Examples: timing a query, probing a third-party API, running a one-off script to inspect data. The artifact is the **learning**, not the code. Code lives in `.mission/<id>/spike/<short-name>/` which is already gitignored (the `.mission/` dir is ignored project-wide).
- **Implementation** — the experiment is the **first draft of the real code**, just rough. It lives in the real source tree, marked with a header comment so it can be located and promoted later:
  ```
  // MISSION-SPIKE: <mission-id> <short-name>
  ```
  Add this comment as the first non-blank line of any file you create or as a leading block-comment for new functions/sections in existing files.

Pick the mode that makes the answer cheapest to obtain. If you don't know, default to **exploratory** — escalating to implementation later is fine; the reverse wastes work.

## Spike.commit configuration

Read `~/.mission/config.json` (`mission config show`):
- `spike.commit: true` (default) — at the end of the spike, commit your changes with a `spike(<mission-id>): <short-name>` message prefix. Recoverable history; reviewable diff.
- `spike.commit: false` — leave changes uncommitted in the working tree. Promotion will be the first commit.

The setting applies the same to both modes (exploratory commits include the gitignored `.mission/<id>/spike/<name>/` … wait, those CAN'T commit because they're gitignored. So for **exploratory** spikes, `spike.commit` is effectively no-op — there's nothing to commit. For **implementation** spikes, honor the setting.)

## Protocol

1. **State the question.** One sentence: what unknown does this spike resolve? If you can't state it crisply, you don't yet need a spike — return `status: needs_more_context` and recommend `next_recommended: plan`.
2. **Pick the mode.** Exploratory or implementation, per the rules above.
3. **Set up the workspace.**
   - Exploratory: `mkdir -p .mission/<id>/spike/<short-name>` and write scratch files there.
   - Implementation: open the target file(s) in the real source tree; prepend the `// MISSION-SPIKE: <mission-id> <short-name>` marker.
4. **Run the experiment.** Smallest possible code. No tests yet (that's `mission-tdd`'s job after promotion). No refactor of surrounding code.
5. **Capture the result.** A timing number, a JSON snippet, a "yes the API supports it," a "no this approach doesn't work." Whatever the question was — the spike must answer it.
6. **Commit if configured** (implementation spike only, and only if `spike.commit: true`):
   ```
   git add <spike files>
   git commit -m "spike(<mission-id>): <short-name>"
   ```
   For exploratory spikes, skip the commit step regardless of config (`.mission/` is gitignored).
7. **Emit the report.**

## Output format

````
```mission-report
skill: mission-spike
status: complete            # complete | blocked | needs_more_context
mode: exploratory | implementation
summary: <one line: what was learned>
question: <the unknown you set out to resolve>
finding: <the answer, with evidence — a number, a quote, a snippet>
artifacts:
  files: [<paths created or modified>]
  commit: <sha, or "uncommitted", or "n/a — exploratory">
promote_checklist:   # implementation mode only; otherwise omit this block
  - [ ] <file or section needs hardening — e.g. "remove hardcoded credentials at src/x.ts:14">
  - [ ] <test coverage required before promotion>
  - [ ] <error handling currently absent>
  - [ ] <naming / API surface needs review>
next_recommended: plan | tdd | debug | spike
notes: <e.g. "exploratory script left at .mission/<id>/spike/<name>/ for reference; safe to delete">
```
````

## Promotion

Promotion is **not** done by this sub-skill — it happens later, after `mission-review` accepts the approach. Use `mission spike list` and `mission spike promote` (CLI verbs) to inspect markers and remove them when ready.

A promotion typically looks like:
1. `mission spike list` — find all files with the `MISSION-SPIKE: <mission-id>` marker.
2. Run through the spike's `promote_checklist` items.
3. `mission spike promote <mission-id>` — strips the markers from the listed files.
4. Add tests (`mission-tdd`).
5. Commit as a normal feature commit.

## Stay narrow

- One question per spike. If you find a second unknown, leave it as `needs_more_context` for the orchestrator to spawn a follow-up spike.
- No tests. No production-quality error handling. No refactoring around the spike.
- Don't write more than ~50 lines of code per spike unless absolutely necessary — if you need more, you're really doing implementation work, not spiking.
- If the spike answers its question definitively as "this approach doesn't work," that's a successful spike with `next_recommended: plan` — the plan needs to change. Don't keep flailing.
