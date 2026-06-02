// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mockUseCocolight = vi.fn();
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => mockUseCocolight(),
}));

import { useInteropConfig } from "./useInteropConfigQuery";

function setEntity(serverData: Record<string, unknown> | null) {
  mockUseCocolight.mockReturnValue({
    entity: serverData ? { serverData } : null,
  });
}

describe("useInteropConfig", () => {
  beforeEach(() => {
    mockUseCocolight.mockReset();
  });

  describe("entity absente", () => {
    it("retourne toutes les valeurs nulles/false quand entity = null", () => {
      mockUseCocolight.mockReturnValue({ entity: null });
      const { result } = renderHook(() => useInteropConfig());
      expect(result.current.discourseUrl).toBeNull();
      expect(result.current.wikiBaseUrl).toBeNull();
      expect(result.current.wikiApiUrl).toBeNull();
      expect(result.current.costumSlug).toBeNull();
      expect(result.current.hasDiscourse).toBe(false);
      expect(result.current.hasWiki).toBe(false);
    });
  });

  describe("entity sans costum", () => {
    it("retourne valeurs vides quand serverData ne contient pas costum", () => {
      setEntity({ slug: "foo" });
      const { result } = renderHook(() => useInteropConfig());
      expect(result.current.discourseUrl).toBeNull();
      expect(result.current.wikiBaseUrl).toBeNull();
      expect(result.current.hasDiscourse).toBe(false);
      expect(result.current.hasWiki).toBe(false);
      expect(result.current.costumSlug).toBe("foo");
    });

    it("retourne valeurs vides quand costum n'a pas de clé interop", () => {
      setEntity({ slug: "bar", costum: { other: "x" } });
      const { result } = renderHook(() => useInteropConfig());
      expect(result.current.discourseUrl).toBeNull();
      expect(result.current.hasDiscourse).toBe(false);
    });
  });

  describe("Discourse configuré", () => {
    it("expose discourseUrl + hasDiscourse=true", () => {
      setEntity({
        slug: "tiers-lieux",
        costum: { interop: { DISCOURSE_URL: "https://forum.example" } },
      });
      const { result } = renderHook(() => useInteropConfig());
      expect(result.current.discourseUrl).toBe("https://forum.example");
      expect(result.current.hasDiscourse).toBe(true);
      expect(result.current.hasWiki).toBe(false);
    });

    it("DISCOURSE_URL vide → hasDiscourse=false", () => {
      setEntity({
        slug: "x",
        costum: { interop: { DISCOURSE_URL: "" } },
      });
      const { result } = renderHook(() => useInteropConfig());
      expect(result.current.hasDiscourse).toBe(false);
    });
  });

  describe("MediaWiki configuré", () => {
    it("expose wikiBaseUrl + wikiApiUrl + hasWiki=true", () => {
      setEntity({
        slug: "x",
        costum: {
          interop: {
            WIKI_BASE_URL: "https://wiki.example",
            WIKI_API_URL: "https://wiki.example/api.php",
          },
        },
      });
      const { result } = renderHook(() => useInteropConfig());
      expect(result.current.wikiBaseUrl).toBe("https://wiki.example");
      expect(result.current.wikiApiUrl).toBe("https://wiki.example/api.php");
      expect(result.current.hasWiki).toBe(true);
    });

    it("WIKI_BASE_URL absent mais WIKI_API_URL présent → hasWiki=false", () => {
      setEntity({
        slug: "x",
        costum: { interop: { WIKI_API_URL: "https://wiki.example/api.php" } },
      });
      const { result } = renderHook(() => useInteropConfig());
      expect(result.current.hasWiki).toBe(false);
      expect(result.current.wikiApiUrl).toBe("https://wiki.example/api.php");
    });
  });

  describe("Discourse + MediaWiki ensemble", () => {
    it("expose les 2 quand les deux sont configurés", () => {
      setEntity({
        slug: "combo",
        costum: {
          interop: {
            DISCOURSE_URL: "https://forum.example",
            WIKI_BASE_URL: "https://wiki.example",
            WIKI_API_URL: "https://wiki.example/api.php",
          },
        },
      });
      const { result } = renderHook(() => useInteropConfig());
      expect(result.current.hasDiscourse).toBe(true);
      expect(result.current.hasWiki).toBe(true);
      expect(result.current.costumSlug).toBe("combo");
    });
  });

  describe("costumSlug", () => {
    it("renvoie le slug depuis serverData.slug", () => {
      setEntity({ slug: "my-costum", costum: {} });
      const { result } = renderHook(() => useInteropConfig());
      expect(result.current.costumSlug).toBe("my-costum");
    });

    it("renvoie null quand slug absent de serverData", () => {
      setEntity({ costum: {} });
      const { result } = renderHook(() => useInteropConfig());
      expect(result.current.costumSlug).toBeNull();
    });
  });
});
