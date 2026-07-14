import { useQuery } from "@tanstack/react-query";
import type { Answer, PaginatorPage } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";
import { parseReservationAnswer, type Reservation } from "../lib/reservations";
import type { ReservationsConf } from "../schema";

const DEFAULT_MAX_ANSWERS = 200;
const PAGE_SIZE = 100;

/**
 * Réservations d'une ressource : answers du form `conf.form` dont le finder
 * pointe la ressource. Filtre MongoDB BRUT sur le chemin du finder SOUS
 * `answers` (convention vérifiée en base) + `notSourceKey: true` (les answers
 * ne portent pas le sourceKey du site — même précédent que SSBE).
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
      const max = conf.maxAnswers ?? DEFAULT_MAX_ANSWERS;
      const finderPath =
        `answers.${conf.step}.finder${conf.step}${conf.fields.finder}.${resourceId}`;

      let page: PaginatorPage<Answer> = await entity.coformAnswersSearch({
        searchType: ["answers"],
        countType: ["answers"],
        count: true,
        indexMin: 0,
        indexStep: Math.min(max, PAGE_SIZE),
        notSourceKey: true,
        filters: { form: conf.form, [finderPath]: { $exists: true } },
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
    },
  });
}
