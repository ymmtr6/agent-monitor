import path from "node:path";
import fs from "node:fs";
import chokidar from "chokidar";
import { sessionStore } from "../store/sessionStore.js";
import { CODEX_SESSIONS_DIR, STARTUP_LOOKBACK_MS } from "../config.js";
import { markOffsetAtEnd, readNewLines, readTailLines } from "../lib/jsonlTail.js";
import { parseCodexTotals } from "../store/tokenUsage.js";

interface CodexRow {
  type?: "session_meta" | "event_msg" | "response_item" | "turn_context";
  timestamp?: string;
  payload?: {
    type?: string;
    id?: string;
    cwd?: string;
    name?: string; // function_call name
    message?: string;
    role?: string;
    info?: { total_token_usage?: unknown };
  };
}

const ROLLOUT_ID_RE = /rollout-.*-([0-9a-f-]{36})\.jsonl$/i;

function fallbackSessionId(filePath: string): string {
  const match = ROLLOUT_ID_RE.exec(path.basename(filePath));
  return match ? match[1] : path.basename(filePath, ".jsonl");
}

const RUNNING_EVENTS = new Set([
  "task_started",
  "user_message",
  "exec_command_begin",
  "patch_apply_begin",
  "mcp_tool_call_begin",
  "agent_reasoning",
]);
const WAITING_EVENTS = new Set(["task_complete", "turn_complete", "agent_message"]);
const ATTENTION_EVENTS = new Set(["error", "stream_error"]);

function applyRow(fileSessionId: string, row: CodexRow): string {
  let sessionId = fileSessionId;

  if (row.type === "session_meta" && row.payload) {
    sessionId = row.payload.id ?? fileSessionId;
    sessionStore.upsert({
      id: sessionId,
      agentType: "codex",
      projectPath: row.payload.cwd,
      status: "waiting_input",
      source: "file",
    });
    return sessionId;
  }

  if (row.type === "event_msg" && row.payload?.type) {
    const kind = row.payload.type;
    if (kind === "token_count") {
      const totals = parseCodexTotals(row.payload.info?.total_token_usage);
      if (totals) sessionStore.updateTokens(sessionId, totals, true);
      return sessionId;
    }
    if (ATTENTION_EVENTS.has(kind)) {
      sessionStore.upsert({ id: sessionId, status: "needs_attention", currentActivity: kind, source: "file" });
    } else if (RUNNING_EVENTS.has(kind)) {
      sessionStore.upsert({ id: sessionId, status: "running", currentActivity: kind, source: "file" });
    } else if (WAITING_EVENTS.has(kind)) {
      sessionStore.upsert({ id: sessionId, status: "waiting_input", currentActivity: "入力待ち", source: "file" });
    } else {
      sessionStore.upsert({ id: sessionId, source: "file" });
    }
    return sessionId;
  }

  if (row.type === "response_item" && row.payload?.type === "function_call") {
    sessionStore.upsert({
      id: sessionId,
      status: "running",
      currentActivity: `Tool: ${row.payload.name ?? "unknown"}`,
      source: "file",
    });
    return sessionId;
  }

  return sessionId;
}

function processLines(fileSessionId: string, lines: string[]): void {
  let sessionId = fileSessionId;
  for (const line of lines) {
    try {
      sessionId = applyRow(sessionId, JSON.parse(line) as CodexRow);
    } catch {
      // partial/malformed line; skip
    }
  }
}

function isRolloutFile(filePath: string): boolean {
  return filePath.endsWith(".jsonl") && path.basename(filePath).startsWith("rollout-");
}

export function startCodexFileWatcher(): void {
  if (!fs.existsSync(CODEX_SESSIONS_DIR)) return;

  // chokidar 4 dropped built-in glob support; watch the YYYY/MM/DD tree (depth 3)
  // and filter to rollout-*.jsonl files in the handlers.
  const watcher = chokidar.watch(CODEX_SESSIONS_DIR, {
    ignoreInitial: false,
    depth: 3,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
  });

  watcher.on("add", (filePath) => {
    if (!isRolloutFile(filePath)) return;
    const sessionId = fallbackSessionId(filePath);
    let mtimeMs = 0;
    try {
      mtimeMs = fs.statSync(filePath).mtimeMs;
    } catch {
      return;
    }
    const isRecent = Date.now() - mtimeMs < STARTUP_LOOKBACK_MS;
    if (!isRecent) {
      markOffsetAtEnd(filePath);
      return;
    }
    const lines = readTailLines(filePath, 300);
    sessionStore.upsert({ id: sessionId, agentType: "codex", status: "waiting_input", source: "file", startedAt: mtimeMs });
    processLines(sessionId, lines);
  });

  watcher.on("change", (filePath) => {
    if (!isRolloutFile(filePath)) return;
    const sessionId = fallbackSessionId(filePath);
    const lines = readNewLines(filePath);
    if (lines.length === 0) return;
    processLines(sessionId, lines);
  });
}
