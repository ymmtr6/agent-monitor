import type { FastifyInstance } from "fastify";
import { sessionStore } from "../store/sessionStore.js";
import { handleHookPayload } from "../sources/hookIngest.js";

export function registerRoutes(app: FastifyInstance): void {
  app.get("/api/sessions", async () => sessionStore.list());

  app.get("/api/health", async () => ({ ok: true }));

  app.post("/api/hooks", async (request, reply) => {
    handleHookPayload(request.body as Record<string, unknown>);
    reply.status(204).send();
  });
}
