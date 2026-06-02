// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useContext, type PropsWithChildren } from "react";
import { SiteProvider } from "./SiteProvider";
import { SiteContext } from "./SiteContext";
import type { SiteConfig } from "@/types/site";

function makeConfig(partial: Partial<SiteConfig> = {}): SiteConfig {
  return {
    meta: {
      title: { fr: "Demo", en: "Demo" },
      description: { fr: "", en: "" },
      defaultLang: "fr",
      languages: ["fr", "en"],
    },
    header: {
      type: "tiers-lieux",
      logo: "/logo.svg",
      nav: [],
      utilities: {
        themeSwitch: true,
        langSwitch: true,
        search: false,
        auth: false,
        cart: false,
        notifications: false,
        piggyBank: false,
      },
      sticky: false,
      transparent: false,
      height: "sm",
    },
    pages: [],
    footer: {
      type: "default",
      columns: [],
      copyright: { fr: "© 2025", en: "© 2025" },
    },
    ...partial,
  } as SiteConfig;
}

function useSiteCtx() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("SiteContext not provided");
  return ctx;
}

describe("SiteProvider", () => {
  beforeEach(() => {
    // reset événements éventuels entre tests
  });

  describe("config initial", () => {
    it("expose le config initial via SiteContext", () => {
      const config = makeConfig();
      const wrapper = ({ children }: PropsWithChildren) => (
        <SiteProvider config={config}>{children}</SiteProvider>
      );
      const { result } = renderHook(() => useSiteCtx(), { wrapper });
      expect(result.current.config).toBe(config);
      expect(result.current.config.meta.defaultLang).toBe("fr");
    });

    it("expose une fonction setConfig", () => {
      const config = makeConfig();
      const wrapper = ({ children }: PropsWithChildren) => (
        <SiteProvider config={config}>{children}</SiteProvider>
      );
      const { result } = renderHook(() => useSiteCtx(), { wrapper });
      expect(typeof result.current.setConfig).toBe("function");
    });
  });

  describe("setConfig", () => {
    it("met à jour le config quand setConfig est appelé", () => {
      const config = makeConfig({ meta: { title: { fr: "A" }, defaultLang: "fr", languages: ["fr"], description: { fr: "" } } });
      const wrapper = ({ children }: PropsWithChildren) => (
        <SiteProvider config={config}>{children}</SiteProvider>
      );
      const { result } = renderHook(() => useSiteCtx(), { wrapper });
      expect(result.current.config.meta.title.fr).toBe("A");

      const next = makeConfig({ meta: { title: { fr: "B" }, defaultLang: "fr", languages: ["fr"], description: { fr: "" } } });
      act(() => {
        result.current.setConfig(next);
      });
      expect(result.current.config.meta.title.fr).toBe("B");
    });
  });

  describe("prop config change", () => {
    it("propage la prop config mise à jour via useEffect", () => {
      let currentCfg = makeConfig({ meta: { title: { fr: "v1" }, defaultLang: "fr", languages: ["fr"], description: { fr: "" } } });
      const wrapper = ({ children }: PropsWithChildren) => (
        <SiteProvider config={currentCfg}>{children}</SiteProvider>
      );
      const { result, rerender } = renderHook(() => useSiteCtx(), { wrapper });
      expect(result.current.config.meta.title.fr).toBe("v1");

      currentCfg = makeConfig({ meta: { title: { fr: "v2" }, defaultLang: "fr", languages: ["fr"], description: { fr: "" } } });
      rerender();
      expect(result.current.config.meta.title.fr).toBe("v2");
    });
  });

  describe("événement site-config-update", () => {
    it("met à jour le config quand window dispatch site-config-update", () => {
      const initial = makeConfig({ meta: { title: { fr: "init" }, defaultLang: "fr", languages: ["fr"], description: { fr: "" } } });
      const wrapper = ({ children }: PropsWithChildren) => (
        <SiteProvider config={initial}>{children}</SiteProvider>
      );
      const { result } = renderHook(() => useSiteCtx(), { wrapper });
      expect(result.current.config.meta.title.fr).toBe("init");

      const updated = makeConfig({ meta: { title: { fr: "hot" }, defaultLang: "fr", languages: ["fr"], description: { fr: "" } } });
      act(() => {
        window.dispatchEvent(
          new CustomEvent("site-config-update", { detail: updated })
        );
      });
      expect(result.current.config.meta.title.fr).toBe("hot");
    });

    it("nettoie le listener au démontage", () => {
      const config = makeConfig();
      const wrapper = ({ children }: PropsWithChildren) => (
        <SiteProvider config={config}>{children}</SiteProvider>
      );
      const { result, unmount } = renderHook(() => useSiteCtx(), { wrapper });
      const captured = result.current.config;
      unmount();

      // après unmount, dispatcher l'event ne doit pas crasher ni rien faire
      expect(() => {
        window.dispatchEvent(
          new CustomEvent("site-config-update", { detail: makeConfig() })
        );
      }).not.toThrow();
      // pas d'erreur, et la ref capturée n'est pas modifiée
      expect(captured).toBe(config);
    });
  });

  describe("context absent", () => {
    it("SiteContext est null par défaut hors Provider", () => {
      const { result } = renderHook(() => useContext(SiteContext));
      expect(result.current).toBeNull();
    });
  });
});
