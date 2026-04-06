import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url().optional(),
  AIRTABLE_API_KEY: z.string().optional(),
  AIRTABLE_BASE_ID: z.string().optional(),
  AIRTABLE_PROPERTY_TABLE_ID: z.string().optional(),
  AIRTABLE_GUEST_TABLE_ID: z.string().optional(),
  AIRTABLE_BOOKING_TABLE_ID: z.string().optional(),
  AIRTABLE_SERVICE_REQUEST_TABLE_ID: z.string().optional(),
  AIRTABLE_MAINTENANCE_TASK_TABLE_ID: z.string().optional(),
  AIRTABLE_ALERT_TABLE_ID: z.string().optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
