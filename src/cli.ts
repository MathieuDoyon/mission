#!/usr/bin/env node
import { start } from "./commands/start.js";
import { status } from "./commands/status.js";
import { pause } from "./commands/pause.js";
import { resume } from "./commands/resume.js";
import { abort } from "./commands/abort.js";
import { log } from "./commands/log.js";
import { verify } from "./commands/verify.js";
import { steer } from "./commands/steer.js";
import { pending } from "./commands/pending.js";
import { step } from "./commands/step.js";
import { current } from "./commands/current.js";
import { configShow, configInit, configSet } from "./commands/config.js";
import { spikeList, spikePromote } from "./commands/spike.js";
import { taskAdd, taskList, taskMove, taskBlock, taskWorktree } from "./commands/task.js";
import { agentsList, agentsCheck } from "./commands/agents.js";
import { getCurrent } from "./state.js";

const USAGE = `usage:
  mission start <objective> [--max-turns N]
                                      create mission (default budget: 20 turns)
  mission status  [id]                show status
  mission pending [id]                print {status, budget, pending[]} as JSON
  mission step    [id] <summary> [--done]
                                      record one Claude turn; auto-applies pending steers,
                                      flips to budget_exhausted when turnsUsed >= maxTurns
  mission pause   [id]                request pause after current step
  mission resume  [id]                flip paused → running
  mission abort   [id]                abort
  mission log     [id]                print event log
  mission verify  [id]                integrity check
  mission steer   [id] <text>         queue a steer (applies at next step)
  mission current                     print active mission id

  mission config show                 print resolved user config (~/.mission/config.json)
  mission config init                 write default config file if missing
  mission config set <key> <value>    mutate a dotted key (e.g. spike.commit false,
                                      agents.pi.available true, agents.pi.model "pi-base")

  mission spike list <mission-id>     list all MISSION-SPIKE markers in the source tree
  mission spike promote <mission-id> [--dry-run]
                                      strip markers from source files (does NOT commit)

  mission task add "<text>" [--worktree]
                                      add a kanban task to the active mission
  mission task list                   show ready/wip/blocked/done groups
  mission task move <task-id> <ready|wip|blocked|done>
                                      transition a task's status
  mission task done <task-id>         alias for move <task-id> done
  mission task block <task-id> <reason>
                                      move task to blocked with a reason
  mission task worktree <task-id> <path>
                                      record the worktree path orchestrator created

  mission agents list                 print resolved agent config + binary discovery as JSON
  mission agents check <name>         probe one agent (pi|codex|opencode); exit non-zero if unusable`;

function main(argv: string[]): void {
  const [cmd, ...rest] = argv;
  if (!cmd) {
    console.log(USAGE);
    process.exit(1);
  }

  switch (cmd) {
    case "start": {
      const { maxTurns, positional } = parseStartFlags(rest);
      return start(positional.join(" "), { maxTurns });
    }
    case "current": return current();
    case "config": {
      const sub = rest[0];
      switch (sub) {
        case "show": return configShow();
        case "init": return configInit();
        case "set": return configSet(rest[1] ?? "", rest[2] ?? "");
        default:
          console.error(`unknown config subcommand: ${sub ?? "(none)"}`);
          console.error("expected: show | init | set <key> <value>");
          process.exit(1);
      }
    }
    case "spike": {
      const sub = rest[0];
      const id = rest[1] ?? "";
      const dryRun = rest.includes("--dry-run");
      switch (sub) {
        case "list": return spikeList(id);
        case "promote": return spikePromote(id, { dryRun });
        default:
          console.error(`unknown spike subcommand: ${sub ?? "(none)"}`);
          console.error("expected: list <mission-id> | promote <mission-id> [--dry-run]");
          process.exit(1);
      }
    }
    case "agents": {
      const sub = rest[0];
      switch (sub) {
        case "list": return agentsList();
        case "check": {
          const name = rest[1];
          if (!name) {
            console.error("usage: mission agents check <pi|codex|opencode>");
            process.exit(1);
          }
          return agentsCheck(name);
        }
        default:
          console.error(`unknown agents subcommand: ${sub ?? "(none)"}`);
          console.error("expected: list | check <name>");
          process.exit(1);
      }
    }
    case "task": {
      const sub = rest[0];
      const missionId = getCurrent();
      if (!missionId) {
        console.error("no active mission; start one with `mission start <objective>`");
        process.exit(1);
      }
      const args = rest.slice(1);
      switch (sub) {
        case "list":
          return taskList(missionId);
        case "add": {
          const worktree = args.includes("--worktree");
          const text = args.filter((a) => a !== "--worktree").join(" ");
          if (!text) {
            console.error('usage: mission task add "<text>" [--worktree]');
            process.exit(1);
          }
          return taskAdd(missionId, text, worktree);
        }
        case "move": {
          const taskId = args[0];
          const to = args[1];
          if (!taskId || !to) {
            console.error("usage: mission task move <task-id> <ready|wip|blocked|done>");
            process.exit(1);
          }
          return taskMove(missionId, taskId, to);
        }
        case "done": {
          const taskId = args[0];
          if (!taskId) {
            console.error("usage: mission task done <task-id>");
            process.exit(1);
          }
          return taskMove(missionId, taskId, "done");
        }
        case "block": {
          const taskId = args[0];
          const reason = args.slice(1).join(" ");
          if (!taskId || !reason) {
            console.error("usage: mission task block <task-id> <reason>");
            process.exit(1);
          }
          return taskBlock(missionId, taskId, reason);
        }
        case "worktree": {
          const taskId = args[0];
          const path = args[1];
          if (!taskId || !path) {
            console.error("usage: mission task worktree <task-id> <path>");
            process.exit(1);
          }
          return taskWorktree(missionId, taskId, path);
        }
        default:
          console.error(`unknown task subcommand: ${sub ?? "(none)"}`);
          console.error("expected: add | list | move | done | block | worktree");
          process.exit(1);
      }
    }
    case "status": return status(requireId(rest));
    case "pending": return pending(requireId(rest));
    case "pause": return pause(requireId(rest));
    case "resume": return resume(requireId(rest));
    case "abort": return abort(requireId(rest));
    case "log": return log(requireId(rest));
    case "verify": return verify(requireId(rest));
    case "steer": {
      const id = requireId(rest);
      return steer(id, rest.slice(1).join(" "));
    }
    case "step": {
      const id = requireId(rest);
      const args = rest.slice(1);
      const done = args.includes("--done");
      const summary = args.filter((a) => a !== "--done").join(" ");
      if (!summary) {
        console.error("mission step requires a summary");
        process.exit(1);
      }
      return step(id, { summary, done });
    }
    case "help":
    case "--help":
    case "-h":
      console.log(USAGE);
      return;
    default:
      console.error(`unknown command: ${cmd}`);
      console.log(USAGE);
      process.exit(1);
  }
}

function parseStartFlags(args: string[]): { maxTurns?: number; positional: string[] } {
  const positional: string[] = [];
  let maxTurns: number | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--max-turns") {
      const v = args[++i];
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) {
        console.error(`--max-turns requires a positive integer, got: ${v}`);
        process.exit(1);
      }
      maxTurns = n;
    } else {
      positional.push(a);
    }
  }
  return { maxTurns, positional };
}

function looksLikeId(s: string | undefined): boolean {
  return !!s && /^m_[a-f0-9]+$/.test(s);
}

function requireId(args: string[]): string {
  const first = args[0];
  if (looksLikeId(first)) return first!;
  const cur = getCurrent();
  if (cur) {
    // Insert the resolved id at the front so downstream parsing (e.g. steer text) still works.
    args.unshift(cur);
    return cur;
  }
  console.error("no active mission; pass an id explicitly or start one with `mission start <objective>`");
  process.exit(1);
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
