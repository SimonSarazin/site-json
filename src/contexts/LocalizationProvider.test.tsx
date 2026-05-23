// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useContext, type PropsWithChildren } from "react";
import { LocalizationProvider } from "./LocalizationProvider";
import { LocalizationContext } from "./LocalizationContext";

function useLoc() {
  const ctx = useContext(LocalizationContext);
  if (!ctx) throw new Error("LocalizationContext not provided");
  return ctx;
}

describe("LocalizationProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("locale initial", () => {
    it("utilise defaultLocale=fr par défaut", () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <LocalizationProvider>{children}</LocalizationProvider>
      );
      const { result } = renderHook(() => useLoc(), { wrapper });
      expect(result.current.currentLocale).toBe("fr");
    });

    it("respecte defaultLocale fourni en prop", () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <LocalizationProvider defaultLocale="en">{children}</LocalizationProvider>
      );
      const { result } = renderHook(() => useLoc(), { wrapper });
      expect(result.current.currentLocale).toBe("en");
    });

    it("expose availableLocales par défaut [fr,en,es,de]", () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <LocalizationProvider>{children}</LocalizationProvider>
      );
      const { result } = renderHook(() => useLoc(), { wrapper });
      expect(result.current.availableLocales).toEqual(["fr", "en", "es", "de"]);
    });

    it("respecte availableLocales restreint", () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <LocalizationProvider availableLocales={["fr", "en"]}>
          {children}
        </LocalizationProvider>
      );
      const { result } = renderHook(() => useLoc(), { wrapper });
      expect(result.current.availableLocales).toEqual(["fr", "en"]);
    });
  });

  describe("localStorage preferred-locale", () => {
    it("charge preferred-locale depuis localStorage au montage", () => {
      localStorage.setItem("preferred-locale", "en");
      const wrapper = ({ children }: PropsWithChildren) => (
        <LocalizationProvider defaultLocale="fr">{children}</LocalizationProvider>
      );
      const { result } = renderHook(() => useLoc(), { wrapper });
      expect(result.current.currentLocale).toBe("en");
    });

    it("ignore une locale stockée non listée dans availableLocales", () => {
      localStorage.setItem("preferred-locale", "ja");
      const wrapper = ({ children }: PropsWithChildren) => (
        <LocalizationProvider defaultLocale="fr" availableLocales={["fr", "en"]}>
          {children}
        </LocalizationProvider>
      );
      const { result } = renderHook(() => useLoc(), { wrapper });
      expect(result.current.currentLocale).toBe("fr");
    });

    it("ignore localStorage vide / null", () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <LocalizationProvider defaultLocale="fr">{children}</LocalizationProvider>
      );
      const { result } = renderHook(() => useLoc(), { wrapper });
      expect(result.current.currentLocale).toBe("fr");
    });
  });

  describe("setLocale", () => {
    it("met à jour currentLocale", () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <LocalizationProvider defaultLocale="fr">{children}</LocalizationProvider>
      );
      const { result } = renderHook(() => useLoc(), { wrapper });
      expect(result.current.currentLocale).toBe("fr");
      act(() => {
        result.current.setLocale("en");
      });
      expect(result.current.currentLocale).toBe("en");
    });

    it("persiste preferred-locale dans localStorage", () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <LocalizationProvider defaultLocale="fr">{children}</LocalizationProvider>
      );
      const { result } = renderHook(() => useLoc(), { wrapper });
      act(() => {
        result.current.setLocale("es");
      });
      expect(localStorage.getItem("preferred-locale")).toBe("es");
    });
  });

  describe("fonction t (LocalizedString)", () => {
    it("retourne la traduction dans currentLocale", () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <LocalizationProvider defaultLocale="fr">{children}</LocalizationProvider>
      );
      const { result } = renderHook(() => useLoc(), { wrapper });
      const out = result.current.t({ fr: "bonjour", en: "hello" });
      expect(out).toBe("bonjour");
    });

    it("fallback sur defaultLocale si currentLocale manque", () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <LocalizationProvider defaultLocale="fr">{children}</LocalizationProvider>
      );
      const { result } = renderHook(() => useLoc(), { wrapper });
      act(() => {
        result.current.setLocale("en");
      });
      // currentLocale=en, mais texte n'a pas 'en' → fallback sur defaultLocale='fr'
      const out = result.current.t({ fr: "bonjour" });
      expect(out).toBe("bonjour");
    });

    it("fallback sur n'importe quelle locale disponible si default manque", () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <LocalizationProvider defaultLocale="es">{children}</LocalizationProvider>
      );
      const { result } = renderHook(() => useLoc(), { wrapper });
      // currentLocale='es', defaultLocale='es', mais texte n'a que 'en' → cherche dans LOCALES
      const out = result.current.t({ en: "hello" });
      expect(out).toBe("hello");
    });

    it("retourne fallback custom si aucune traduction", () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <LocalizationProvider>{children}</LocalizationProvider>
      );
      const { result } = renderHook(() => useLoc(), { wrapper });
      const out = result.current.t({}, "fallback-custom");
      expect(out).toBe("fallback-custom");
    });

    it("retourne 'Missing translation' par défaut", () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <LocalizationProvider>{children}</LocalizationProvider>
      );
      const { result } = renderHook(() => useLoc(), { wrapper });
      expect(result.current.t({})).toBe("Missing translation");
    });

    it("retourne fallback si LocalizedString est null/undefined", () => {
      const wrapper = ({ children }: PropsWithChildren) => (
        <LocalizationProvider>{children}</LocalizationProvider>
      );
      const { result } = renderHook(() => useLoc(), { wrapper });
      // @ts-expect-error null intentionnel pour tester
      expect(result.current.t(null, "no-text")).toBe("no-text");
      // @ts-expect-error undefined intentionnel pour tester
      expect(result.current.t(undefined, "no-text")).toBe("no-text");
    });
  });

  describe("LocalizationContext hors Provider", () => {
    it("vaut null par défaut", () => {
      const { result } = renderHook(() => useContext(LocalizationContext));
      expect(result.current).toBeNull();
    });
  });
});
