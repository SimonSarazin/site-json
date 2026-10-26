import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  fetchReservationAnswers,
  fetchResourceReservations,
  resourcesReservations,
  type ReservationAnswersHost,
} from "./useReservationsQuery";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";
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

describe("fetchResourceReservations — réservations d'UNE ressource", () => {
  it("ne lit que les réponses dont le finder pointe la ressource", async () => {
    const search = vi.fn().mockResolvedValue(pages([answer("a1", "poi1", "orga1")]));
    const r = await fetchResourceReservations(host(search), conf, "poi1");
    expect(search.mock.calls[0][0]).toMatchObject({
      filters: { form: "form1", "answers.etape.finderetapeF.poi1": { $exists: true } },
    });
    expect(r.map((x) => x.id)).toEqual(["a1"]);
  });
});

describe("resourcesReservations — contrôles d'un ajout ou d'une modification d'horaire", () => {
  const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const cle = (poi: string) => SEARCH_QUERY_KEYS.RESERVATIONS(conf.form, poi);

  it("avertissement en direct (`fresh` faux) : le cache de la fiche suffit, aucun appel", async () => {
    const qc = client();
    qc.setQueryData(cle("poi1"), [{ id: "en-cache" }]);
    const search = vi.fn();
    expect(await resourcesReservations(qc, host(search), conf, ["poi1"], false)).toEqual([{ id: "en-cache" }]);
    expect(search).not.toHaveBeenCalled();
  });

  it("contrôle d'enregistrement (`fresh`) : relu au serveur, et le cache de la fiche suit", async () => {
    const qc = client();
    qc.setQueryData(cle("poi1"), [{ id: "perime" }]);
    const search = vi.fn().mockResolvedValue(pages([answer("a1", "poi1")]));
    const r = await resourcesReservations(qc, host(search), conf, ["poi1"], true);
    expect(r.map((x) => x.id)).toEqual(["a1"]);
    expect(qc.getQueryData<{ id: string }[]>(cle("poi1"))?.map((x) => x.id)).toEqual(["a1"]);
  });

  it("plusieurs équipements : leurs réservations réunies", async () => {
    const search = vi.fn()
      .mockResolvedValueOnce(pages([answer("a1", "poi1")]))
      .mockResolvedValueOnce(pages([answer("a2", "poi2")]));
    const r = await resourcesReservations(client(), host(search), conf, ["poi1", "poi2"], true);
    expect(r.map((x) => x.id).sort()).toEqual(["a1", "a2"]);
  });

  it("réseau indisponible : l'instantané en cache plutôt qu'un échec — rien pour un équipement sans cache", async () => {
    const qc = client();
    qc.setQueryData(cle("poi1"), [{ id: "en-cache" }]);
    const search = vi.fn().mockRejectedValue(new Error("hors ligne"));
    expect(await resourcesReservations(qc, host(search), conf, ["poi1", "poi2"], true)).toEqual([{ id: "en-cache" }]);
  });
});
