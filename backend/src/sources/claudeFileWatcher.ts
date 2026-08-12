import path from "node:path";
import fs from "node:fs";
import chokidar from "chokidar";
import { sessionStore } from "../store/sessionStore.js";
import { CLAUDE_PROJECTS_DIR, STARTUP_LOOKBACK_MS } from "../config.js";
import { markOffsetAtEnd, readNewLines, readTailLines } from "../lib/jsonlTail.js";
import { parseClaudeUsage } from "../store/tokenUsage.js";

interface ContentPart {
  type?: string;
  text?: string;
  name?: string;
  id?: string;
  tool_use_id?: string;
  input?: { description?: string; prompt?: string; subagent_type?: string; run_in_background?: boolean };
}

interface ClaudeRow {
  type?: string;
  timestamp?: string;
  cwd?: string;
  gitBranch?: string;
  isSidechain?: boolean;
  message?: { role?: string; content?: string | ContentPart[]; usage?: unknown };
}

// The subagent-spawning tool is named "Task" in the public ClaudeCode CLI, but some
// harness builds (observed on this machine) rename it to "Agent". Match both so
// subagent detection keeps working across CLI versions.
const SUBAGENT_TOOL_NAMES = new Set(["Task", "Agent"]);

function sessionIdFromPath(filePath: string): string {
  return path.basename(filePath, ".jsonl");
}

function partsOf(row: ClaudeRow): ContentPart[] {
  const content = row.message?.content;
  if (!content) return [];
  if (typeof content === "string") return [{ type: "text", text: content }];
  return content;
}

/** Applies a single parsed jsonl row to the session store, updating status heuristically. */
function applyRow(sessionId: string, row: ClaudeRow): void {
  if (!row || typeof row !== "object") return;

  if (row.cwd || row.gitBranch) {
    sessionStore.upsert({
      id: sessionId,
      agentType: "claude",
      projectPath: row.cwd,
      gitBranch: row.gitBranch ?? undefined,
      source: "file",
    });
  }

  const role = row.message?.role;
  const parts = partsOf(row);

  // Counted before the sidechain bail-out so subagent turns roll up into the parent session.
  if (row.type === "assistant") {
    const usage = parseClaudeUsage(row.message?.usage);
    if (usage) sessionStore.updateTokens(sessionId, usage, false);
  }

  if (row.isSidechain) {
    // Subagent's own transcript line; keep its badge fresh but don't drive parent status here
    // (parent status is driven by the Task tool_use/tool_result pair below).
    return;
  }

  if (row.type === "user" && role === "user") {
    const toolResults = parts.filter((p) => p.type === "tool_result" && p.tool_use_id);
    if (toolResults.length > 0) {
      const session = sessionStore.get(sessionId);
      for (const result of toolResults) {
        // Only a subagent-ending signal if this tool_use_id was previously registered
        // as a Task-spawned subagent — every ordinary tool call also produces a
        // tool_result, so we must not treat all of them as subagent completions.
        const subagent = result.tool_use_id ? session?.subagents[result.tool_use_id] : undefined;
        // A background agent answers immediately with "launched"; it ends via SubagentStop.
        if (subagent && !subagent.background) {
          sessionStore.upsertSubagent(sessionId, { id: result.tool_use_id!, status: "ended" });
        }
      }
      sessionStore.upsert({ id: sessionId, status: "running", currentActivity: "処理中", source: "file" });
      return;
    }
    const hasRealText = parts.some((p) => p.type === "text" && p.text && p.text.trim().length > 0);
    if (hasRealText) {
      sessionStore.upsert({ id: sessionId, status: "running", currentActivity: "考え中...", source: "file" });
    }
    return;
  }

  if (row.type === "assistant" && role === "assistant") {
    const toolUses = parts.filter((p) => p.type === "tool_use");
    if (toolUses.length > 0) {
      // A single assistant message can contain several parallel tool_use blocks
      // (e.g. multiple Task calls spawning several subagents at once).
      const spawned = toolUses.filter((p) => p.name && SUBAGENT_TOOL_NAMES.has(p.name) && p.id);
      for (const toolUse of spawned) {
        const desc = toolUse.input?.description || toolUse.input?.subagent_type || "subagent";
        sessionStore.upsertSubagent(sessionId, {
          id: toolUse.id!,
          description: desc,
          status: "running",
          subagentType: toolUse.input?.subagent_type ?? null,
          background: toolUse.input?.run_in_background === true,
        });
      }

      if (spawned.length > 0) {
        // upsertSubagent already promoted the session to subagent_active — sending
        // `running` here would immediately knock it back out of that column.
        sessionStore.upsert({
          id: sessionId,
          currentActivity: `サブエージェント ${spawned.length}件 起動`,
          source: "file",
        });
        return;
      }

      const lastToolName = toolUses[toolUses.length - 1]?.name ?? "unknown";
      sessionStore.upsert({
        id: sessionId,
        status: "running",
        currentActivity: `Tool: ${lastToolName}`,
        source: "file",
      });
      return;
    }
    const hasText = parts.some((p) => p.type === "text" && p.text && p.text.trim().length > 0);
    if (hasText) {
      sessionStore.upsert({ id: sessionId, status: "waiting_input", currentActivity: "入力待ち", source: "file" });
    }
    return;
  }
}

function processLines(sessionId: string, lines: string[]): void {
  for (const line of lines) {
    try {
      applyRow(sessionId, JSON.parse(line) as ClaudeRow);
    } catch {
      // partial/malformed line (e.g. mid-write); skip
    }
  }
}

export function startClaudeFileWatcher(): void {
  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return;

  // chokidar 4 dropped built-in glob support, so we watch the directory tree
  // (project-slug/*.jsonl, depth 1) and filter by extension in the handlers.
  const watcher = chokidar.watch(CLAUDE_PROJECTS_DIR, {
    ignoreInitial: false,
    depth: 1,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
  });

  watcher.on("add", (filePath) => {
    if (!filePath.endsWith(".jsonl")) return;
    const sessionId = sessionIdFromPath(filePath);
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
    sessionStore.upsert({
      id: sessionId,
      agentType: "claude",
      status: "waiting_input",
      source: "file",
      startedAt: mtimeMs,
    });
    processLines(sessionId, lines);
  });

  watcher.on("change", (filePath) => {
    if (!filePath.endsWith(".jsonl")) return;
    const sessionId = sessionIdFromPath(filePath);
    const lines = readNewLines(filePath);
    if (lines.length === 0) return;
    processLines(sessionId, lines);
  });
}
