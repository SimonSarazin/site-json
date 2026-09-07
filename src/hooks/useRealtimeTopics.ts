import { useEffect, useRef, useState } from "react";

/**
 * ABONNEMENT AUX TOPICS TEMPS RÉEL (cocolight docs/29 §7).
 *
 * Ouvre `/api/realtime/flux` — le relais du serveur SSR, qui va chercher un ticket auprès du
 * backend que la lib interroge (legacy PHP ou Node) puis ouvre le flux vers le hub. Le hub ne
 * transporte QU'UN NOM DE TOPIC, jamais de donnée : ce hook n'écrit donc jamais dans un cache,
 * il invalide. C'est ce qui le rend générique — il ne connaît aucun module.
 *
 * ── POURQUOI PAS `EventSource` ──────────────────────────────────────────────────────────────
 * `EventSource` ne sait pas envoyer d'en-tête, donc pas d'`Authorization`. On perd en échange sa
 * reconnexion automatique et son `Last-Event-ID` — d'où la politique de reprise explicite plus bas.
 *
 * ── LE MODE DÉGRADÉ EST UN MODE NORMAL ──────────────────────────────────────────────────────
 * Un déploiement sans `REALTIME_HUB_URL` répond 503 `{realtime:false}`. Ce n'est pas une panne :
 * c'est un site qui n'a pas de temps réel, et qui doit rester en interrogation périodique sans
 * afficher la moindre erreur. On ne réessaie alors PAS — réessayer indéfiniment sur une
 * fonctionnalité absente est le défaut classique de ce genre de client.
 */

/** Plancher et plafond de la reprise. Le jitter évite que tous les clients reviennent ensemble. */
const REPRISE_MIN_MS = 1_000;
const REPRISE_MAX_MS = 60_000;

export type EtatTempsReel =
  | "inactif" | "connexion" | "absent" | "coupe"
  | "connecte"
  /**
   * Flux OUVERT, mais le bus ne porte plus rien : le capteur a perdu son curseur côté serveur.
   *
   * ⚠️ C'est un état à part entière, et pas un détail. Le client ne peut PAS le déduire — les
   * battements continuent d'arriver. Sans cet état il resterait sur son intervalle lent en croyant
   * être en temps réel, donc MOINS réactif qu'avant. Il doit reprendre son interrogation normale.
   */
  | "degrade";

export interface OptionsTempsReel {
  /** Le jeton de la lib. Sans lui, on n'ouvre rien : le flux est authentifié. */
  jeton: string | null;
  /** Appelé à chaque topic reçu. DOIT être stable ou passer par une ref — voir plus bas. */
  surTopic: (topic: string) => void;
  /** Appelé quand le hub demande une resynchronisation complète (disjoncteur, reprise du bus). */
  surResync?: (motif: string) => void;
  /** Coupe l'abonnement sans démonter le composant. */
  actif?: boolean;
  chemin?: string;
}

/** Reprise exponentielle plafonnée, avec ±30 % de jitter. */
function delaiReprise(essai: number): number {
  const base = Math.min(REPRISE_MIN_MS * 2 ** essai, REPRISE_MAX_MS);
  return Math.round(base * (0.7 + Math.random() * 0.6));
}

export function useRealtimeTopics(o: OptionsTempsReel): { etat: EtatTempsReel } {
  const [etat, setEtat] = useState<EtatTempsReel>("inactif");

  // Les rappels passent par une ref : sans cela, un `surTopic` recréé à chaque rendu — le cas
  // normal en React — relancerait l'effet, donc rouvrirait la connexion, à chaque rendu.
  const rappels = useRef(o);
  rappels.current = o;

  const { jeton, actif = true, chemin = "/api/realtime/flux" } = o;

  useEffect(() => {
    // Rien côté serveur : le SSR n'a pas de connexion longue à tenir, et `fetch` y serait un
    // appel sortant pendant le rendu.
    if (typeof window === "undefined") return;
    if (!actif || !jeton) { setEtat("inactif"); return; }

    let vivant = true;
    let essai = 0;
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    let abandon: AbortController | undefined;

    const planifier = () => {
      if (!vivant) return;
      const d = delaiReprise(essai++);
      minuterie = setTimeout(() => { void connecter(); }, d);
    };

    const traiter = (bloc: string) => {
      let evenement = "message";
      let donnees = "";
      for (const ligne of bloc.split("\n")) {
        if (ligne.startsWith(":")) continue;                    // commentaire (`: ping`)
        if (ligne.startsWith("event:")) evenement = ligne.slice(6).trim();
        else if (ligne.startsWith("data:")) donnees += ligne.slice(5).trim();
      }
      if (!donnees) return;
      let charge: { topic?: string; motif?: string };
      try { charge = JSON.parse(donnees); } catch { return; }

      if (evenement === "topic" && charge.topic) rappels.current.surTopic(charge.topic);
      else if (evenement === "resync") rappels.current.surResync?.(charge.motif ?? "resync");
      else if (evenement === "sante") {
        const degrade = (charge as { etat?: string }).etat === "degrade";
        setEtat(degrade ? "degrade" : "connecte");
        // Un rétablissement laisse un TROU : entre la perte et le retour, aucun topic n'est parti.
        // On resynchronise, sinon le client reste sur un état périmé en se croyant à jour.
        if (!degrade) rappels.current.surResync?.(charge.motif ?? "bus retabli");
      }
      // `bye` et `reauth` : le serveur ferme volontairement. Le flux se terminera de lui-même et
      // la boucle replanifiera — avec jitter, ce qui étale le retour de tous les clients.
    };

    const connecter = async () => {
      if (!vivant) return;
      setEtat("connexion");
      abandon = new AbortController();
      try {
        const r = await fetch(chemin, {
          headers: { authorization: `Bearer ${jeton}`, accept: "text/event-stream" },
          signal: abandon.signal,
        });

        if (r.status === 503) {
          // Fonctionnalité ABSENTE sur ce déploiement : on s'arrête pour de bon.
          vivant = false;
          setEtat("absent");
          return;
        }
        if (r.status === 401) {
          // Jeton refusé. Inutile d'insister : l'effet se relancera quand `jeton` changera.
          vivant = false;
          setEtat("coupe");
          return;
        }
        if (!r.ok || !r.body) { planifier(); setEtat("coupe"); return; }

        essai = 0;                                              // une connexion réussie remet à zéro
        setEtat("connecte");

        const lecteur = r.body.getReader();
        const dec = new TextDecoder();
        let tampon = "";
        for (;;) {
          const { done, value } = await lecteur.read();
          if (done) break;
          tampon += dec.decode(value, { stream: true });
          // Les événements SSE sont séparés par une ligne vide. Un bloc partiel reste au chaud.
          let coupe: number;
          while ((coupe = tampon.indexOf("\n\n")) !== -1) {
            traiter(tampon.slice(0, coupe));
            tampon = tampon.slice(coupe + 2);
          }
        }
        if (vivant) { setEtat("coupe"); planifier(); }
      } catch {
        // Abandon volontaire au démontage, ou réseau coupé. Dans le premier cas `vivant` est faux.
        if (vivant) { setEtat("coupe"); planifier(); }
      }
    };

    void connecter();

    return () => {
      vivant = false;
      if (minuterie) clearTimeout(minuterie);
      abandon?.abort();
    };
  }, [jeton, actif, chemin]);

  return { etat };
}
