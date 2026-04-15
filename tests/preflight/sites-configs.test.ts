import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SiteConfig } from "@/types/site-schema";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const sitesPath = path.join(PROJECT_ROOT, "sites.json");

interface SiteEntry {
  slug: string;
  config: string;
  css: string;
}

const sites: SiteEntry[] = JSON.parse(fs.readFileSync(sitesPath, "utf-8"));

describe("Preflight — sites.json integrity", () => {
  test("sites.json is a non-empty array", () => {
    expect(Array.isArray(sites)).toBe(true);
    expect(sites.length).toBeGreaterThan(0);
  });

  test("each entry has slug, config, and css fields", () => {
    for (const site of sites) {
      expect(site.slug, `Entry missing slug`).toBeTruthy();
      expect(site.config, `${site.slug}: missing config`).toBeTruthy();
      expect(site.css, `${site.slug}: missing css`).toBeTruthy();
    }
  });

  test("no duplicate slugs", () => {
    const slugs = sites.map((s) => s.slug);
    const unique = new Set(slugs);
    const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
    expect(dupes, `Duplicate slugs: ${dupes.join(", ")}`).toHaveLength(0);
    expect(unique.size).toBe(slugs.length);
  });
});

describe("Preflight — Config files referenced by sites.json", () => {
  // Dédupliquer les configs (plusieurs slugs peuvent partager la même)
  const uniqueConfigs = [...new Set(sites.map((s) => s.config))];

  for (const configFile of uniqueConfigs) {
    const configPath = path.resolve(PROJECT_ROOT, configFile);
    const slugsUsing = sites.filter((s) => s.config === configFile).map((s) => s.slug);

    describe(`${configFile} (slugs: ${slugsUsing.join(", ")})`, () => {
      test("file exists", () => {
        expect(
          fs.existsSync(configPath),
          `Config file not found: ${configFile}`
        ).toBe(true);
      });

      test("is valid JSON", () => {
        const content = fs.readFileSync(configPath, "utf-8");
        expect(() => JSON.parse(content)).not.toThrow();
      });

      test("passes Zod SiteConfigSchema", () => {
        const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        const result = SiteConfig.safeParse(raw);
        if (!result.success) {
          const issues = result.error.issues.map(
            (i) => `  ${i.path.join(".")}: ${i.message} (expected ${(i as Record<string,unknown>).expected ?? "?"})`
          );
          expect.fail(
            `Schema validation failed for ${configFile}:\n${issues.join("\n")}`
          );
        }
      });

      test("has at least one page with path '/'", () => {
        const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
          pages?: Array<{ path: string }>;
        };
        const homePage = raw.pages?.find((p) => p.path === "/");
        expect(homePage, `No home page (path="/") in ${configFile}`).toBeDefined();
      });

      test("all page paths are unique", () => {
        const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
          pages?: Array<{ path: string }>;
        };
        const paths = raw.pages?.map((p) => p.path) ?? [];
        const dupes = paths.filter((p, i) => paths.indexOf(p) !== i);
        expect(dupes, `Duplicate paths in ${configFile}: ${dupes.join(", ")}`).toHaveLength(0);
      });
    });
  }
});

describe("Preflight — CSS files referenced by sites.json", () => {
  const uniqueCss = [...new Set(sites.map((s) => s.css))];

  for (const cssName of uniqueCss) {
    const cssPath = path.resolve(PROJECT_ROOT, "src", `${cssName}.css`);
    const slugsUsing = sites.filter((s) => s.css === cssName).map((s) => s.slug);

    test(`${cssName}.css exists (slugs: ${slugsUsing.join(", ")})`, () => {
      expect(
        fs.existsSync(cssPath),
        `CSS file not found: src/${cssName}.css`
      ).toBe(true);
    });
  }
});
