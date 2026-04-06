import { Pool } from "pg";

async function migrate() {
  const databaseUrl =
    process.env.DATABASE_URL ||
    "postgresql://airnest:airnest_dev_password@localhost:5432/airnest_dev";

  const pool = new Pool({
    connectionString: databaseUrl
  });

  try {
    console.log("📦 Starting database migrations...");

    // Create migrations table if it doesn't exist
    await pool.query(`
      create table if not exists schema_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    // Import migrations dynamically
    const { postgresMigrations } = await import(
      "../platform/postgres-migrations.js"
    );

    for (const migration of postgresMigrations) {
      // Check if migration has already been applied
      const result = await pool.query(
        "select id from schema_migrations where id = $1",
        [migration.id]
      );

      if (result.rows.length === 0) {
        console.log(`  ↳ Applying ${migration.id}...`);
        await pool.query(migration.sql);
        await pool.query("insert into schema_migrations (id) values ($1)", [
          migration.id
        ]);
        console.log(`  ✓ Applied ${migration.id}`);
      } else {
        console.log(`  ✓ Already applied ${migration.id}`);
      }
    }

    console.log("✅ Database migrations completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
