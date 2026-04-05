import Fastify, { type FastifyInstance } from "fastify";

import { loadEnv, type AppEnv } from "./config/env.js";
import type { DomainStore } from "./domain/store.js";
import { createDefaultDomainStore } from "./platform/create-store.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerDomainRoutes } from "./routes/domain.js";

export type AppDependencies = {
  store?: DomainStore;
  env?: AppEnv;
};

export function buildApp(dependencies: AppDependencies = {}): FastifyInstance {
  const app = Fastify({
    logger: false
  });
  const env = dependencies.env ?? loadEnv();
  const store = dependencies.store ?? createDefaultDomainStore(env);

  app.addHook("onReady", async () => {
    await store.initialize?.();
  });

  app.addHook("onClose", async () => {
    await store.dispose?.();
  });

  void app.register(registerHealthRoute);
  void app.register((domainApp) => {
    registerDomainRoutes(domainApp, store);
  });

  return app;
}
