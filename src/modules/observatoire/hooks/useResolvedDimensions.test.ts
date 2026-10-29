// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { DimensionsConfig } from "../schema";

/**
 * `useResolvedDimensions` : la `valueMap` d'une dimension `valueMapFrom` est tirée des options du filtre
 * déroulant désigné, libellés traduits. Le résultat garde sa référence d'un rendu à l'autre — `t`, recréé à
 * chaque rendu par `useT`, n'en est pas une dépendance (review de la MR 114) — et se recalcule avec la langue.
 */
const ctx = vi.hoisted(() => ({ lang: "fr" }));
const CONFIG = { pages: [] };
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: CONFIG }) }));
// Comme le vrai `useT` : une fonction NEUVE à chaque rendu, figée sur la langue de ce rendu.
vi.mock("@/hooks/useT", () => ({
  useT: () => {
    const lang = ctx.lang;
    return (key: string | Record<string, string>) => (typeof key === "string" ? key : (key[lang] ?? ""));
  },
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: ctx.lang } }) }));
// Le filtre « commune » d'une page du site : codes postaux regroupés, comme sur ESS974.
vi.mock("@/modules/search/lib/dropdownFilters", () => ({
  getDropdownFilterOwner: (_config: unknown, id: string) =>
    id === "commune"
      ? {
          pathname: "/equipements",
          filter: {
            id,
            options: [
              { label: { fr: "Saint-Denis", en: "Saint-Denis (en)" }, values: ["97400", "97490"] },
              { label: "Le Port", value: "97420" },
            ],
          },
        }
      : null,
}));

import { useResolvedDimensions } from "./useResolvedDimensions";

const DIMS: DimensionsConfig = {
  commune: { paths: ["address.postalCode"], valueMapFrom: { filter: "commune" }, valueMap: { "97420": "Port (déclaré)" } },
  type: { paths: ["type"] },
};

beforeEach(() => {
  ctx.lang = "fr";
});

describe("useResolvedDimensions", () => {
  it("tire la valueMap des options du filtre, libellés traduits ; la valueMap déclarée prime", () => {
    const { result } = renderHook(() => useResolvedDimensions(DIMS));

    expect(result.current.commune?.valueMap).toEqual({ "97400": "Saint-Denis", "97490": "Saint-Denis", "97420": "Port (déclaré)" });
    expect(result.current.type).toBe(DIMS.type);
  });

  it("même référence d'un rendu à l'autre ; recalculée au changement de langue", () => {
    const { result, rerender } = renderHook(() => useResolvedDimensions(DIMS));
    const premier = result.current;

    rerender();
    expect(result.current).toBe(premier);

    ctx.lang = "en";
    rerender();
    expect(result.current).not.toBe(premier);
    expect(result.current.commune?.valueMap?.["97400"]).toBe("Saint-Denis (en)");
  });
});
