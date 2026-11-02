import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";
import type { Reservation } from "../lib/reservations";
import type { ReservationsConf } from "../schema";
import { fetchReservationAnswers } from "./useReservationsQuery";

const DEFAULT_MAX_ANSWERS = 200;

/**
 * Réservations d'une ORGANISATION : answers du form `conf.form` dont le finder
 * `userOrga` pointe ce club. Sens INVERSE de `useReservationsQuery`, qui part
 * d'une ressource — même formulaire, même fetcher, autre chemin de finder.
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
      // Chemin du finder SOUS `answers` (convention vérifiée en base), avec la
      // clé PRÉFIXÉE `finder<step><suffixe>` — cf. `parseReservationAnswer`.
      // Un club peut réserver beaucoup de créneaux sur plusieurs saisons : le
      // fetcher enchaîne les pages, borné par `maxAnswers`.
      const finderPath =
        `answers.${conf.step}.finder${conf.step}${userOrga}.${orgaId}`;
      return fetchReservationAnswers(
        entity,
        conf,
        { [finderPath]: { $exists: true } },
        conf.maxAnswers ?? DEFAULT_MAX_ANSWERS,
      );
    },
  });
}
