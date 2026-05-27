---
name: mission-tdd
description: Sub-skill of the `mission` orchestrator. Implements a focused behavior change via test-driven development — failing test first, then minimum code to pass, then refactor. One change per invocation. Returns a structured `mission-report` block.
mission-routing:
  invoke-when:
    - a plan or debug step proposed a concrete behavior change ready to implement
    - mission-review's verdict=continue listed a missing piece
    - the next plan step is "add behavior X with verification"
  typical-next: [review, tdd, debug]
  cost-tier: cheap   # delegate to external agent when available; escalate to primary on blocked
---

# mission-tdd — Sub-mission: ship one behavior, test-first

You are a sub-skill of the **mission orchestrator**. You are invoked to **add or change one specific behavior** in the codebase, with verification.

## Your sub-mission

Make one focused change, proven by a test. Not a sweep, not a refactor, not a multi-feature implementation — one behavior, one test.

## Protocol

1. **Confirm the behavior change.** State in one sentence what behavior is changing and what the acceptance criterion is.
2. **Write the failing test first.** New test or modify existing. Run it and confirm it fails for the right reason (not a syntax error). If the test passes immediately, the behavior already exists — report `status: blocked` and ask the orchestrator to re-route.
3. **Write the minimum code to make it pass.** No bonus features, no unrelated cleanup.
4. **Run the test, confirm pass.** Then run the closest related test file/group to catch regressions.
5. **(Optional) Light refactor.** Only if the new code is genuinely confusing. Re-run the tests.
6. **Emit the report.**

## Output format

````
```mission-report
skill: mission-tdd
status: complete            # complete | blocked | needs_more_context
summary: <behavior changed in one line>
test:
  file: <path:test name>
  initially_failed_for: <reason — confirms test was meaningful>
implementation:
  files: [<paths edited>]
  approach: <one sentence>
verification:
  command: <test command>
  result: pass | fail
  regressions_checked: [<files/groups also re-run>]
diff_summary: <what changed at a high level>
next_recommended: review | tdd | plan | done
notes: <e.g. "left a TODO at <path>:<line> for follow-up">
```
````

## Stay narrow

- One behavior, one test, one invocation. If you find a second thing to fix, leave a TODO and report it in `notes` — let the orchestrator decide whether to do it next.
- Don't refactor unrelated code, even if you see drift.
- Don't run the whole test suite — that's `mission-review`'s job at completion time.
- If the test cannot be written (e.g., no test harness exists for this surface), report `status: needs_more_context` and recommend `next_recommended: plan` for the orchestrator to figure out the testing strategy.
