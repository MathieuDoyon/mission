import { readLog } from "../state.js";

export function log(id: string): void {
  const events = readLog(id);
  for (const e of events) {
    console.log(`[${e.at}] step=${e.step} ${e.kind} ${JSON.stringify(e.data)}`);
  }
}
