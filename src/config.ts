import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface AgentConfig {
  available: boolean;
  model: string | null;
}

export interface MissionConfig {
  version: 1;
  spike: { commit: boolean };
  budget: { maxTurns: number };
  agents: {
    pi: AgentConfig;
    codex: AgentConfig;
    opencode: AgentConfig;
  };
}

export const DEFAULT_CONFIG: MissionConfig = {
  version: 1,
  spike: { commit: true },
  budget: { maxTurns: 20 },
  agents: {
    pi: { available: false, model: null },
    codex: { available: false, model: null },
    opencode: { available: false, model: null },
  },
};

export function configPath(): string {
  return join(homedir(), ".mission", "config.json");
}

export function configExists(): boolean {
  return existsSync(configPath());
}

export function readConfig(): MissionConfig {
  const path = configPath();
  if (!existsSync(path)) return structuredClone(DEFAULT_CONFIG);
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as Partial<MissionConfig>;
  return mergeWithDefaults(parsed);
}

export function writeConfig(cfg: MissionConfig): void {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  renameSync(tmp, path);
}

export function initConfigIfMissing(): { created: boolean; path: string } {
  const path = configPath();
  if (existsSync(path)) return { created: false, path };
  writeConfig(structuredClone(DEFAULT_CONFIG));
  return { created: true, path };
}

export function setConfigKey(dottedKey: string, rawValue: string): MissionConfig {
  const cfg = readConfig();
  const parts = dottedKey.split(".");
  // Narrow walk; we don't allow creating new keys, only mutating known ones.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = cfg;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    if (!(k in cursor)) throw new Error(`unknown config key: ${dottedKey}`);
    cursor = cursor[k];
  }
  const leaf = parts[parts.length - 1]!;
  if (!(leaf in cursor)) throw new Error(`unknown config key: ${dottedKey}`);
  cursor[leaf] = coerce(rawValue);
  writeConfig(cfg);
  return cfg;
}

function coerce(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw;
}

function mergeWithDefaults(partial: Partial<MissionConfig>): MissionConfig {
  const merged: MissionConfig = structuredClone(DEFAULT_CONFIG);
  if (partial.spike?.commit !== undefined) merged.spike.commit = partial.spike.commit;
  if (partial.budget?.maxTurns !== undefined) merged.budget.maxTurns = partial.budget.maxTurns;
  if (partial.agents) {
    for (const name of ["pi", "codex", "opencode"] as const) {
      const a = partial.agents[name];
      if (a) {
        merged.agents[name].available = a.available ?? merged.agents[name].available;
        merged.agents[name].model = a.model ?? merged.agents[name].model;
      }
    }
  }
  return merged;
}
