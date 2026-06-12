import { describe, it, expect } from "vitest";
import type { Answer, FormId } from "@communecter/cocolight-api-client";
import {
  DEFAULT_SERVICE_PRICING_PATHS,
  accumulateMin,
  toInt,
  extractServicePricingAnswers,
  buildServicePricingStats,
  buildServicePricingServices,
  formatCapacityRange,
  servicePricingStatLabel,
  type ServicePricingPaths,
} from "./servicePricingAnswers";

/* ── Fixtures ────────────────────────────────────────────────────────────── */

/** Pose `value` à `path` (clés séparées par des points) dans `obj`. */
function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts.slice(0, -1)) {
    cur[p] = cur[p] ?? {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

/** Construit un doc Answer dont `serverData` porte les champs aux chemins donnés. */
function answerDoc(fields: Record<string, unknown>): Answer {
  const serverData: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(fields)) setPath(serverData, path, value);
  return { serverData } as unknown as Answer;
}

/** Chemins courts et lisibles — la table par défaut est testée à part. */
const PATHS: ServicePricingPaths = {
  meeting: { id: "form-meeting", room: "answers.m.rooms" },
  coworking: {
    id: "form-cowork",
    place: "answers.c.place",
    price: { hourly: "answers.c.ph", halfDay: "answers.c.phd", fullDay: "answers.c.pfd" },
  },
  accommodation: {
    id: "form-lodge",
    place: "answers.l.place",
    price: { bed: "answers.l.bed", room: "answers.l.room" },
  },
};

/* ── accumulateMin ───────────────────────────────────────────────────────── */

describe("accumulateMin", () => {
  it("RÉGRESSION : un 0 explicite ne réinitialise pas le minimum ([5,0,8] → 5)", () => {
    const result = [5, 0, 8].reduce<number>((acc, v) => accumulateMin(acc, v), 0);
    expect(result).toBe(5);
  });

  it("prend la 1ʳᵉ valeur positive puis garde le minimum", () => {
    expect(accumulateMin(0, 7)).toBe(7);
    expect(accumulateMin(7, 3)).toBe(3);
    expect(accumulateMin(3, 9)).toBe(3);
  });

  it("ignore undefined et les valeurs ≤ 0", () => {
    expect(accumulateMin(5, undefined)).toBe(5);
    expect(accumulateMin(0, undefined)).toBe(0);
    expect(accumulateMin(5, 0)).toBe(5);
    expect(accumulateMin(5, -2)).toBe(5);
  });
});

/* ── toInt ───────────────────────────────────────────────────────────────── */

describe("toInt", () => {
  it("parse les entiers (y compris préfixes numériques) et tronque les décimaux", () => {
    expect(toInt("12")).toBe(12);
    expect(toInt(12.9)).toBe(12);
    expect(toInt("7 €")).toBe(7);
  });

  it("retourne undefined pour le non-numérique", () => {
    expect(toInt("abc")).toBeUndefined();
    expect(toInt("")).toBeUndefined();
    expect(toInt(undefined)).toBeUndefined();
  });
});

/* ── extractServicePricingAnswers ────────────────────────────────────────── */

describe("extractServicePricingAnswers", () => {
  it("retourne des agrégats vides sans réponses", () => {
    const agg = extractServicePricingAnswers(undefined, PATHS);
    expect(agg.coworking).toEqual({ place: 0, price: { hourly: 0, halfDay: 0, fullDay: 0 }, count: 0 });
    expect(agg.meeting.count).toBe(0);
    expect(agg.accommodation.count).toBe(0);
  });

  it("coworking : somme les places, minimum des prix positifs (0 ignoré)", () => {
    const answers = {
      "form-cowork": [
        answerDoc({ "answers.c.place": "3", "answers.c.ph": "5" }),
        answerDoc({ "answers.c.place": "5", "answers.c.ph": "0", "answers.c.phd": "12" }),
        answerDoc({ "answers.c.place": "2", "answers.c.ph": "8" }),
      ],
    } as unknown as Record<FormId, Answer[]>;
    const { coworking } = extractServicePricingAnswers(answers, PATHS);
    expect(coworking.place).toBe(10);
    expect(coworking.price.hourly).toBe(5); // pas 8 : le 0 du 2ᵉ doc est ignoré
    expect(coworking.price.halfDay).toBe(12);
    expect(coworking.count).toBe(3);
  });

  it("meeting : commonTable — saute l'en-tête, min/somme des capacités, min des prix", () => {
    const answers = {
      "form-meeting": [
        answerDoc({
          "answers.m.rooms": [
            ["Salle", "Desc", "Cap. min", "Cap. max", "€/h", "€/demi-j", "€/j"], // ligne 0 = en-têtes
            ["A", "", "10", "30", "15", "25", "40"],
            ["B", "", "4", "20", "0", "20", "35"],
            "ligne corrompue (non-tableau)",
          ],
        }),
      ],
    } as unknown as Record<FormId, Answer[]>;
    const { meeting } = extractServicePricingAnswers(answers, PATHS);
    expect(meeting.place.min).toBe(4);
    expect(meeting.place.max).toBe(50); // 30 + 20
    expect(meeting.price.hourly).toBe(15); // le 0 de la salle B est ignoré
    expect(meeting.price.halfDay).toBe(20);
    expect(meeting.price.fullDay).toBe(35);
    expect(meeting.count).toBe(2);
  });

  it("accommodation : somme les couverts, minimum lit/chambre", () => {
    const answers = {
      "form-lodge": [
        answerDoc({ "answers.l.place": "6", "answers.l.bed": "18", "answers.l.room": "45" }),
        answerDoc({ "answers.l.place": "4", "answers.l.bed": "15" }),
      ],
    } as unknown as Record<FormId, Answer[]>;
    const { accommodation } = extractServicePricingAnswers(answers, PATHS);
    expect(accommodation.place).toBe(10);
    expect(accommodation.price.bed).toBe(15);
    expect(accommodation.price.room).toBe(45);
    expect(accommodation.count).toBe(2);
  });

  it("sans surcharge : utilise la table par défaut (Navigator des Tiers-Lieux)", () => {
    const d = DEFAULT_SERVICE_PRICING_PATHS.coworking;
    const answers = {
      [d.id]: [answerDoc({ [d.place]: "7", [d.price.hourly]: "3" })],
    } as unknown as Record<FormId, Answer[]>;
    const { coworking } = extractServicePricingAnswers(answers);
    expect(coworking.place).toBe(7);
    expect(coworking.price.hourly).toBe(3);
  });

  it("surcharge PAR CATÉGORIE : coworking surchargé, accommodation reste sur les défauts", () => {
    const d = DEFAULT_SERVICE_PRICING_PATHS.accommodation;
    const answers = {
      "form-cowork": [answerDoc({ "answers.c.place": "5" })],
      [d.id]: [answerDoc({ [d.place]: "8", [d.price.bed]: "20" })],
    } as unknown as Record<FormId, Answer[]>;
    const agg = extractServicePricingAnswers(answers, { coworking: PATHS.coworking });
    expect(agg.coworking.place).toBe(5);
    expect(agg.accommodation.place).toBe(8);
    expect(agg.accommodation.price.bed).toBe(20);
  });
});

/* ── buildServicePricingStats / Services ─────────────────────────────────── */

const FULL_ANSWERS = {
  "form-cowork": [answerDoc({ "answers.c.place": "12", "answers.c.phd": "10" })],
  "form-meeting": [
    answerDoc({ "answers.m.rooms": [[], ["A", "", "2", "8", "0", "0", "30"]] }),
  ],
  "form-lodge": [answerDoc({ "answers.l.place": "20" })], // capacité sans prix
} as unknown as Record<FormId, Answer[]>;

describe("buildServicePricingStats", () => {
  it("requirePrice: false (grille) — la capacité seule suffit", () => {
    const stats = buildServicePricingStats(extractServicePricingAnswers(FULL_ANSWERS, PATHS), { requirePrice: false });
    expect(stats.map((s) => s.kind)).toEqual(["coworking", "meeting", "accommodation"]);
    expect(stats[0].count).toBe(12);
    expect(stats[1].range).toEqual({ min: 2, max: 8 });
  });

  it("requirePrice: true (détail) — exclut les catégories non tarifées", () => {
    const stats = buildServicePricingStats(extractServicePricingAnswers(FULL_ANSWERS, PATHS), { requirePrice: true });
    expect(stats.map((s) => s.kind)).toEqual(["coworking", "meeting"]); // accommodation sans prix
  });
});

describe("buildServicePricingServices", () => {
  it("prend la 1ʳᵉ unité de prix disponible (horaire → demi-journée → journée)", () => {
    const services = buildServicePricingServices(extractServicePricingAnswers(FULL_ANSWERS, PATHS));
    expect(services).toEqual([
      { kind: "coworking", unit: "halfDay", price: 10 },
      { kind: "meeting", unit: "fullDay", price: 30 },
    ]);
  });
});

/* ── Formatage / libellés ────────────────────────────────────────────────── */

describe("formatCapacityRange", () => {
  it("formate min-max / min seul / max seul / vide", () => {
    expect(formatCapacityRange({ min: 2, max: 8 })).toBe("2-8");
    expect(formatCapacityRange({ min: 2, max: 0 })).toBe("2");
    expect(formatCapacityRange({ min: 0, max: 8 })).toBe("8");
    expect(formatCapacityRange({ min: 0, max: 0 })).toBe("");
  });
});

describe("servicePricingStatLabel", () => {
  it("retourne la clé i18n + params par catégorie", () => {
    expect(servicePricingStatLabel({ kind: "coworking", count: 12 })).toEqual({
      key: "card.servicePricing.coworkingPlaces",
      params: { value: 12 },
    });
    expect(servicePricingStatLabel({ kind: "meeting", count: 0, range: { min: 2, max: 8 } })).toEqual({
      key: "card.servicePricing.meetingPersons",
      params: { value: "2-8" },
    });
    expect(servicePricingStatLabel({ kind: "accommodation", count: 20 })).toEqual({
      key: "card.servicePricing.accommodationCovers",
      params: { value: 20 },
    });
  });
});
