import { useEffect } from "react";
import { useAgentStore } from "./store.js";
import type { ServerMessage } from "./types.js";

function wsUrl(): string {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${location.host}/ws`;
}

export function useAgentSocket(): void {
  const setConnection = useAgentStore((s) => s.setConnection);
  const setSnapshot = useAgentStore((s) => s.setSnapshot);
  const setMetrics = useAgentStore((s) => s.setMetrics);
  const pushActivity = useAgentStore((s) => s.pushActivity);
  const upsertSession = useAgentStore((s) => s.upsertSession);
  const removeSession = useAgentStore((s) => s.removeSession);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setConnection("connecting");
      socket = new WebSocket(wsUrl());

      socket.addEventListener("open", () => setConnection("open"));

      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data) as ServerMessage;
        if (message.kind === "snapshot") setSnapshot(message.sessions, message.activity, message.metrics);
        else if (message.kind === "patch") upsertSession(message.session);
        else if (message.kind === "removed") removeSession(message.id);
        else if (message.kind === "activity") pushActivity(message.event);
        else if (message.kind === "metrics") setMetrics(message.metrics);
      });

      socket.addEventListener("close", () => {
        setConnection("closed");
        if (!cancelled) reconnectTimer = setTimeout(connect, 2000);
      });

      socket.addEventListener("error", () => socket?.close());
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [setConnection, setSnapshot, setMetrics, pushActivity, upsertSession, removeSession]);
}
