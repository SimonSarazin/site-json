import { useQuery } from "@tanstack/react-query";
import type { Answer, PaginatorPage } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import {
  parseReservationAnswer,
  type Reservation,
} from "@/modules/search/lib/reservations";
import type { ReservationsConf } from "@/modules/search/schema";
import { OBSERVATORY_QUERY_KEYS } from "../constants/queryKeys";

/**
 * Créneaux de réservation de TOUS les équipements d'une installation.
 * DÉPENDANTE de `useInstallationPoisQuery` : `enabled` seulement quand les
 * poiIds sont connus — le `$or` de chemins finder est borné par la taille de
 * l'installation (~quelques équipements), le serveur ne renvoie que les
 * answers pertinentes (volume stable quand le form grossit).
 */
export function useInstallationAnswersQuery(
  reservations: ReservationsConf | undefined,
  poiIds: readonly string[],
) {
  const { entity } = useCocolight();

  return useQuery<Reservation[]>({
    queryKey: OBSERVATORY_QUERY_KEYS.INSTALLATION_ANSWERS(
      reservations?.form ?? "",
      poiIds,
    ),
    enabled: Boolean(entity && reservations && poiIds.length > 0),
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!entity || !reservations) return [];
      // Garde anti-`$or`-vide : sans équipement, un `$or` vide ferait crasher
      // Mongo (« $or entries need to be full objects »), le backend n'ayant
      // aucune protection. Redondant avec `enabled` mais indépendant de React Query.
      if (poiIds.length === 0) return [];
      const finderKey = `finder${reservations.step}${reservations.fields.finder}`;

      const page: PaginatorPage<Answer> = await entity.coformAnswersSearch({
        searchType: ["answers"],
        countType: ["answers"],
        count: true,
        indexMin: 0,
        // Une installation = quelques équipements → volume largement < 500.
        // TODO si une installation dépasse 500 answers : paginer via next().
        indexStep: 500,
        notSourceKey: true,
        filters: {
          form: reservations.form,
          // Idiome `$or` OBJET attendu par SearchNew::searchFilters (la clé est
          // le nom de champ). Un tableau ferait crasher Mongo « $or entries need
          // to be full objects » (cf. finderFilters.ts, mémoire
          // search-filters-backend-dsl).
          $or: Object.fromEntries(
            poiIds.map((id) => [
              `answers.${reservations.step}.${finderKey}.${id}`,
              { $exists: true },
            ]),
          ),
        },
        // ⚠️ "collection" OBLIGATOIRE : sans lui, _linkEntities élimine
        // silencieusement tous les résultats (piège SDK vérifié).
        fields: ["answers", "form", "collection", "created"],
      });

      return page.results
        .map((a) =>
          parseReservationAnswer(
            (a as { serverData?: Record<string, unknown> }).serverData ?? {},
            reservations,
          ),
        )
        .filter((r): r is Reservation => r !== null);
    },
  });
}
