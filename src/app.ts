import Fastify, { type FastifyInstance } from "fastify";

import { initialDomainSeed } from "./domain/seed.js";
import { DomainStore } from "./domain/store.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerDomainRoutes } from "./routes/domain.js";

export type AppDependencies = {
  store?: DomainStore;
};

export function buildApp(
  dependencies: AppDependencies = {}
): FastifyInstance {
  const app = Fastify({
    logger: false
  });
  const store = dependencies.store ?? new DomainStore(initialDomainSeed);

  void app.register(registerHealthRoute);
  void app.register((domainApp) => {
    registerDomainRoutes(domainApp, store);
  });

  return app;
}
