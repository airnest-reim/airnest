import { Pool } from "pg";
import { initialDomainSeed } from "../domain/seed.js";
import { PostgresDomainRepository } from "../platform/postgres-repository.js";

async function reset() {
  const databaseUrl =
    process.env.DATABASE_URL ||
    "postgresql://airnest:airnest_dev_password@localhost:5432/airnest_dev";

  const pool = new Pool({
    connectionString: databaseUrl
  });

  try {
    console.log("🔄 Starting database reset...");

    // Get all tables and drop them
    console.log("  ↳ Dropping all tables...");
    const result = await pool.query(`
      select tablename from pg_tables where schemaname = 'public'
    `);

    for (const row of result.rows) {
      await pool.query(`drop table if exists "${row.tablename}" cascade`);
    }
    console.log("  ✓ All tables dropped");

    // Re-seed the database
    console.log("  ↳ Re-seeding database...");
    const repository = new PostgresDomainRepository(pool);
    await repository.migrate();
    await repository.seed(initialDomainSeed);
    console.log("  ✓ Database re-seeded");

    console.log("✅ Database reset completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Reset failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

reset();
