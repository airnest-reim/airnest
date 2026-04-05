import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";

async function start(): Promise<void> {
  const env = loadEnv();
  const app = buildApp();

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT
    });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

void start();
