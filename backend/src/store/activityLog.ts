import { ACTIVITY_LOG_SIZE } from "../config.js";
import type { ActivityEvent, SessionState } from "./types.js";

const entries: ActivityEvent[] = [];
let nextId = 1;

/** Appends one line to the live activity feed, dropping the oldest entry when full. */
export function recordActivity(session: SessionState, text: string): ActivityEvent {
  const event: ActivityEvent = {
    id: nextId++,
    ts: Date.now(),
    sessionId: session.id,
    sessionLabel: session.projectLabel,
    agentType: session.agentType,
    status: session.status,
    text,
  };
  entries.push(event);
  if (entries.length > ACTIVITY_LOG_SIZE) entries.splice(0, entries.length - ACTIVITY_LOG_SIZE);
  return event;
}

/** Newest first, so the feed can render top-down without reversing. */
export function listActivity(): ActivityEvent[] {
  return [...entries].reverse();
}
