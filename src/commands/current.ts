import { getCurrent } from "../state.js";

export function current(): void {
  const id = getCurrent();
  if (!id) {
    console.log("(no active mission)");
    process.exitCode = 1;
    return;
  }
  console.log(id);
}
