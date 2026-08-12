import { create } from "zustand";
import type { ActivityEvent, MetricsSnapshot, SessionState } from "./types.js";

export type ConnectionState = "connecting" | "open" | "closed";

/** Matches the backend ring buffer; the feed only ever renders the top slice anyway. */
const ACTIVITY_LIMIT = 200;

interface AgentStore {
  sessions: Record<string, SessionState>;
  activity: ActivityEvent[];
  metrics: MetricsSnapshot | null;
  connection: ConnectionState;
  setConnection: (state: ConnectionState) => void;
  setSnapshot: (sessions: SessionState[], activity: ActivityEvent[], metrics: MetricsSnapshot) => void;
  setMetrics: (metrics: MetricsSnapshot) => void;
  pushActivity: (event: ActivityEvent) => void;
  upsertSession: (session: SessionState) => void;
  removeSession: (id: string) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  sessions: {},
  activity: [],
  metrics: null,
  connection: "connecting",
  setConnection: (connection) => set({ connection }),
  setSnapshot: (sessions, activity, metrics) =>
    set({
      sessions: Object.fromEntries(sessions.map((s) => [s.id, s])),
      activity,
      metrics,
    }),
  setMetrics: (metrics) => set({ metrics }),
  pushActivity: (event) =>
    set((state) => ({ activity: [event, ...state.activity].slice(0, ACTIVITY_LIMIT) })),
  upsertSession: (session) =>
    set((state) => ({
      sessions: { ...state.sessions, [session.id]: session },
    })),
  removeSession: (id) =>
    set((state) => {
      const next = { ...state.sessions };
      delete next[id];
      return { sessions: next };
    }),
}));
