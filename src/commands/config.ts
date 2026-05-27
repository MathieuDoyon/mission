import { readConfig, initConfigIfMissing, setConfigKey, configPath } from "../config.js";

export function configShow(): void {
  console.log(JSON.stringify(readConfig(), null, 2));
}

export function configInit(): void {
  const { created, path } = initConfigIfMissing();
  if (created) {
    console.log(`wrote default config to ${path}`);
  } else {
    console.log(`config already exists at ${path}`);
  }
}

export function configSet(key: string, value: string): void {
  if (!key || value === undefined) {
    console.error("usage: mission config set <dotted.key> <value>");
    process.exit(1);
  }
  try {
    const cfg = setConfigKey(key, value);
    console.log(`set ${key} = ${JSON.stringify(getDotted(cfg, key))}`);
    console.log(`config: ${configPath()}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

function getDotted(obj: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object" && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}
