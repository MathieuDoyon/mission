import { execSync } from "node:child_process";
import { readConfig, type AgentConfig } from "../config.js";

export type AgentName = "pi" | "codex" | "opencode";

const AGENT_NAMES: AgentName[] = ["pi", "codex", "opencode"];

function findBinary(name: string): string | null {
  try {
    const out = execSync(`command -v ${name}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const path = out.trim();
    return path || null;
  } catch {
    return null;
  }
}

interface AgentReport {
  name: AgentName;
  config: AgentConfig;
  binaryPath: string | null;
}

function reportAll(): AgentReport[] {
  const cfg = readConfig();
  return AGENT_NAMES.map((name) => ({
    name,
    config: cfg.agents[name],
    binaryPath: findBinary(name),
  }));
}

export function agentsList(): void {
  const reports = reportAll();
  const out = reports.map((r) => ({
    name: r.name,
    available: r.config.available,
    model: r.config.model,
    binaryPath: r.binaryPath,
    usable: r.config.available && r.binaryPath !== null,
  }));
  console.log(JSON.stringify({ agents: out }, null, 2));
}

export function agentsCheck(name: string): void {
  if (!AGENT_NAMES.includes(name as AgentName)) {
    console.error(`unknown agent: ${name}. expected one of: ${AGENT_NAMES.join(", ")}`);
    process.exit(1);
  }
  const cfg = readConfig();
  const a = cfg.agents[name as AgentName];
  const binaryPath = findBinary(name);
  const issues: string[] = [];
  if (!a.available) issues.push("config.agents." + name + ".available is false");
  if (!binaryPath) issues.push(`no '${name}' binary on PATH (\`command -v ${name}\` returned nothing)`);
  if (a.available && !a.model) issues.push(`config.agents.${name}.model is null — set a model id or "default"`);

  const result = {
    name,
    available: a.available,
    model: a.model,
    binaryPath,
    usable: issues.length === 0,
    issues,
  };
  console.log(JSON.stringify(result, null, 2));
  if (issues.length > 0) process.exit(1);
}

export function pickFirstUsableAgent(): AgentName | null {
  for (const r of reportAll()) {
    if (r.config.available && r.binaryPath !== null) return r.name;
  }
  return null;
}
