import { EventEmitter } from "node:events";
import path from "node:path";
import { ENDED_PURGE_MS, STALE_TIMEOUT_MS, SUBAGENT_PURGE_MS, SUBAGENT_STALE_MS } from "../config.js";
import { recordActivity } from "./activityLog.js";
import { countCompleted, countEvent, countTokens } from "./metrics.js";
import { addUsage, diffUsage, emptyUsage, type TokenUsage } from "./tokenUsage.js";
import type {
  SessionPatch,
  SessionState,
  StoreEvent,
  SubagentPatch,
} from "./types.js";

function deriveLabel(projectPath: string | undefined | null): string {
  if (!projectPath) return "unknown";
  return path.basename(projectPath) || projectPath;
}

const STATUS_LABEL: Record<SessionState["status"], string> = {
  needs_attention: "要対応",
  running: "実行中",
  subagent_active: "サブエージェント稼働中",
  waiting_input: "入力待ち",
  ended: "終了",
};

/**
 * Turns a store mutation into one feed line, or null when nothing user-visible changed
 * (watchers upsert project path / git branch constantly and those must stay silent).
 */
function describeChange(previous: SessionState | undefined, next: SessionState): string | null {
  if (!previous) return "セッション検出";
  if (previous.status !== next.status) {
    return `${STATUS_LABEL[previous.status]} → ${STATUS_LABEL[next.status]}`;
  }
  if (next.currentActivity && next.currentActivity !== previous.currentActivity) {
    return next.currentActivity;
  }
  return null;
}

/** Status precedence: higher wins when merging concurrent signals within the same tick. */
const STATUS_RANK: Record<SessionState["status"], number> = {
  ended: 0,
  waiting_input: 1,
  running: 2,
  subagent_active: 3,
  needs_attention: 4,
};

class SessionStore extends EventEmitter {
  private sessions = new Map<string, SessionState>();
  private purgeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private subagentTimers = new Map<string, ReturnType<typeof setTimeout>>();

  list(): SessionState[] {
    return [...this.sessions.values()].sort((a, b) => b.lastEventAt - a.lastEventAt);
  }

  get(id: string): SessionState | undefined {
    return this.sessions.get(id);
  }

  upsert(patch: SessionPatch): SessionState {
    const existing = this.sessions.get(patch.id);
    const now = Date.now();
    const projectPath = patch.projectPath ?? existing?.projectPath ?? "";

    let nextStatus: SessionState["status"] =
      patch.status !== undefined ? patch.status : existing?.status ?? "waiting_input";

    // While a subagent is still running the parent is doing delegated work, so a plain
    // "running" signal (a sibling tool call, a hook) must not pull it out of that column.
    const hasLiveSubagent = Object.values(existing?.subagents ?? {}).some((s) => s.status === "running");
    if (hasLiveSubagent && nextStatus === "running") nextStatus = "subagent_active";

    const merged: SessionState = {
      id: patch.id,
      agentType: patch.agentType ?? existing?.agentType ?? "claude",
      projectPath,
      // Recompute from the current projectPath rather than freezing on whatever the
      // first upsert happened to know, since project path often arrives a tick later.
      projectLabel: patch.projectLabel ?? deriveLabel(projectPath) ?? existing?.projectLabel ?? "unknown",
      status: nextStatus,
      currentActivity:
        patch.currentActivity !== undefined ? patch.currentActivity : existing?.currentActivity ?? null,
      startedAt: existing?.startedAt ?? patch.startedAt ?? now,
      lastEventAt: now,
      subagents: existing?.subagents ?? {},
      source: patch.source ?? existing?.source ?? "file",
      gitBranch: patch.gitBranch !== undefined ? patch.gitBranch : existing?.gitBranch ?? null,
      pid: patch.pid !== undefined ? patch.pid : existing?.pid ?? null,
      processAlive: patch.processAlive ?? existing?.processAlive ?? true,
      tokens: existing?.tokens ?? emptyUsage(),
    };

    this.sessions.set(patch.id, merged);
    this.cancelPurge(patch.id);
    if (merged.status === "ended") {
      if (existing?.status !== "ended") countCompleted(merged);
      this.schedulePurge(patch.id);
    }
    this.publish({ kind: "patch", session: merged });
    this.log(describeChange(existing, merged), merged);
    return merged;
  }

  private log(text: string | null, session: SessionState): void {
    if (!text) return;
    countEvent();
    this.publish({ kind: "activity", event: recordActivity(session, text) });
  }

  /**
   * Records token usage for a session. ClaudeCode reports per-message deltas
   * (`cumulative: false`), Codex reports a running session total (`cumulative: true`).
   */
  updateTokens(id: string, usage: TokenUsage, cumulative: boolean): void {
    const session = this.sessions.get(id);
    if (!session) return;
    const delta = cumulative ? diffUsage(session.tokens, usage) : usage;
    if (delta.total === 0) return;

    session.tokens = cumulative ? usage : addUsage(session.tokens, usage);
    session.lastEventAt = Date.now();
    this.sessions.set(id, session);
    countTokens(delta);
    this.publish({ kind: "patch", session });
  }

  /**
   * Updates process liveness only — status and lastEventAt are deliberately left alone
   * so this can't keep a silent session alive past the stale sweep.
   */
  touchProcessAlive(id: string, alive: boolean, pid: number | null): void {
    const existing = this.sessions.get(id);
    if (!existing) return;
    existing.processAlive = alive;
    if (pid !== null) existing.pid = pid;
    this.sessions.set(id, existing);
  }

  upsertSubagent(sessionId: string, patch: SubagentPatch): void {
    const parent = this.sessions.get(sessionId);
    if (!parent) return;
    const now = Date.now();
    const existing = parent.subagents[patch.id];
    parent.subagents = {
      ...parent.subagents,
      [patch.id]: {
        id: patch.id,
        description: patch.description ?? existing?.description ?? "subagent",
        status: patch.status ?? existing?.status ?? "running",
        startedAt: existing?.startedAt ?? now,
        lastEventAt: now,
        subagentType: patch.subagentType ?? existing?.subagentType ?? null,
        background: patch.background ?? existing?.background ?? false,
      },
    };
    parent.lastEventAt = now;
    const anyRunning = Object.values(parent.subagents).some((s) => s.status === "running");
    if (anyRunning && STATUS_RANK.subagent_active >= STATUS_RANK[parent.status]) {
      parent.status = "subagent_active";
    } else if (!anyRunning && parent.status === "subagent_active") {
      parent.status = "running";
    }
    this.sessions.set(sessionId, parent);
    this.publish({ kind: "patch", session: parent });

    const sub = parent.subagents[patch.id];
    if (sub.status === "ended") this.scheduleSubagentPurge(sessionId, patch.id);
    if (!existing || existing.status !== sub.status) {
      this.log(`サブエージェント ${sub.status === "running" ? "起動" : "完了"}: ${sub.description}`, parent);
    }
  }

  /**
   * Ends one running subagent in response to a SubagentStop hook. The hook identifies the
   * agent by `agent_type`, not by the `tool_use` id we key on, so the oldest running
   * subagent of that type wins (falling back to the oldest of any type).
   */
  endRunningSubagent(sessionId: string, agentType: string | null): void {
    const parent = this.sessions.get(sessionId);
    if (!parent) return;
    const running = Object.values(parent.subagents)
      .filter((s) => s.status === "running")
      .sort((a, b) => a.startedAt - b.startedAt);
    if (running.length === 0) return;

    const target = (agentType && running.find((s) => s.subagentType === agentType)) || running[0];
    this.upsertSubagent(sessionId, { id: target.id, status: "ended" });
  }

  /** Finished subagents linger briefly on the card, then drop off so the list stays current. */
  private scheduleSubagentPurge(sessionId: string, subagentId: string): void {
    const key = `${sessionId}/${subagentId}`;
    clearTimeout(this.subagentTimers.get(key));
    const timer = setTimeout(() => {
      this.subagentTimers.delete(key);
      const parent = this.sessions.get(sessionId);
      if (!parent || parent.subagents[subagentId]?.status !== "ended") return;
      const { [subagentId]: _removed, ...rest } = parent.subagents;
      parent.subagents = rest;
      this.sessions.set(sessionId, parent);
      this.publish({ kind: "patch", session: parent });
    }, SUBAGENT_PURGE_MS);
    this.subagentTimers.set(key, timer);
  }

  markEnded(id: string): void {
    const existing = this.sessions.get(id);
    if (!existing || existing.status === "ended") return;
    existing.status = "ended";
    existing.processAlive = false;
    existing.lastEventAt = Date.now();
    this.sessions.set(id, existing);
    countCompleted(existing);
    this.schedulePurge(id);
    this.publish({ kind: "patch", session: existing });
    this.log("セッション終了", existing);
  }

  /** Sweeps sessions with no recent signal and no live process, marking them ended. */
  sweepStale(): void {
    const now = Date.now();
    for (const session of this.sessions.values()) {
      if (session.status === "ended") continue;

      for (const sub of Object.values(session.subagents)) {
        if (sub.status === "running" && now - sub.startedAt > SUBAGENT_STALE_MS) {
          this.upsertSubagent(session.id, { id: sub.id, status: "ended" });
        }
      }

      const idleFor = now - session.lastEventAt;
      if (idleFor > STALE_TIMEOUT_MS && !session.processAlive) {
        this.markEnded(session.id);
      }
    }
  }

  private schedulePurge(id: string): void {
    this.cancelPurge(id);
    const timer = setTimeout(() => {
      this.sessions.delete(id);
      this.purgeTimers.delete(id);
      this.publish({ kind: "removed", id });
    }, ENDED_PURGE_MS);
    this.purgeTimers.set(id, timer);
  }

  private cancelPurge(id: string): void {
    const timer = this.purgeTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.purgeTimers.delete(id);
    }
  }

  private publish(event: StoreEvent): void {
    this.emit("event", event);
  }
}

export const sessionStore = new SessionStore();
