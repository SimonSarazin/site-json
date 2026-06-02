// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────
const mockTNs = vi.fn();
const mockTData = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: (_ns?: string) => ({ t: mockTNs }),
}));
vi.mock("@/hooks/useLocalization", () => ({
  useLocalization: () => ({ t: mockTData }),
}));

import { useT } from "../useT";

describe("useT", () => {
  beforeEach(() => {
    mockTNs.mockReset();
    mockTData.mockReset();
  });

  describe("clé string (namespace i18n)", () => {
    it("appelle useTranslation().t avec la clé", () => {
      mockTNs.mockReturnValue("Hello");
      const { result } = renderHook(() => useT("modules/myMod"));
      const out = result.current("hello");
      expect(mockTNs).toHaveBeenCalledWith("hello", expect.objectContaining({ defaultValue: "hello" }));
      expect(out).toBe("Hello");
    });

    it("passe le fallback comme defaultValue", () => {
      mockTNs.mockReturnValue("Translated");
      const { result } = renderHook(() => useT("ns"));
      result.current("missing.key", "Mon fallback");
      expect(mockTNs).toHaveBeenCalledWith(
        "missing.key",
        expect.objectContaining({ defaultValue: "Mon fallback" })
      );
    });

    it("retourne le fallback si t() renvoie la clé telle quelle", () => {
      mockTNs.mockImplementation((key: string) => key);
      const { result } = renderHook(() => useT("ns"));
      const out = result.current("missing.key", "Mon fallback");
      expect(out).toBe("Mon fallback");
    });

    it("retourne la traduction si elle diffère de la clé (pas le fallback)", () => {
      mockTNs.mockReturnValue("Traduit");
      const { result } = renderHook(() => useT("ns"));
      const out = result.current("some.key", "Mon fallback");
      expect(out).toBe("Traduit");
    });

    it("passe les interpolationParams à i18next", () => {
      mockTNs.mockReturnValue("Bonjour Alice");
      const { result } = renderHook(() => useT("ns"));
      result.current("greeting", undefined, { name: "Alice" });
      expect(mockTNs).toHaveBeenCalledWith(
        "greeting",
        expect.objectContaining({ name: "Alice" })
      );
    });

    it("utilise la clé comme defaultValue si fallback omis", () => {
      mockTNs.mockReturnValue("X");
      const { result } = renderHook(() => useT("ns"));
      result.current("my.key");
      expect(mockTNs).toHaveBeenCalledWith(
        "my.key",
        expect.objectContaining({ defaultValue: "my.key" })
      );
    });
  });

  describe("clé LocalizedString (sans namespace)", () => {
    it("délègue à useLocalization().t pour les objets LocalizedString", () => {
      mockTData.mockReturnValue("bonjour");
      const { result } = renderHook(() => useT());
      const out = result.current({ fr: "bonjour", en: "hello" });
      expect(mockTData).toHaveBeenCalledWith({ fr: "bonjour", en: "hello" }, undefined);
      expect(out).toBe("bonjour");
    });

    it("propage le fallback à useLocalization().t", () => {
      mockTData.mockReturnValue("default");
      const { result } = renderHook(() => useT());
      result.current({}, "default");
      expect(mockTData).toHaveBeenCalledWith({}, "default");
    });

    it("ignore mockTNs pour les LocalizedString", () => {
      mockTData.mockReturnValue("x");
      const { result } = renderHook(() => useT());
      result.current({ fr: "x" });
      expect(mockTNs).not.toHaveBeenCalled();
    });
  });

  describe("sans namespace fourni", () => {
    it("fonctionne aussi pour les clés string", () => {
      mockTNs.mockReturnValue("OK");
      const { result } = renderHook(() => useT());
      const out = result.current("some.key");
      expect(out).toBe("OK");
    });
  });
});
