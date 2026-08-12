import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { METRICS_BROADCAST_INTERVAL_MS } from "../config.js";
import { sessionStore } from "../store/sessionStore.js";
import { listActivity } from "../store/activityLog.js";
import { getMetrics } from "../store/metrics.js";
import type { StoreEvent } from "../store/types.js";

export function registerWs(app: FastifyInstance): void {
  const clients = new Set<WebSocket>();

  function broadcast(message: unknown): void {
    const payload = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === client.OPEN) client.send(payload);
    }
  }

  const onStoreEvent = (event: StoreEvent) => broadcast(event);
  sessionStore.on("event", onStoreEvent);

  setInterval(() => {
    if (clients.size > 0) broadcast({ kind: "metrics", metrics: getMetrics() });
  }, METRICS_BROADCAST_INTERVAL_MS);

  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(
      JSON.stringify({
        kind: "snapshot",
        sessions: sessionStore.list(),
        activity: listActivity(),
        metrics: getMetrics(),
      }),
    );

    socket.on("close", () => {
      clients.delete(socket);
    });
  });
}
