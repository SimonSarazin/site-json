import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ————————————————————————————————————————————————————————————
// Types (lightweight, just what tests need)
// ————————————————————————————————————————————————————————————

export interface SiteSection {
  type: string;
  id?: string;
  props?: Record<string, unknown>;
}

export interface SitePage {
  path: string;
  title: Record<string, string>;
  sections: SiteSection[];
}

export interface NavItem {
  label: Record<string, string>;
  path?: string;
  children?: NavItem[];
}

export interface SiteConfig {
  meta: {
    title: Record<string, string>;
    defaultLang: string;
    languages: string[];
  };
  header: {
    nav: NavItem[];
    utilities: Record<string, boolean>;
  };
  pages: SitePage[];
  footer: {
    copyright: Record<string, string>;
  };
  profiles?: Record<string, { tabs?: Array<{ id: string; label: Record<string, string> }> }>;
  auth?: {
    login?: { title?: Record<string, string> };
  };
}

// ————————————————————————————————————————————————————————————
// Config loading
// ————————————————————————————————————————————————————————————

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const configPath = path.resolve(
  PROJECT_ROOT,
  process.env.SITE_CONFIG_PATH || "./config.prod.json"
);

let _cachedConfig: SiteConfig | null = null;

export function loadSiteConfig(): SiteConfig {
  if (_cachedConfig) return _cachedConfig;
  _cachedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8")) as SiteConfig;
  return _cachedConfig;
}

// ————————————————————————————————————————————————————————————
// Helper functions
// ————————————————————————————————————————————————————————————

/**
 * Find the first page that contains a section of the given type.
 */
export function findPageBySection(
  config: SiteConfig,
  sectionType: string
): SitePage | undefined {
  return config.pages.find((p) =>
    p.sections.some((s) => s.type === sectionType)
  );
}

/**
 * Find the path to the login page (page containing a `loginForm` section).
 * Returns undefined if no login page is configured.
 */
export function findLoginPath(config: SiteConfig): string | undefined {
  const page = findPageBySection(config, "loginForm");
  return page?.path;
}

/**
 * Find all pages that contain search-related sections
 * (searchPro, searchProStatic, or gridLayout).
 */
export function findSearchPages(config: SiteConfig): SitePage[] {
  const searchTypes = new Set(["searchPro", "searchProStatic", "gridLayout"]);
  return config.pages.filter((p) =>
    p.sections.some((s) => searchTypes.has(s.type))
  );
}

/**
 * Collect all navigable paths from header nav (recursively flattens children).
 * Excludes '#' placeholder links.
 */
export function getAllNavPaths(config: SiteConfig): string[] {
  const paths: string[] = [];

  function walk(items: NavItem[]) {
    for (const item of items) {
      if (item.path && item.path !== "#") paths.push(item.path);
      if (item.children) walk(item.children);
    }
  }

  walk(config.header.nav);
  return [...new Set(paths)];
}

/**
 * Get a non-home page from config (first page with path !== "/").
 */
export function findSecondaryPage(config: SiteConfig): SitePage | undefined {
  return config.pages.find((p) => p.path !== "/");
}
