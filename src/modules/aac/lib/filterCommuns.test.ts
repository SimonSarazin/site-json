import { describe, expect, it } from "vitest";
import { filterCommuns, foldForSearch } from "./filterCommuns";
import { EMPTY_AAC_FILTERS, type AacDirectoryFiltersState } from "./filtersKey";
import type { AacCommunCard } from "./parseAacAnswer";
import { EMPTY_AAC_USAGE } from "./aacUsage";

const card = (p: Partial<AacCommunCard>): AacCommunCard => ({
  id: "a",
  title: "",
  hasTitle: true,
  description: "",
  tags: [],
  maturity: null,
  imageUrl: null,
  funds: [],
  totalRequested: 0,
  totalFunded: 0,
  progressPercent: 0,
  hasFundingRequest: false,
  usersCount: 0,
  interestCount: 0,
  isSelected: null,
  usage: EMPTY_AAC_USAGE,
  createdAt: 0,
  updatedAt: 0,
  ...p,
});

const f = (p: Partial<AacDirectoryFiltersState> = {}): AacDirectoryFiltersState => ({
  ...EMPTY_AAC_FILTERS,
  ...p,
});

const CARDS = [
  card({ id: "1", title: "Comparateur de statuts", tags: ["Numérique"], maturity: "Prototype" }),
  card({ id: "2", title: "Vivants en Tiers-Lieux", tags: ["Gouvernance", "Vivant"], maturity: "Idée" }),
  card({ id: "3", title: "Yeswiki", tags: ["Numérique", "Gouvernance"], maturity: "En production" }),
  card({ id: "4", title: "Écologie appliquée", tags: [], maturity: null }),
];

const ids = (cards: AacCommunCard[]) => cards.map((c) => c.id);

describe("foldForSearch", () => {
  it("retire les accents et normalise la casse", () => {
    expect(foldForSearch("Écologie")).toBe("ecologie");
    expect(foldForSearch("  TIERS-Lieux ")).toBe("tiers-lieux");
    expect(foldForSearch("Numérique")).toBe(foldForSearch("numerique"));
  });
});

describe("filterCommuns", () => {
  it("sans filtre, tout passe", () => {
    expect(ids(filterCommuns(CARDS, f()))).toEqual(["1", "2", "3", "4"]);
  });

  it("recherche par sous-chaîne du titre", () => {
    expect(ids(filterCommuns(CARDS, f({ q: "wiki" })))).toEqual(["3"]);
    expect(ids(filterCommuns(CARDS, f({ q: "statuts" })))).toEqual(["1"]);
  });

  it("recherche INSENSIBLE aux accents, dans les deux sens", () => {
    expect(ids(filterCommuns(CARDS, f({ q: "ecologie" })))).toEqual(["4"]);
    expect(ids(filterCommuns(CARDS, f({ q: "Écologie" })))).toEqual(["4"]);
  });

  it("recherche insensible à la casse et aux espaces de bord", () => {
    expect(ids(filterCommuns(CARDS, f({ q: "  YESWIKI " })))).toEqual(["3"]);
  });

  it("tags : OR à l'intérieur de la facette", () => {
    expect(ids(filterCommuns(CARDS, f({ tags: ["Gouvernance"] })))).toEqual(["2", "3"]);
    expect(ids(filterCommuns(CARDS, f({ tags: ["Vivant", "Numérique"] })))).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("maturité : OR à l'intérieur de la facette", () => {
    expect(ids(filterCommuns(CARDS, f({ maturity: ["Idée", "Prototype"] })))).toEqual([
      "1",
      "2",
    ]);
  });

  it("AND entre facettes différentes", () => {
    expect(
      ids(filterCommuns(CARDS, f({ tags: ["Numérique"], maturity: ["Prototype"] })))
    ).toEqual(["1"]);
    expect(
      ids(filterCommuns(CARDS, f({ tags: ["Gouvernance"], maturity: ["Prototype"] })))
    ).toEqual([]);
  });

  it("un commun sans la donnée filtrée est exclu, pas inclus par défaut", () => {
    expect(ids(filterCommuns(CARDS, f({ tags: ["Numérique"] })))).not.toContain("4");
    expect(ids(filterCommuns(CARDS, f({ maturity: ["Idée"] })))).not.toContain("4");
  });

  it("combine recherche et facettes", () => {
    expect(
      ids(filterCommuns(CARDS, f({ q: "e", tags: ["Gouvernance"], maturity: ["Idée"] })))
    ).toEqual(["2"]);
  });

  it("aucun résultat ⇒ tableau vide, jamais d'exception", () => {
    expect(filterCommuns(CARDS, f({ q: "introuvable" }))).toEqual([]);
    expect(filterCommuns([], f({ q: "x" }))).toEqual([]);
  });
});
