import os from "node:os";
import { METRICS_HISTORY_SIZE, METRICS_SAMPLE_INTERVAL_MS } from "../config.js";
import { addUsage, emptyUsage, type TokenUsage } from "./tokenUsage.js";
import type { MetricsSample, MetricsSnapshot, SessionState } from "./types.js";

const serverStartedAt = Date.now();

let dayStart = startOfToday();
let eventsToday = 0;
let completedToday = 0;
/** Runtime of sessions that already ended today; live sessions are added on read. */
let closedMsToday = 0;
/** Not day-scoped: token deltas are only observed while the backend is running. */
let tokens = emptyUsage();

const history: MetricsSample[] = [];
let listSessions: () => SessionState[] = () => [];
let prevCpuTimes = os.cpus().map((c) => c.times);
let cpuPercent = 0;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Counters are per-day, so reset them the first time we observe a new date. */
function rollDay(): void {
  const today = startOfToday();
  if (today === dayStart) return;
  dayStart = today;
  eventsToday = 0;
  completedToday = 0;
  closedMsToday = 0;
}

export function countEvent(): void {
  rollDay();
  eventsToday++;
}

export function countTokens(delta: TokenUsage): void {
  tokens = addUsage(tokens, delta);
}

export function countCompleted(session: SessionState): void {
  rollDay();
  completedToday++;
  closedMsToday += Math.max(0, Date.now() - Math.max(session.startedAt, dayStart));
}

/** Busy ratio across all cores since the previous call. */
function sampleCpu(): number {
  const times = os.cpus().map((c) => c.times);
  let idle = 0;
  let total = 0;
  for (let i = 0; i < times.length; i++) {
    const prev = prevCpuTimes[i];
    const cur = times[i];
    if (!prev) continue;
    const deltaIdle = cur.idle - prev.idle;
    idle += deltaIdle;
    total +=
      cur.user - prev.user + (cur.nice - prev.nice) + (cur.sys - prev.sys) + deltaIdle + (cur.irq - prev.irq);
  }
  prevCpuTimes = times;
  return total > 0 ? Math.round((1 - idle / total) * 100) : cpuPercent;
}

function memPercent(): number {
  return Math.round((1 - os.freemem() / os.totalmem()) * 100);
}

function automatedHours(): number {
  rollDay();
  const now = Date.now();
  let liveMs = 0;
  for (const session of listSessions()) {
    if (session.status === "ended") continue;
    liveMs += Math.max(0, now - Math.max(session.startedAt, dayStart));
  }
  return Math.round(((closedMsToday + liveMs) / 3_600_000) * 10) / 10;
}

/** Growth of a cumulative counter over the trailing minute, derived from the sample history. */
function ratePerMin(pick: (s: MetricsSample) => number): number {
  const window = Math.ceil(60_000 / METRICS_SAMPLE_INTERVAL_MS);
  const recent = history.slice(-window - 1);
  if (recent.length < 2) return 0;
  const spanMs = recent[recent.length - 1].ts - recent[0].ts;
  if (spanMs <= 0) return 0;
  const delta = pick(recent[recent.length - 1]) - pick(recent[0]);
  return Math.round((delta / spanMs) * 60_000 * 10) / 10;
}

function takeSample(): void {
  cpuPercent = sampleCpu();
  const sessions = listSessions();
  history.push({
    ts: Date.now(),
    active: sessions.filter((s) => s.status !== "ended").length,
    running: sessions.filter((s) => s.status === "running" || s.status === "subagent_active").length,
    events: eventsToday,
    completed: completedToday,
    automatedH: automatedHours(),
    tokens: tokens.total,
    cpu: cpuPercent,
    mem: memPercent(),
  });
  if (history.length > METRICS_HISTORY_SIZE) history.splice(0, history.length - METRICS_HISTORY_SIZE);
}

export function getMetrics(): MetricsSnapshot {
  rollDay();
  return {
    serverStartedAt,
    now: Date.now(),
    completedToday,
    automatedH: automatedHours(),
    eventsToday,
    eventsPerMin: ratePerMin((s) => s.events),
    tokens,
    tokensPerMin: ratePerMin((s) => s.tokens),
    cpu: cpuPercent,
    mem: memPercent(),
    history: [...history],
  };
}

export function startMetrics(sessionsGetter: () => SessionState[]): void {
  listSessions = sessionsGetter;
  takeSample();
  setInterval(takeSample, METRICS_SAMPLE_INTERVAL_MS);
}
