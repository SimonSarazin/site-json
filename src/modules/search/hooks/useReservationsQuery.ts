import { useQuery } from "@tanstack/react-query";
import type { Answer, Organization, PaginatorPage, Project } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";
import { parseReservationAnswer, type Reservation } from "../lib/reservations";
import type { ReservationsConf } from "../schema";

const DEFAULT_MAX_ANSWERS = 200;
const PAGE_SIZE = 100;

/** Porteur du `coformAnswersSearch` scopé costum : l'entité du site, ou celle d'`initApi` au SSR. */
export type ReservationAnswersHost = Pick<Organization | Project, "coformAnswersSearch">;

/**
 * Réservations du form `conf.form` dont un chemin de finder existe (`finderFilter`), pages
 * enchaînées jusqu'à `max` — fetcher PARTAGÉ des lectures par ressource (ce hook), par organisation
 * (`useOrgaReservationsQuery`) et par périmètre (`useReservationUsersQuery`, aussi au prefetch SSR).
 * Filtre MongoDB BRUT sur le chemin du finder SOUS `answers` (convention vérifiée en base) +
 * `notSourceKey: true` (les answers ne portent pas le sourceKey du site — même précédent que SSBE).
 */
export async function fetchReservationAnswers(
  entity: ReservationAnswersHost,
  conf: ReservationsConf,
  finderFilter: Record<string, unknown>,
  max: number,
): Promise<Reservation[]> {
  let page: PaginatorPage<Answer> = await entity.coformAnswersSearch({
    searchType: ["answers"],
    countType: ["answers"],
    count: true,
    indexMin: 0,
    indexStep: Math.min(max, PAGE_SIZE),
    notSourceKey: true,
    filters: { form: conf.form, ...finderFilter },
    // ⚠️ "collection" OBLIGATOIRE : sans lui, _linkEntities élimine
    // silencieusement tous les résultats (piège SDK vérifié).
    fields: ["answers", "created", "collection"],
  });

  const all: Answer[] = [...page.results];
  // Pagination séquentielle bornée : le volume d'answers croîtra avec les
  // saisons — on ne dépend jamais d'une seule page.
  while (page.hasNext && typeof page.next === "function" && all.length < max) {
    page = await page.next();
    all.push(...page.results);
  }

  return all
    .map((a) =>
      parseReservationAnswer(
        (a as { serverData?: Record<string, unknown> }).serverData ?? {},
        conf,
      ),
    )
    .filter((r): r is Reservation => r !== null);
}

/**
 * Réservations d'une ressource : answers du form `conf.form` dont le finder
 * pointe la ressource (cf. `fetchReservationAnswers`).
 *
 * Le composant consommateur n'est monté qu'à l'ouverture du dialog de détail
 * → la query ne part qu'à ce moment-là (pas de prefetch SSR).
 */
export function useReservationsQuery({
  resourceId,
  conf,
}: {
  resourceId: string;
  conf?: ReservationsConf;
}) {
  const { entity } = useCocolight();

  return useQuery<Reservation[]>({
    queryKey: SEARCH_QUERY_KEYS.RESERVATIONS(conf?.form ?? "", resourceId),
    enabled: Boolean(entity && conf && resourceId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!entity || !conf) return [];
      const finderPath =
        `answers.${conf.step}.finder${conf.step}${conf.fields.finder}.${resourceId}`;
      return fetchReservationAnswers(
        entity,
        conf,
        { [finderPath]: { $exists: true } },
        conf.maxAnswers ?? DEFAULT_MAX_ANSWERS,
      );
    },
  });
}
