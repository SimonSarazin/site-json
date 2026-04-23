import { describe, test, expect } from "vitest";
import { SiteConfig } from "@/types/site-schema";

/**
 * Build a minimal valid SiteConfig object for testing.
 * Override specific fields as needed.
 */
function buildMinimalConfig(overrides: Record<string, unknown> = {}): unknown {
  return {
    meta: {
      title: { fr: "Test", en: "Test" },
      defaultLang: "fr",
      languages: ["fr", "en"],
    },
    header: {
      type: "default",
      logo: "/logo.svg",
      nav: [],
      utilities: {
        themeSwitch: true,
        langSwitch: true,
        search: false,
        auth: false,
        cart: false,
        notifications: false,
      },
      sticky: false,
      transparent: false,
      height: "sm",
    },
    pages: [
      {
        path: "/",
        title: { fr: "Accueil", en: "Home" },
        sections: [
          {
            type: "hero",
            props: {
              headline: { fr: "Bienvenue", en: "Welcome" },
              align: "center",
              overlay: false,
            },
          },
        ],
      },
    ],
    footer: {
      type: "default",
      columns: [],
      copyright: { fr: "Test", en: "Test" },
    },
    ...overrides,
  };
}

describe("Config Validation — Zod SiteConfigSchema", () => {
  test("minimal valid config passes safeParse", () => {
    const config = buildMinimalConfig();
    const result = SiteConfig.safeParse(config);
    if (!result.success) {
      console.error("Errors:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });

  test("duplicate page paths fail safeParse", () => {
    const config = buildMinimalConfig({
      pages: [
        {
          path: "/",
          title: { fr: "A", en: "A" },
          sections: [],
        },
        {
          path: "/",
          title: { fr: "B", en: "B" },
          sections: [],
        },
      ],
    });
    const result = SiteConfig.safeParse(config);
    expect(result.success).toBe(false);
  });

  test("NavItem without path nor href fails", () => {
    const config = buildMinimalConfig({
      header: {
        type: "default",
        logo: "/logo.svg",
        nav: [
          {
            label: { fr: "Orphelin", en: "Orphan" },
            // no path, no href, no children, no megaMenu
          },
        ],
        utilities: {
          themeSwitch: true,
          langSwitch: true,
          search: false,
          auth: false,
          cart: false,
          notifications: false,
        },
        sticky: false,
        transparent: false,
        height: "sm",
      },
    });
    const result = SiteConfig.safeParse(config);
    expect(result.success).toBe(false);
  });

  test("config without meta.title fails safeParse", () => {
    const config = buildMinimalConfig({
      meta: {
        // title is missing
        defaultLang: "fr",
        languages: ["fr"],
      },
    });
    const result = SiteConfig.safeParse(config);
    expect(result.success).toBe(false);
  });

  test("unknown section type fails discriminatedUnion", () => {
    const config = buildMinimalConfig({
      pages: [
        {
          path: "/",
          title: { fr: "A", en: "A" },
          sections: [
            {
              type: "nonexistentSection",
              props: { foo: "bar" },
            },
          ],
        },
      ],
    });
    const result = SiteConfig.safeParse(config);
    expect(result.success).toBe(false);
  });
});
