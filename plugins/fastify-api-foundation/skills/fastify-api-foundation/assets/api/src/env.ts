import "dotenv/config";
import { z } from "zod";

// The ONLY module that reads process.env. Everything else imports `env`.

const isLoopbackHost = (host: string): boolean => {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.startsWith("127.")
  );
};

// Hosting dashboards often keep surrounding quotes/whitespace.
const sanitize = (val?: string): string =>
  val ? val.trim().replace(/^["']|["']$/g, "") : "";

// Empty string and undefined both fall back to the default, then get validated.
const enumWithDefault = <const T extends readonly [string, ...string[]]>(
  values: T,
  fallback: T[number],
) =>
  z
    .string()
    .optional()
    .transform((val) => sanitize(val).toLowerCase() || fallback)
    .pipe(z.enum(values));

export const envSchema = z
  .object({
    NODE_ENV: enumWithDefault(
      ["development", "test", "production"],
      "development",
    ),
    APP_ENV: enumWithDefault(
      ["development", "hml", "production"],
      "development",
    ),
    PORT: z.coerce.number().int().positive().default(3333),
    HOST: z
      .string()
      .optional()
      .transform((val) => sanitize(val) || "0.0.0.0"),
    LOG_LEVEL: enumWithDefault(
      ["fatal", "error", "warn", "info", "debug", "trace", "silent"],
      "info",
    ),
    DATABASE_URL: z.string().transform(sanitize).pipe(z.url()),
    // Migrations only (read by prisma.config.ts); the runtime never needs it.
    DIRECT_URL: z
      .string()
      .optional()
      .transform((val) => sanitize(val) || undefined)
      .pipe(z.url().optional()),
    CORS_ORIGIN: z
      .string()
      .optional()
      .transform((val) =>
        val
          ? val
              .split(",")
              .map((s) => sanitize(s).replace(/\/+$/, ""))
              .filter(Boolean)
          : ["http://localhost:5173"],
      ),
    COOKIE_SAME_SITE: enumWithDefault(["lax", "strict", "none"], "lax"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== "production") return;

    if (data.APP_ENV === "development") {
      ctx.addIssue({
        code: "custom",
        path: ["APP_ENV"],
        message:
          "APP_ENV must be 'hml' or 'production' when NODE_ENV is 'production'.",
      });
    }

    if (isLoopbackHost(new URL(data.DATABASE_URL).hostname)) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message:
          "DATABASE_URL cannot point to localhost in hosted environments.",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
export const env: Env = envSchema.parse(process.env);
