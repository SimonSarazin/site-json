import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { COMMENT_QUERY_KEYS } from "../constants/queryKeys";
import { threadValue } from "../lib/filKey";
import type { CommentTarget } from "../types";

/**
 * Marque un fil comme LU dès qu'il s'ouvre — appelé par `CommentThread`, donc partout où un fil
 * s'affiche (panneau, actualité, fiche), et non plus par le seul panneau.
 *
 * ── Pourquoi les identifiants non lus en paramètre ─────────────────────────────────────────
 * La plupart des ouvertures portent sur un fil DÉJÀ lu — on revient sur une conversation qu'on
 * suit. Sans ce garde-fou, chaque clic dans le panneau enverrait une écriture pour ne rien
 * changer. Liste vide, ce hook ne fait aucun appel.
 *
 * ── Ce qu'il ne refait pas ─────────────────────────────────────────────────────────────────
 * Les messages déjà marqués pendant cette visite ne le sont pas deux fois : leurs identifiants
 * sont retenus dans une ref ; seul un message NOUVEAU relance un marquage. Sans cela, le
 * rafraîchissement du panneau qui SUIT le marquage rendrait une nouvelle liste, qui
 * redéclencherait l'effet — une boucle écriture → invalidation → écriture.
 *
 * ── L'invalidation est conditionnelle ──────────────────────────────────────────────────────
 * On ne rafraîchit le panneau que si le serveur dit avoir marqué quelque chose (`marked > 0`).
 * Un fil déjà lu côté serveur ne doit pas provoquer de requête supplémentaire.
 *
 * ── Le fil, lui, est seulement PÉRIMÉ ──────────────────────────────────────────────────────
 * Le relire tout de suite effacerait sous les yeux ce qu'on vient de signaler — le point
 * « nouveau », le fond de mention. Il est marqué périmé sans être relu (`refetchType: "none"`) :
 * les repères restent pendant la lecture, et la prochaine ouverture le relit, sans eux.
 *
 * ── Les messages AFFICHÉS, et eux seuls ────────────────────────────────────────────────────
 * L'appel porte leurs identifiants (`ids`). Sans eux, le serveur marquait tout le fil : un message
 * arrivé entre le chargement et le marquage passait « lu » sans avoir été vu (revue du 16/10).
 *
 * ── Même si le fil s'est fermé entre-temps ─────────────────────────────────────────────────
 * Ces invalidations sont de l'hygiène de cache, pas un état du composant : les appliquer après
 * un démontage est sans danger, et nécessaire — le fil se démonte à chaque changement de fil,
 * et le panneau garderait sinon la pastille du fil qu'on vient de quitter.
 */
/** Plafond d'identifiants par appel — celui du serveur (`SeenAction::IDS_MAX`). Le reste part au suivant. */
const SEEN_IDS_MAX = 500;

export function useMarkThreadSeen(target: CommentTarget | null, unreadIds: readonly string[]): void {
  const { api, me } = useCocolight();
  const queryClient = useQueryClient();

  /**
   * Par fil, les messages déjà marqués pendant cette visite. Des IDENTIFIANTS, et non le fil
   * entier : un message arrivé pendant qu'on lit (temps réel, relecture) n'était jamais marqué,
   * le fil l'ayant été une fois pour toutes (A10, revue du 29/09) — sa pastille restait allumée.
   */
  const marques = useRef(new Map<string, ReadonlySet<string>>());
  /** Un marquage en vol : le rendu suivant ne doit pas en lancer un second. */
  const enVol = useRef(false);
  /**
   * Des non-lus arrivés PENDANT un marquage en vol (ou au-delà du plafond d'un appel). L'effet
   * s'arrêtait sur `enVol`, et rien ne le relançait à l'atterrissage : le message restait
   * « nouveau » jusqu'au changement suivant (revue du 16/10). `relance` rejoue l'effet — après un
   * marquage abouti seulement : un échec n'en relance aucun (cf. le `catch`).
   */
  const enAttente = useRef(false);
  const [relance, setRelance] = useState(0);

  const cle = target ? threadValue(target) : null;
  const connecte = !!me?.isConnected;
  // Clé STABLE de l'effet : la liste change d'identité à chaque rendu, pas forcément de contenu.
  const signature = unreadIds.join(",");

  useEffect(() => {
    if (!cle || !target || !connecte) return;
    const ids = signature ? signature.split(",") : [];
    const deja = marques.current.get(cle) ?? new Set<string>();
    const nouveaux = ids.filter(id => !deja.has(id));
    if (nouveaux.length === 0) return;
    if (enVol.current) { enAttente.current = true; return; }

    const envoyes = nouveaux.slice(0, SEEN_IDS_MAX);
    if (envoyes.length < nouveaux.length) enAttente.current = true;
    enVol.current = true;
    marques.current.set(cle, new Set([...deja, ...envoyes]));

    void (async () => {
      try {
        const res = await (api as unknown as {
          markCommentsSeen: (o: Record<string, unknown>) => Promise<unknown>;
        }).markCommentsSeen({
          contextType: target.type,
          contextId: target.id,
          ...(target.path ? { path: target.path } : {}),
          ids: envoyes,
        });

        const marked = Number((res as { marked?: unknown } | null)?.marked ?? 0);
        if (marked <= 0) return;

        void queryClient.invalidateQueries({
          queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX(),
          refetchType: "active",
        });
        void queryClient.invalidateQueries({
          queryKey: COMMENT_QUERY_KEYS.THREAD_PREFIX(target),
          refetchType: "none",
        });
      } catch (error) {
        // Un marquage perdu n'est pas une panne : la pastille restera allumée, et la prochaine
        // ouverture réessaiera. On rend l'ensemble d'avant pour autoriser cette seconde chance.
        marques.current.set(cle, deja);
        // … mais pas tout de suite : l'appel suivant échouerait de même, et au-delà du plafond il
        // repartirait sans fin, les mêmes 500 messages en tête — une boucle d'appels tant que le fil
        // reste ouvert. Le prochain essai attend un vrai changement : un message de plus, ou la
        // réouverture du fil.
        enAttente.current = false;
        console.warn("[useMarkThreadSeen] marquage non abouti", error);
      } finally {
        enVol.current = false;
        if (enAttente.current) {
          enAttente.current = false;
          setRelance(n => n + 1);
        }
      }
    })();
  }, [cle, target, signature, connecte, api, queryClient, relance]);
}
