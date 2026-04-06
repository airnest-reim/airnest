import { Pool } from "pg";
import { initialDomainSeed } from "../domain/seed.js";
import { PostgresDomainRepository } from "../platform/postgres-repository.js";

async function seed() {
  const databaseUrl =
    process.env.DATABASE_URL ||
    "postgresql://airnest:airnest_dev_password@localhost:5432/airnest_dev";

  const pool = new Pool({
    connectionString: databaseUrl
  });

  try {
    console.log("🌱 Starting database seeding...");

    const repository = new PostgresDomainRepository(pool);

    // First apply migrations if not already done
    console.log("  ↳ Applying migrations...");
    await repository.migrate();
    console.log("  ✓ Migrations applied");

    // Then seed the initial data
    console.log("  ↳ Seeding domain data...");
    await repository.seed(initialDomainSeed);
    console.log("  ✓ Domain data seeded");

    // Get and display counts
    const counts = await repository.getCounts();
    console.log("\n📊 Seeded data:");
    Object.entries(counts).forEach(([key, value]) => {
      console.log(`  • ${key}: ${value}`);
    });

    console.log("\n✅ Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
