import "dotenv/config";
import { defineConfig } from "prisma/config";

const appEnv = process.env.APP_ENV ?? "development";
const directUrl = process.env.DIRECT_URL;
const databaseUrl = process.env.DATABASE_URL;

const isHosted = appEnv === "hml" || appEnv === "production";
const isMigrateCommand = process.argv.some((arg) => arg.includes("migrate"));

if (isHosted && isMigrateCommand && !directUrl) {
  throw new Error(
    "DIRECT_URL is required for migrations in hml/production.",
  );
}

const migrationUrl = directUrl ?? databaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: migrationUrl ? { url: migrationUrl } : undefined,
});
