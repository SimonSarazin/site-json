// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock i18next via react-i18next
const mockHasResourceBundle = vi.fn();
const mockLoadNamespaces = vi.fn();
const i18nMock = {
  language: "fr",
  hasResourceBundle: mockHasResourceBundle,
  loadNamespaces: mockLoadNamespaces,
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: i18nMock }),
}));

import { useLoadNamespace } from "../useLoadNamespace";

describe("useLoadNamespace", () => {
  beforeEach(() => {
    mockHasResourceBundle.mockReset();
    mockLoadNamespaces.mockReset();
  });

  describe("namespace déjà chargé", () => {
    it("retourne loaded=true sans appeler loadNamespaces", () => {
      mockHasResourceBundle.mockReturnValue(true);
      const { result } = renderHook(() => useLoadNamespace("modules/x"));
      expect(result.current.loaded).toBe(true);
      expect(mockLoadNamespaces).not.toHaveBeenCalled();
    });
  });

  describe("namespace non chargé", () => {
    it("appelle loadNamespaces avec le ns", () => {
      mockHasResourceBundle.mockReturnValue(false);
      renderHook(() => useLoadNamespace("modules/x"));
      expect(mockLoadNamespaces).toHaveBeenCalledWith("modules/x");
    });

    it("retourne loaded=false initialement", () => {
      mockHasResourceBundle.mockReturnValue(false);
      const { result } = renderHook(() => useLoadNamespace("modules/x"));
      expect(result.current.loaded).toBe(false);
    });
  });

  describe("vérifie sur la language courante de i18n", () => {
    it("passe i18n.language à hasResourceBundle", () => {
      mockHasResourceBundle.mockReturnValue(true);
      i18nMock.language = "en";
      renderHook(() => useLoadNamespace("modules/y"));
      expect(mockHasResourceBundle).toHaveBeenCalledWith("en", "modules/y");
      i18nMock.language = "fr"; // restore
    });
  });

  describe("ré-évalue lorsque ns change", () => {
    it("recharge si le namespace change vers un non-chargé", () => {
      mockHasResourceBundle.mockImplementation((_lang, ns) => ns === "loaded-ns");
      const { rerender } = renderHook(({ ns }) => useLoadNamespace(ns), {
        initialProps: { ns: "loaded-ns" },
      });
      expect(mockLoadNamespaces).not.toHaveBeenCalled();
      rerender({ ns: "missing-ns" });
      expect(mockLoadNamespaces).toHaveBeenCalledWith("missing-ns");
    });
  });
});
