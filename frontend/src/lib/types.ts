export type AgentType = "claude" | "codex";

export interface TokenUsage {
  /** Uncached prompt tokens. */
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

export type StatusKind =
  | "waiting_input"
  | "running"
  | "subagent_active"
  | "needs_attention"
  | "ended";

export interface SubagentState {
  id: string;
  description: string;
  status: "running" | "ended";
  startedAt: number;
  lastEventAt: number;
  subagentType: string | null;
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
  source: "hook" | "file" | "process";
  gitBranch: string | null;
  pid: number | null;
  processAlive: boolean;
  tokens: TokenUsage;
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

export type ServerMessage =
  | { kind: "snapshot"; sessions: SessionState[]; activity: ActivityEvent[]; metrics: MetricsSnapshot }
  | { kind: "patch"; session: SessionState }
  | { kind: "removed"; id: string }
  | { kind: "activity"; event: ActivityEvent }
  | { kind: "metrics"; metrics: MetricsSnapshot };
