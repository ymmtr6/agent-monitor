import { sessionStore } from "../store/sessionStore.js";

interface ClaudeHookPayload {
  session_id?: string;
  hook_event_name?: string;
  cwd?: string;
  tool_name?: string;
  message?: string;
  /** SubagentStop only: the subagent's name, e.g. "Explore". */
  agent_type?: string;
}

/** Handles a single hook invocation forwarded from ~/.claude/settings.json via curl. */
export function handleHookPayload(payload: ClaudeHookPayload): void {
  const sessionId = payload.session_id;
  if (!sessionId) return;
  const event = payload.hook_event_name;

  switch (event) {
    case "SessionStart":
      sessionStore.upsert({
        id: sessionId,
        agentType: "claude",
        projectPath: payload.cwd,
        status: "waiting_input",
        currentActivity: "セッション開始",
        source: "hook",
      });
      return;
    case "SessionEnd":
      sessionStore.markEnded(sessionId);
      return;
    case "UserPromptSubmit":
      sessionStore.upsert({ id: sessionId, status: "running", currentActivity: "考え中...", source: "hook" });
      return;
    case "PreToolUse":
      sessionStore.upsert({
        id: sessionId,
        status: "running",
        currentActivity: `Tool: ${payload.tool_name ?? "unknown"}`,
        source: "hook",
      });
      return;
    case "PostToolUse":
      sessionStore.upsert({
        id: sessionId,
        status: "running",
        currentActivity: `${payload.tool_name ?? "tool"} 完了`,
        source: "hook",
      });
      return;
    case "Stop":
      sessionStore.upsert({ id: sessionId, status: "waiting_input", currentActivity: "入力待ち", source: "hook" });
      return;
    case "SubagentStop":
      // The only reliable completion signal for a background subagent: its tool_result
      // arrives at launch time, so the file watcher can't tell when it actually finished.
      sessionStore.endRunningSubagent(sessionId, payload.agent_type ?? null);
      return;
    case "Notification":
      sessionStore.upsert({
        id: sessionId,
        status: "needs_attention",
        currentActivity: payload.message ?? "通知",
        source: "hook",
      });
      return;
    case "PreCompact":
      sessionStore.upsert({ id: sessionId, currentActivity: "コンパクト中...", source: "hook" });
      return;
    default:
      sessionStore.upsert({ id: sessionId, source: "hook" });
  }
}
