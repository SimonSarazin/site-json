import { useQuery } from "@tanstack/react-query";
import type { Answer, PaginatorPage } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";
import { parseReservationAnswer, type Reservation } from "../lib/reservations";
import type { ReservationsConf } from "../schema";

const DEFAULT_MAX_ANSWERS = 200;
const PAGE_SIZE = 100;

/**
 * Réservations d'une ORGANISATION : answers du form `conf.form` dont le finder
 * `userOrga` pointe ce club. Sens INVERSE de `useReservationsQuery`, qui part
 * d'une ressource — même formulaire, autre chemin de finder.
 *
 * Le rattachement se fait sur l'IDENTIFIANT, jamais sur le nom : le champ texte
 * historique ne désigne aucune fiche (homonymes, orthographes divergentes). Une
 * réponse que la reprise n'a pas rattachée n'apparaît donc pas ici — c'est
 * voulu : mieux vaut une ligne manquante qu'une ligne attribuée au mauvais club.
 *
 * Le composant consommateur n'est monté qu'à l'ouverture de la fiche
 * organisation → la query ne part qu'à ce moment-là (pas de prefetch SSR).
 */
export function useOrgaReservationsQuery({
  orgaId,
  conf,
}: {
  orgaId?: string;
  conf?: ReservationsConf;
}) {
  const { entity } = useCocolight();
  const userOrga = conf?.fields.userOrga;

  return useQuery<Reservation[]>({
    queryKey: SEARCH_QUERY_KEYS.ORGA_RESERVATIONS(conf?.form ?? "", orgaId ?? ""),
    enabled: Boolean(entity && conf && userOrga && orgaId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!entity || !conf || !userOrga || !orgaId) return [];
      const max = conf.maxAnswers ?? DEFAULT_MAX_ANSWERS;
      // Chemin du finder SOUS `answers` (convention vérifiée en base), avec la
      // clé PRÉFIXÉE `finder<step><suffixe>` — cf. `parseReservationAnswer`.
      const finderPath =
        `answers.${conf.step}.finder${conf.step}${userOrga}.${orgaId}`;

      let page: PaginatorPage<Answer> = await entity.coformAnswersSearch({
        searchType: ["answers"],
        countType: ["answers"],
        count: true,
        indexMin: 0,
        indexStep: Math.min(max, PAGE_SIZE),
        // Les answers ne portent pas le sourceKey du site (même précédent que SSBE).
        notSourceKey: true,
        filters: { form: conf.form, [finderPath]: { $exists: true } },
        // ⚠️ "collection" OBLIGATOIRE : sans lui, _linkEntities élimine
        // silencieusement tous les résultats (piège SDK vérifié).
        fields: ["answers", "created", "collection"],
      });

      const all: Answer[] = [...page.results];
      // Pagination séquentielle bornée : un club peut réserver beaucoup de
      // créneaux sur plusieurs saisons — on ne dépend jamais d'une seule page.
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
