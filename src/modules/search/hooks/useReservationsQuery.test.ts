import { describe, it, expect, vi } from "vitest";
import { fetchReservationAnswers, type ReservationAnswersHost } from "./useReservationsQuery";
import type { ReservationsConf } from "../schema";

const STEP = "etape";
const conf: ReservationsConf = {
  form: "form1",
  step: STEP,
  fields: { finder: "F", user: "U", userOrga: "O", activity: "A", slots: "S" },
};

/** Réponse au format réel : champs SOUS `answers[<step>]`, finders sous la clé préfixée. */
const answer = (id: string, poiId: string, orgaId?: string) => ({
  serverData: {
    _id: { $id: id },
    answers: {
      [STEP]: {
        [`finder${STEP}F`]: { [poiId]: { name: `Équipement ${poiId}` } },
        ...(orgaId ? { [`finder${STEP}O`]: { [orgaId]: { name: `Club ${orgaId}` } } } : {}),
      },
    },
  },
});

/** Paginator SDK minimal : pages enchaînées par `next()`. */
const pages = (...lots: unknown[][]) => {
  const page = (i: number): Record<string, unknown> => ({
    results: lots[i],
    hasNext: i < lots.length - 1,
    next: () => Promise.resolve(page(i + 1)),
  });
  return page(0);
};

const host = (mock: ReturnType<typeof vi.fn>) => ({ coformAnswersSearch: mock }) as unknown as ReservationAnswersHost;

describe("fetchReservationAnswers — fetcher partagé des réservations", () => {
  it("interroge le formulaire avec le chemin de finder fourni, hors sourceKey du site", async () => {
    const search = vi.fn().mockResolvedValue(pages([]));
    await fetchReservationAnswers(host(search), conf, { "answers.etape.finderetapeF.poi1": { $exists: true } }, 200);
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        notSourceKey: true,
        filters: { form: "form1", "answers.etape.finderetapeF.poi1": { $exists: true } },
        fields: ["answers", "created", "collection"],
      }),
    );
  });

  it("enchaîne les pages et analyse chaque réponse (équipement + organisation)", async () => {
    const search = vi.fn().mockResolvedValue(pages([answer("a1", "poi1", "orga1")], [answer("a2", "poi2")]));
    const r = await fetchReservationAnswers(host(search), conf, {}, 200);
    expect(r.map((x) => [x.id, x.resourceIds, x.userId])).toEqual([
      ["a1", ["poi1"], "orga1"],
      ["a2", ["poi2"], undefined],
    ]);
  });

  it("s'arrête au plafond `max`", async () => {
    const search = vi.fn().mockResolvedValue(pages([answer("a1", "poi1")], [answer("a2", "poi2")]));
    const r = await fetchReservationAnswers(host(search), conf, {}, 1);
    expect(r).toHaveLength(1);
  });
});
