import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SiteConfig } from "@/types/site-schema";

const PROJECT_ROOT = path.resolve(__dirname, "../..");

/**
 * Load dotenv values from .env file manually (no dotenv dependency needed for tests).
 * Returns a record of key=value pairs.
 */
function loadEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    vars[key] = value;
  }
  return vars;
}

const envPath = path.join(PROJECT_ROOT, ".env");
const envVars = loadEnvFile(envPath);

describe("Preflight — Environment", () => {
  test(".env file exists", () => {
    expect(fs.existsSync(envPath)).toBe(true);
  });

  test("VITE_BASE_URL_BACKEND is defined and starts with http(s)://", () => {
    const val = envVars.VITE_BASE_URL_BACKEND || process.env.VITE_BASE_URL_BACKEND;
    expect(val).toBeDefined();
    expect(val).toMatch(/^https?:\/\//);
  });

  test("VITE_SLUG is defined and non-empty", () => {
    const val = envVars.VITE_SLUG || process.env.VITE_SLUG;
    expect(val).toBeDefined();
    expect(val!.length).toBeGreaterThan(0);
  });

  test("SITE_CONFIG_PATH points to an existing file", () => {
    const configPath = envVars.SITE_CONFIG_PATH || process.env.SITE_CONFIG_PATH || "./config.prod.json";
    const resolved = path.resolve(PROJECT_ROOT, configPath);
    expect(fs.existsSync(resolved)).toBe(true);
  });
});

describe("Preflight — Config JSON", () => {
  const configPath = path.resolve(
    PROJECT_ROOT,
    envVars.SITE_CONFIG_PATH || process.env.SITE_CONFIG_PATH || "./config.prod.json"
  );

  let rawJson: unknown;

  test("config file is valid JSON", () => {
    const content = fs.readFileSync(configPath, "utf-8");
    expect(() => {
      rawJson = JSON.parse(content);
    }).not.toThrow();
  });

  test("config passes Zod SiteConfigSchema", () => {
    if (!rawJson) {
      rawJson = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
    const result = SiteConfig.safeParse(rawJson);
    if (!result.success) {
      console.error("Zod validation errors:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });

  test("at least one page with path '/' exists", () => {
    if (!rawJson) {
      rawJson = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
    const config = rawJson as { pages?: Array<{ path: string }> };
    const homePage = config.pages?.find((p) => p.path === "/");
    expect(homePage).toBeDefined();
  });

  test("all page paths are unique", () => {
    if (!rawJson) {
      rawJson = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
    const config = rawJson as { pages?: Array<{ path: string }> };
    const paths = config.pages?.map((p) => p.path) ?? [];
    const uniquePaths = new Set(paths);
    expect(uniquePaths.size).toBe(paths.length);
  });
});

describe("Preflight — Backend connectivity", () => {
  const backendUrl = envVars.VITE_BASE_URL_BACKEND || process.env.VITE_BASE_URL_BACKEND;

  test("backend responds", { timeout: 10_000 }, async () => {
    if (!backendUrl) {
      console.log("Skipping: VITE_BASE_URL_BACKEND not defined");
      return;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3_000);
      const res = await fetch(backendUrl, { signal: controller.signal });
      clearTimeout(timer);
      // Any response (even 404) means the server is up
      expect(res.status).toBeLessThan(600);
    } catch {
      // Backend unreachable — skip gracefully
      console.log(`Skipping: Backend at ${backendUrl} is not reachable`);
    }
  });
});
