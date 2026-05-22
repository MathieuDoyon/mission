# Autonomous Coding Flow Spec: Mission Mode

> Structured extraction from the discussion about Hermes Agent autonomous coding workflow and naming a non-`/goal` autonomous flow for use in Codex.

---

## 1. Purpose

Design an autonomous coding flow that behaves like a persistent agent objective, but avoids naming conflicts with existing `/goal`-style commands in ChatGPT, Codex, Claude Code, and related agent systems.

Recommended command:

```text
/mission
```

Recommended product name:

```text
Mission Mode
```

Recommended internal skill name:

```text
mission-control
```

---

## 2. Background From Discussion

The discussion covered two major topics:

1. **How Hermes Agent autonomous mode works when coding**
   - Persistent objective loop.
   - Context assembly.
   - Skill selection.
   - Tool execution.
   - Testing and verification.
   - Multi-agent / Kanban orchestration.
   - External coding-agent delegation.
   - Safety and approval model.

2. **A replacement name for `/goal`**
   - `/goal` was rejected because it already exists or is strongly associated with other agent systems.
   - `/mission` was selected as the best replacement.
   - Alternatives such as `/pursue`, `/drive`, `/quest`, and `/autopilot` were considered.

---

## 3. Core Concept

Mission Mode is a persistent autonomous execution loop.

A user gives the agent a durable objective. The agent then continues working across turns until one of these happens:

- The mission is completed.
- The mission is paused.
- The mission is aborted.
- The mission is blocked.
- The configured turn/step budget is reached.
- The user interrupts with new instructions.
- Verification fails repeatedly and escalation is required.

Example:

```text
/mission Fix the auth refresh bug, add regression tests, run CI checks, and stop only when verified.
```

---

## 4. Why `/mission`

`/mission` is the recommended replacement for `/goal`.

### Rationale

A mission implies:

- A persistent objective.
- Execution, not just planning.
- Progress tracking.
- Completion criteria.
- Autonomy.
- Verification.
- Possible failure, blocking, or escalation.

It is also more agent-native than `/goal`, while still being obvious to users.

### Example Usage

```text
/mission Refactor the billing service to use the new invoice schema, preserve compatibility, and run all billing tests.
```

```text
/mission Fix flaky login tests, identify root cause, patch the issue, and verify with 20 repeated runs.
```

```text
/mission Implement OAuth refresh token handling, add tests, run lint, and prepare a PR summary.
```

---

## 5. Naming System

Use the following naming system:

| Concept | Recommended Name |
|---|---|
| Slash command | `/mission` |
| Mode name | `Mission Mode` |
| Internal skill name | `mission-control` |
| Agent loop name | `Mission Loop` |
| State object | `Mission` |
| Worker role | `Mission Runner` |
| Verifier role | `Mission Judge` |
| Review stage | `Mission Review` |
| Log artifact | `Mission Log` |

---

## 6. Suggested Slash Commands

Primary command:

```text
/mission <objective>
```

Suggested subcommands:

```text
/mission status
/mission pause
/mission resume
/mission clear
/mission abort
/mission log
/mission verify
```

Optional advanced commands:

```text
/mission set-budget <n>
/mission add-criterion <criterion>
/mission remove-criterion <criterion-id>
/mission retry
/mission handoff
/mission export
```

---

## 7. Mission Lifecycle

Recommended state machine:

```text
created
  ↓
planning
  ↓
running
  ↓
verifying
  ↓
completed
```

Alternative terminal states:

```text
blocked
paused
aborted
failed
budget_exhausted
```

Full lifecycle:

```text
created → planning → running → verifying → completed
                         ↓          ↓
                      blocked     failed
                         ↓
                       paused
                         ↓
                      resumed
```

Recommended enum:

```ts
type MissionState =
  | "created"
  | "planning"
  | "running"
  | "verifying"
  | "completed"
  | "blocked"
  | "paused"
  | "aborted"
  | "failed"
  | "budget_exhausted";
```

---

## 8. Mission Loop

The autonomous loop should behave like this:

```text
User starts mission
  ↓
Store objective and acceptance criteria
  ↓
Assemble project and session context
  ↓
Select relevant skills
  ↓
Create plan / todo list
  ↓
Inspect repository
  ↓
Modify files
  ↓
Run targeted tests
  ↓
Run broader verification
  ↓
Review diff
  ↓
Judge whether mission is complete
  ↓
Continue, block, or complete
```

---

## 9. High-Level Agent Workflow

### Step 1: User sets a mission

Example:

```text
/mission Fix every failing test in tests/auth/ and make sure npm test passes for that directory.
```

The system should persist:

- Objective.
- Current state.
- Turn or step budget.
- Acceptance criteria.
- Progress log.
- Last action.
- Verification history.
- Files changed.
- Risks and blockers.

---

### Step 2: Context assembly

Before coding, the agent should gather relevant context.

Possible context sources:

| Context Source | Purpose |
|---|---|
| Repository files | Actual implementation details |
| Project instructions | Coding rules, architecture, conventions |
| Existing tests | Expected behavior |
| Prior session history | Previous attempts and decisions |
| Memory | Durable user/project preferences |
| Issue or PR metadata | External task context |
| Documentation | API and framework behavior |

For Hermes-like systems, context files discussed included:

```text
SOUL.md
.hermes.md
HERMES.md
AGENTS.md
CLAUDE.md
.cursorrules
.cursor/rules/*.mdc
```

For Codex, adapt this to whatever repository/context files the environment supports.

---

### Step 3: Skill selection

Mission Mode should select or activate skills based on the task.

Relevant coding skills discussed:

| Skill | Purpose |
|---|---|
| `plan` | Write a concrete implementation plan before coding |
| `spike` | Run exploratory experiments before committing to a solution |
| `test-driven-development` | Write failing tests first, then implementation |
| `systematic-debugging` | Find root cause before patching |
| `subagent-driven-development` | Break work into subtasks and delegate |
| `requesting-code-review` | Review diff, run checks, and fix issues |
| `claude-code` | Delegate to Claude Code CLI |
| `codex` | Delegate to OpenAI Codex CLI |
| `opencode` | Delegate to OpenCode CLI |
| `kanban-orchestrator` | Decompose work into board tasks |
| `kanban-worker` | Execute assigned Kanban task |
| `kanban-codex-lane` | Use Codex as an implementation lane |
| `github-code-review` | Review GitHub pull requests |
| `github-issues` | Work with GitHub issues |
| `github-pr-workflow` | Branch, commit, push, PR, and CI workflow |

For your implementation, these do not all need to exist immediately. Start with:

```text
mission-control
plan
systematic-debugging
test-driven-development
code-review
```

---

### Step 4: Planning

The agent should create a compact plan before modifying code.

Plan should include:

- Problem understanding.
- Files likely involved.
- Tests to run.
- Implementation steps.
- Verification criteria.
- Risk areas.
- Exit condition.

Example:

```markdown
## Mission Plan

Objective: Fix failing auth refresh tests.

Hypothesis:
The refresh token expiry logic is incorrectly using access token TTL.

Steps:
1. Inspect failing tests.
2. Reproduce failure.
3. Locate token expiry calculation.
4. Add regression test if missing.
5. Patch implementation.
6. Run targeted auth tests.
7. Run broader test suite if targeted tests pass.

Exit condition:
All auth tests pass and no unrelated diffs remain.
```

---

### Step 5: Execution

Mission Mode should execute work iteratively.

Typical coding actions:

- Read files.
- Search repository.
- Inspect tests.
- Reproduce failure.
- Patch files.
- Add or update tests.
- Run targeted checks.
- Run broader checks.
- Inspect git diff.
- Summarize changes.

Recommended loop:

```text
observe → decide → act → verify → reflect → continue
```

---

### Step 6: Verification

Verification should be explicit.

Possible verification levels:

| Level | Description |
|---|---|
| `none` | No verification performed |
| `static` | Typecheck/lint only |
| `targeted` | Relevant tests only |
| `broad` | Full test suite or major subset |
| `ci-ready` | Full local verification and PR-ready summary |

Mission Mode should not claim completion unless verification passes or the user explicitly allows best-effort completion.

Recommended completion rule:

```text
A mission is complete only when acceptance criteria are satisfied and verification has passed,
or when the final response clearly states what could not be verified.
```

---

### Step 7: Mission Judge

A Mission Judge decides whether to continue.

Inputs:

- Original objective.
- Acceptance criteria.
- Current state.
- Latest agent output.
- Files changed.
- Verification results.
- Known blockers.
- Remaining todo items.

Possible judge verdicts:

```text
continue
complete
blocked
failed
pause
```

Example judge output:

```json
{
  "verdict": "continue",
  "reason": "The implementation was patched, but the targeted tests have not passed yet.",
  "next_action": "Run tests/auth/refresh-token.test.ts and inspect failures."
}
```

---

## 10. Tool Model

Mission Mode needs tools that let it act.

Important tool categories:

| Tool Category | Role |
|---|---|
| Terminal | Run commands and tests |
| File read/write | Inspect and modify repository files |
| Patch | Apply precise edits |
| Process management | Monitor long-running commands |
| Todo tracking | Track internal progress |
| Memory/session search | Reuse past knowledge |
| Web/documentation search | Research APIs or dependencies |
| Delegation | Spawn isolated workers or subagents |
| Browser automation | Optional UI testing or docs research |
| Git/GitHub | Diff, branch, commit, PR, CI status |

Minimum viable toolset:

```text
read_file
search_files
patch_file
run_command
list_directory
get_git_diff
todo_update
```

---

## 11. External Agent Delegation

The discussion covered three external autonomous coding agents:

```text
Claude Code
OpenAI Codex
OpenCode
```

Mission Mode can either:

1. Code directly using its own tools.
2. Delegate subtasks to external agents.
3. Use external agents as implementation lanes while Mission Mode keeps ownership.

Important rule:

```text
Delegated agents are input lanes, not final authorities.
```

Mission Mode should still:

- Inspect the diff.
- Run verification.
- Check for scope creep.
- Summarize risks.
- Decide whether to accept, revise, or reject the delegated output.

---

## 12. Kanban / Multi-Agent Workflow

For larger tasks, Mission Mode can use Kanban-style decomposition.

Possible structure:

```text
Mission
  ├── Task 1: Reproduce bug
  ├── Task 2: Patch implementation
  ├── Task 3: Add regression tests
  ├── Task 4: Run verification
  └── Task 5: Prepare review summary
```

Task lifecycle:

```text
ready → running → blocked | done | archived
```

Worker responsibilities:

- Accept exactly one task.
- Work in an isolated context if possible.
- Report changed files.
- Report commands run.
- Report test results.
- Terminate with `complete` or `blocked`.

Reviewer responsibilities:

- Inspect diffs.
- Validate test claims.
- Catch incomplete work.
- Approve or send back for revision.

---

## 13. Safety Model

Autonomous coding should include safety controls.

Recommended controls:

| Control | Purpose |
|---|---|
| Command approval | Prevent dangerous shell actions |
| Sandbox | Isolate execution environment |
| Path restrictions | Prevent editing outside workspace |
| Destructive command blocklist | Stop catastrophic commands |
| Diff review | Catch unexpected changes |
| Budget limits | Prevent runaway loops |
| User interruption | Let user regain control |
| Network policy | Control external calls |
| Secret scanning | Prevent leaking credentials |

Suggested approval modes:

| Mode | Behavior |
|---|---|
| `manual` | User approves risky actions |
| `smart` | Model/risk classifier approves routine actions and prompts for risky ones |
| `off` / `yolo` | No prompts except hardline safety blocks |

Recommended default:

```yaml
approvals:
  mode: manual

sandbox:
  enabled: true

mission:
  default_budget: 20
  require_verification: true
```

---

## 14. Suggested Data Model

Example TypeScript-style model:

```ts
interface Mission {
  id: string;
  title: string;
  objective: string;
  state: MissionState;
  createdAt: string;
  updatedAt: string;

  budget: {
    maxTurns: number;
    turnsUsed: number;
    maxToolCalls?: number;
    maxRuntimeMinutes?: number;
  };

  criteria: MissionCriterion[];
  todos: MissionTodo[];
  log: MissionLogEntry[];
  verification: VerificationRecord[];

  filesChanged: string[];
  blockers: MissionBlocker[];
  risks: string[];

  lastAction?: string;
  nextAction?: string;
}

interface MissionCriterion {
  id: string;
  text: string;
  required: boolean;
  satisfied: boolean;
  evidence?: string;
}

interface MissionTodo {
  id: string;
  text: string;
  status: "pending" | "in_progress" | "done" | "blocked";
}

interface MissionLogEntry {
  timestamp: string;
  kind: "plan" | "action" | "tool" | "verification" | "judge" | "user" | "system";
  summary: string;
  details?: string;
}

interface VerificationRecord {
  timestamp: string;
  command?: string;
  result: "pass" | "fail" | "skipped" | "unknown";
  outputSummary?: string;
}

interface MissionBlocker {
  timestamp: string;
  reason: string;
  requestedInput?: string;
}
```

---

## 15. Suggested Command Behavior

### `/mission <objective>`

Creates and starts a new mission.

```text
/mission Fix failing checkout tests and verify with npm test -- checkout
```

Behavior:

1. Create mission object.
2. Extract objective.
3. Infer acceptance criteria.
4. Set state to `planning`.
5. Generate plan.
6. Begin execution.

---

### `/mission status`

Shows current mission state.

Example output:

```text
Mission: Fix failing checkout tests
State: running
Step: inspecting payment retry logic
Turns used: 4 / 20
Last verification: failed
Next action: patch duplicate retry scheduling
```

---

### `/mission pause`

Pauses the current mission.

```text
Mission paused.
State: paused
Last action: reproduced failing checkout retry test.
```

---

### `/mission resume`

Resumes a paused mission.

Behavior:

1. Reload mission state.
2. Reconstruct context.
3. Continue from next action.

---

### `/mission abort`

Stops the mission permanently.

Should include:

- Why it stopped.
- Last known progress.
- Files changed.
- Whether cleanup is needed.

---

### `/mission verify`

Runs or triggers explicit verification.

Example:

```text
/mission verify
```

Behavior:

1. Identify relevant verification commands.
2. Run targeted checks.
3. Update verification records.
4. Judge completion.

---

### `/mission log`

Shows mission history.

Should include:

- Plans.
- Tool actions.
- Commands run.
- Test results.
- Judge decisions.
- User interruptions.

---

## 16. UX Output Format

Recommended mission status block:

```markdown
## Mission Status

**Mission:** Fix flaky login tests  
**State:** running  
**Current step:** reproducing failure  
**Turns used:** 3 / 20  
**Last verification:** failed  
**Next action:** inspect session timeout handling  

### Completed
- Found failing test file.
- Reproduced failure locally.
- Identified timeout mismatch.

### Remaining
- Patch timeout calculation.
- Add regression test.
- Run targeted test 20 times.
```

Recommended completion block:

```markdown
## Mission Complete

**Objective:** Fix flaky login tests  
**Verification:** Passed  

### Changes
- Patched session timeout calculation.
- Added regression coverage for refresh edge case.

### Commands run
- `npm test -- login`
- `npm run lint`

### Files changed
- `src/auth/session.ts`
- `tests/auth/login.test.ts`

### Notes
No unresolved blockers.
```

Recommended blocked block:

```markdown
## Mission Blocked

**Objective:** Deploy migration safely  
**Reason:** Missing database credentials  

### Completed
- Generated migration.
- Added unit tests.
- Verified migration compiles.

### Needed
Provide a staging database connection or approve skipping live migration validation.
```

---

## 17. Names Considered

| Command | Quality | Meaning | Notes |
|---|---:|---|---|
| `/mission` | 5/5 | Long-running autonomous objective | Best overall |
| `/pursue` | 5/5 | Keep working toward an outcome | Active verb |
| `/drive` | 4/5 | Push task forward autonomously | Short and strong |
| `/quest` | 4/5 | Long-running task with completion | More playful |
| `/autopilot` | 4/5 | Hands-off autonomous execution | Clear but longer |
| `/campaign` | 3/5 | Multi-step initiative | Better for large projects |
| `/execute` | 3/5 | Run until done | Direct but generic |
| `/pact` | 3/5 | Agent commits to criteria | Distinctive but less obvious |
| `/pursuit` | 3/5 | Durable pursuit of a result | Good noun, less command-like |
| `/odyssey` | 2/5 | Long autonomous journey | Too poetic for coding |

---

## 18. Names to Avoid

| Avoid | Reason |
|---|---|
| `/goal` | Already associated with existing durable-objective agent flows |
| `/task` | Sounds like one unit, not an autonomous loop |
| `/plan` | Usually means planning only |
| `/agent` | Too broad |
| `/auto` | Too vague |
| `/loop` | Technically accurate but not user-friendly |
| `/work` | Too plain |
| `/run` | Usually means execute once |
| `/objective` | Too close to `/goal` |
| `/autonomous` | Too long as a slash command |

---

## 19. MVP Implementation Plan

### MVP Scope

Implement:

```text
/mission <objective>
/mission status
/mission pause
/mission resume
/mission abort
/mission log
/mission verify
```

Minimum state:

```text
objective
state
budget
todos
log
verification results
files changed
next action
```

Minimum loop:

```text
plan → act → verify → judge → continue/complete/block
```

Minimum safety:

```text
turn budget
command approval
workspace-only file edits
verification requirement
user interrupt support
```

---

## 20. Suggested Codex Prompt

Use this prompt to start implementation in Codex:

```text
Implement Mission Mode as a replacement for /goal.

Mission Mode should expose:
/mission <objective>
/mission status
/mission pause
/mission resume
/mission abort
/mission log
/mission verify

The system should persist a Mission object with:
- id
- objective
- state
- budget
- criteria
- todos
- log
- verification records
- filesChanged
- blockers
- lastAction
- nextAction

Mission lifecycle:
created → planning → running → verifying → completed
with terminal/alternate states:
blocked, paused, aborted, failed, budget_exhausted.

The autonomous loop should:
1. Store objective and inferred acceptance criteria.
2. Assemble project context.
3. Create a plan.
4. Execute coding actions.
5. Run verification.
6. Use a Mission Judge to decide: continue, complete, blocked, failed, or pause.
7. Continue until complete, blocked, paused, aborted, or budget exhausted.

Completion should require passing verification unless explicitly marked best-effort.

Add tests for:
- creating a mission
- status output
- pause/resume
- abort
- budget exhaustion
- verification pass/fail
- judge verdict handling
- persistence and reload
```

---

## 21. Implementation Checklist

### Command parser

- [ ] Parse `/mission <objective>`.
- [ ] Parse subcommands.
- [ ] Validate unknown subcommands.
- [ ] Prevent starting duplicate active missions unless allowed.

### Persistence

- [ ] Store mission state.
- [ ] Reload mission state.
- [ ] Persist logs.
- [ ] Persist verification records.
- [ ] Persist pause/resume status.

### Loop engine

- [ ] Start planning turn.
- [ ] Execute next action.
- [ ] Record tool results.
- [ ] Run verification.
- [ ] Invoke judge.
- [ ] Continue or stop based on verdict.

### Judge

- [ ] Accept objective and criteria.
- [ ] Accept latest state.
- [ ] Return structured verdict.
- [ ] Explain reason.
- [ ] Suggest next action.

### Verification

- [ ] Detect relevant test command.
- [ ] Run targeted test.
- [ ] Record result.
- [ ] Require pass before completion.
- [ ] Support manual best-effort completion.

### Safety

- [ ] Enforce budget.
- [ ] Allow interruption.
- [ ] Prompt for risky commands.
- [ ] Restrict workspace writes.
- [ ] Block destructive commands.
- [ ] Summarize unverified changes honestly.

### UX

- [ ] Clear mission status output.
- [ ] Clear completion output.
- [ ] Clear blocked output.
- [ ] Clear verification output.
- [ ] Clear mission log output.

---

## 22. Open Design Questions

Resolve these while implementing:

1. Can multiple missions run at once, or only one active mission per session?
2. Should `/mission <objective>` replace an active mission or reject until paused/aborted?
3. Is verification mandatory by default?
4. How should the system infer test commands?
5. Should the Mission Judge be a separate model call or deterministic rule engine?
6. Should mission logs be user-visible by default?
7. Should mission state be stored per project, per session, or globally?
8. Should external agents be allowed in the MVP?
9. What is the default turn budget?
10. What is the recovery behavior after crash/restart?

---

## 23. Recommended Defaults

```yaml
mission:
  command: "/mission"
  mode_name: "Mission Mode"
  internal_skill: "mission-control"
  default_budget_turns: 20
  allow_multiple_active: false
  require_verification_for_completion: true
  allow_best_effort_completion: true
  default_state: "created"

safety:
  approvals: "manual"
  sandbox: true
  workspace_write_only: true
  destructive_command_blocklist: true

verification:
  prefer_targeted_tests: true
  run_broad_tests_before_completion: false
  record_commands: true

logging:
  persist_mission_log: true
  show_status_after_each_turn: true
```

---

## 24. One-Sentence Product Description

Mission Mode lets a coding agent take a durable objective, keep working across turns, verify its own progress, and stop only when the mission is complete, blocked, paused, aborted, or out of budget.

---

## 25. Final Recommendation

Build the autonomous flow around:

```text
/mission
```

Use:

```text
Mission Mode
mission-control
Mission Loop
Mission Judge
Mission Runner
```

Avoid:

```text
/goal
```

because it overlaps with existing agent command vocabulary and is less distinctive for a new autonomous coding workflow.
