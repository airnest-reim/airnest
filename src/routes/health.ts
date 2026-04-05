import type { FastifyInstance } from "fastify";

export function registerHealthRoute(app: FastifyInstance): void {
  app.get("/health", () => {
    return {
      status: "ok"
    };
  });
}
