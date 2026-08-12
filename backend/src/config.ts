import os from "node:os";
import path from "node:path";

export const PORT = Number(process.env.AGENT_MONITOR_PORT ?? 4317);
export const HOST = "127.0.0.1";

export const CLAUDE_DIR = path.join(os.homedir(), ".claude");
export const CLAUDE_PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");
export const CODEX_SESSIONS_DIR = path.join(os.homedir(), ".codex", "sessions");

/** Only ingest jsonl files modified within this window on startup. */
export const STARTUP_LOOKBACK_MS = 6 * 60 * 60 * 1000;

/** No hook/file signal for this long (and no matching live process) => mark ended. */
export const STALE_TIMEOUT_MS = 90 * 1000;

/** How long an "ended" card stays in the store (for fade-out) before being purged. */
export const ENDED_PURGE_MS = 10 * 1000;

/** How long a finished subagent stays listed on its parent card. */
export const SUBAGENT_PURGE_MS = 30 * 1000;

/**
 * Backstop for background subagents: without the SubagentStop hook there is no completion
 * signal at all, so anything running this long is force-ended rather than pinning the
 * parent in the subagent column forever.
 */
export const SUBAGENT_STALE_MS = 30 * 60 * 1000;

/** Interval for the `ps` liveness scan. */
export const PROCESS_SCAN_INTERVAL_MS = 5 * 1000;

/** Interval for the stale-session sweep. */
export const STALE_SWEEP_INTERVAL_MS = 10 * 1000;

/** How many activity entries are retained for the live feed. */
export const ACTIVITY_LOG_SIZE = 200;

/** Interval at which a metrics sample is appended to the history. */
export const METRICS_SAMPLE_INTERVAL_MS = 5 * 1000;

/** Number of retained metrics samples (5s * 60 = 5 minutes of history). */
export const METRICS_HISTORY_SIZE = 60;

/** Interval at which the metrics snapshot is pushed to websocket clients. */
export const METRICS_BROADCAST_INTERVAL_MS = 2 * 1000;
