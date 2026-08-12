import type { TokenUsage } from "./tokenUsage.js";

export type { TokenUsage };

export type AgentType = "claude" | "codex";

export type StatusKind =
  | "waiting_input"
  | "running"
  | "subagent_active"
  | "needs_attention"
  | "ended";

export type SignalSource = "hook" | "file" | "process";

export interface SubagentState {
  id: string;
  description: string;
  status: "running" | "ended";
  startedAt: number;
  lastEventAt: number;
  /** `subagent_type` from the spawning tool call, matched against SubagentStop's `agent_type`. */
  subagentType: string | null;
  /** Background agents return their tool_result at launch, so that result is not a completion. */
  background: boolean;
}

export interface SessionState {
  id: string;
  agentType: AgentType;
  projectPath: string;
  projectLabel: string;
  status: StatusKind;
  currentActivity: string | null;
  startedAt: number;
  lastEventAt: number;
  subagents: Record<string, SubagentState>;
  source: SignalSource;
  gitBranch: string | null;
  pid: number | null;
  processAlive: boolean;
  tokens: TokenUsage;
}

export interface SessionPatch {
  id: string;
  agentType?: AgentType;
  projectPath?: string;
  projectLabel?: string;
  status?: StatusKind;
  currentActivity?: string | null;
  startedAt?: number;
  source?: SignalSource;
  gitBranch?: string | null;
  pid?: number | null;
  processAlive?: boolean;
  /** If true, skip overwriting status when the incoming patch has no status (keep existing). */
  touchOnly?: boolean;
}

export interface SubagentPatch {
  id: string;
  description?: string;
  status?: "running" | "ended";
  subagentType?: string | null;
  background?: boolean;
}

export interface ActivityEvent {
  id: number;
  ts: number;
  sessionId: string;
  sessionLabel: string;
  agentType: AgentType;
  status: StatusKind;
  text: string;
}

export interface MetricsSample {
  ts: number;
  active: number;
  running: number;
  events: number;
  completed: number;
  automatedH: number;
  tokens: number;
  cpu: number;
  mem: number;
}

export interface MetricsSnapshot {
  serverStartedAt: number;
  now: number;
  completedToday: number;
  automatedH: number;
  eventsToday: number;
  eventsPerMin: number;
  /** Accumulated since the backend started, not since midnight — sessions are not persisted. */
  tokens: TokenUsage;
  tokensPerMin: number;
  cpu: number;
  mem: number;
  history: MetricsSample[];
}

export type StoreEvent =
  | { kind: "patch"; session: SessionState }
  | { kind: "removed"; id: string }
  | { kind: "activity"; event: ActivityEvent };
