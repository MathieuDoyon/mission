import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MARKER = "MISSION-SPIKE:";

export interface SpikeHit {
  file: string;
  line: number;
  text: string;
  missionId: string;
  shortName: string;
}

function gitGrep(missionId: string): SpikeHit[] {
  const pattern = `${MARKER} ${missionId}`;
  let stdout = "";
  try {
    stdout = execSync(`git grep -nF "${pattern}" -- ":!.mission"`, { encoding: "utf8" });
  } catch {
    return [];
  }
  const hits: SpikeHit[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    // Format: <file>:<line>:<content>
    const m = line.match(/^([^:]+):(\d+):(.*)$/);
    if (!m) continue;
    const [, file, lineNum, content] = m;
    const markerIdx = content!.indexOf(MARKER);
    const after = content!.slice(markerIdx + MARKER.length).trim();
    const [_id, ...rest] = after.split(/\s+/);
    hits.push({
      file: file!,
      line: Number(lineNum),
      text: content!.trim(),
      missionId,
      shortName: rest.join(" "),
    });
  }
  return hits;
}

export function spikeList(missionId: string): void {
  if (!missionId) {
    console.error("usage: mission spike list <mission-id>");
    process.exit(1);
  }
  const hits = gitGrep(missionId);
  if (hits.length === 0) {
    console.log(`(no MISSION-SPIKE markers for ${missionId})`);
    return;
  }
  console.log(`found ${hits.length} marker(s) for ${missionId}:`);
  for (const h of hits) {
    console.log(`  ${h.file}:${h.line}  spike=${h.shortName || "(unnamed)"}`);
  }
}

export interface PromoteOpts {
  dryRun?: boolean;
}

export function spikePromote(missionId: string, opts: PromoteOpts = {}): void {
  if (!missionId) {
    console.error("usage: mission spike promote <mission-id> [--dry-run]");
    process.exit(1);
  }
  const hits = gitGrep(missionId);
  if (hits.length === 0) {
    console.log(`(no MISSION-SPIKE markers for ${missionId}); nothing to promote`);
    return;
  }

  // Group hits by file so we rewrite each file once.
  const byFile = new Map<string, SpikeHit[]>();
  for (const h of hits) {
    const list = byFile.get(h.file) ?? [];
    list.push(h);
    byFile.set(h.file, list);
  }

  console.log(`${opts.dryRun ? "[dry-run] " : ""}promoting ${hits.length} marker(s) across ${byFile.size} file(s):`);
  for (const [file, fileHits] of byFile) {
    if (!existsSync(file)) {
      console.log(`  ${file}  (skipped — file not found)`);
      continue;
    }
    const original = readFileSync(file, "utf8");
    const lines = original.split("\n");
    let removed = 0;
    for (const h of fileHits) {
      const idx = h.line - 1;
      if (idx < 0 || idx >= lines.length) continue;
      if (lines[idx]!.includes(`${MARKER} ${missionId}`)) {
        // Strip just the marker comment line. If the entire line is the marker, drop the line;
        // if the marker is embedded in something else, strip the marker token only.
        const trimmed = lines[idx]!.trim();
        const isWholeLine = /^[\s/*#-]*MISSION-SPIKE:/.test(trimmed);
        if (isWholeLine) {
          lines.splice(idx - removed, 1);
          removed += 1;
        } else {
          lines[idx] = lines[idx]!.replace(new RegExp(`\\s*${MARKER}\\s+${missionId}.*$`), "");
        }
      }
    }
    console.log(`  ${file}  (${fileHits.length} marker(s) removed)`);
    if (!opts.dryRun) writeFileSync(file, lines.join("\n"));
  }
  if (opts.dryRun) {
    console.log(`[dry-run] no files written. Re-run without --dry-run to apply.`);
  } else {
    console.log(`done. review with: git diff`);
  }
}
