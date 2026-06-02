import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.hoisted` permet d'exposer une référence accessible **avant** l'import du module testé
// (sans quoi Vitest hoiste le `vi.mock` au-dessus de la déclaration et plante avec un
// "Cannot access 'mockI18n' before initialization").
const { mockI18n } = vi.hoisted(() => ({ mockI18n: { language: "fr" } }));
vi.mock("@/i18n", () => ({ default: mockI18n }));

import { formatCurrency, formatDate, formatNumber, initials } from "./format";

describe("initials", () => {
  it("extrait les initiales de 'Jean Dupont' → 'JD'", () => {
    expect(initials("Jean Dupont")).toBe("JD");
  });

  it("retourne juste la première lettre pour un mot unique", () => {
    expect(initials("Alice")).toBe("A");
  });

  it("gère les noms multi-mots (max 2 initiales)", () => {
    expect(initials("Jean Paul Sartre")).toBe("JP");
  });

  it("UPPERCASE force les initiales en majuscules", () => {
    expect(initials("alice marie")).toBe("AM");
  });

  it("ignore les espaces multiples consécutifs", () => {
    expect(initials("Jean   Dupont")).toBe("JD");
  });

  it("retourne '' pour string vide", () => {
    expect(initials("")).toBe("");
  });
});

describe("formatCurrency", () => {
  beforeEach(() => {
    mockI18n.language = "fr";
  });

  it("formate en euros locale FR (pas de décimales)", () => {
    // L'output exact dépend du moteur Intl, on vérifie juste les invariants
    const result = formatCurrency(1234);
    expect(result).toContain("234");
    expect(result).toContain("€");
    expect(result).not.toContain(",00"); // pas de décimales
    expect(result).not.toContain(".00");
  });

  it("formate 0 sans erreur", () => {
    expect(formatCurrency(0)).toContain("0");
    expect(formatCurrency(0)).toContain("€");
  });

  it("respecte la locale active (EN)", () => {
    mockI18n.language = "en";
    const result = formatCurrency(1234);
    // En EN, le symbole € est typiquement avant le nombre
    expect(result).toContain("1,234");
  });
});

describe("formatNumber", () => {
  beforeEach(() => {
    mockI18n.language = "fr";
  });

  it("formate un grand nombre avec séparateur locale FR", () => {
    const result = formatNumber(1234567);
    // En FR : "1 234 567" (espace insécable). On vérifie juste que les chiffres sont là.
    expect(result).toMatch(/1.234.567/);
  });

  it("formate 0", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formate les nombres négatifs", () => {
    const result = formatNumber(-42);
    expect(result).toContain("42");
    expect(result.startsWith("-") || result.startsWith("−")).toBe(true);
  });
});

describe("formatDate", () => {
  beforeEach(() => {
    mockI18n.language = "fr";
  });

  it("formate un timestamp ms", () => {
    // 14 mai 2024 12:00 UTC = 1715688000000
    const result = formatDate(1715688000000);
    // En FR le format court contient le mois sous forme abrégée
    expect(result).toMatch(/\d{2}/);
    expect(result).toMatch(/2024/);
  });

  it("formate une string ISO", () => {
    const result = formatDate("2024-05-14T12:00:00Z");
    expect(result).toMatch(/2024/);
  });

  it("retourne 'Invalid Date' pour une entrée invalide (comportement natif)", () => {
    const result = formatDate("not a date");
    expect(result).toMatch(/Invalid/i);
  });

  afterEach(() => {
    mockI18n.language = "fr";
  });
});
