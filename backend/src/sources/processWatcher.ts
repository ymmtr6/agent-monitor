import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { sessionStore } from "../store/sessionStore.js";
import { PROCESS_SCAN_INTERVAL_MS } from "../config.js";

const execFileAsync = promisify(execFile);

let claudeAlive = true;
let codexAlive = true;

/**
 * We can't reliably map a `ps` entry to a specific session id (no session id in argv),
 * so this only answers "is at least one claude/codex process alive" and is used as a
 * coarse fallback signal for the stale-session sweep — precise per-session lifecycle
 * comes from ClaudeCode hooks (SessionEnd) and, for both tools, file-write recency.
 */
async function scan(): Promise<void> {
  try {
    const { stdout } = await execFileAsync("ps", ["-axo", "command"]);
    const lines = stdout.split("\n");
    claudeAlive = lines.some((line) => /(^|\/)claude(\s|$)/.test(line.trim()));
    codexAlive = lines.some((line) => /(^|\/)codex(\s|$)/.test(line.trim()));
  } catch {
    claudeAlive = true;
    codexAlive = true;
  }

  for (const session of sessionStore.list()) {
    if (session.status === "ended") continue;
    const alive = session.agentType === "claude" ? claudeAlive : codexAlive;
    sessionStore.touchProcessAlive(session.id, alive, null);
  }
}

export function startProcessWatcher(): void {
  void scan();
  setInterval(() => void scan(), PROCESS_SCAN_INTERVAL_MS);
}
