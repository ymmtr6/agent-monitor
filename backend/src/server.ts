import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { HOST, PORT, STALE_SWEEP_INTERVAL_MS } from "./config.js";
import { registerRoutes } from "./api/routes.js";
import { registerWs } from "./api/ws.js";
import { startClaudeFileWatcher } from "./sources/claudeFileWatcher.js";
import { startCodexFileWatcher } from "./sources/codexFileWatcher.js";
import { startProcessWatcher } from "./sources/processWatcher.js";
import { sessionStore } from "./store/sessionStore.js";
import { startMetrics } from "./store/metrics.js";

async function main() {
  const app = Fastify({ logger: { level: "info" } });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  registerRoutes(app);
  registerWs(app);

  startMetrics(() => sessionStore.list());
  startClaudeFileWatcher();
  startCodexFileWatcher();
  startProcessWatcher();
  setInterval(() => sessionStore.sweepStale(), STALE_SWEEP_INTERVAL_MS);

  await app.listen({ host: HOST, port: PORT });
  app.log.info(`AgentMonitor backend listening on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
