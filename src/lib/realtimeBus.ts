import type { EtatTempsReel } from "@/hooks/useRealtimeTopics";

/**
 * BUS D'ABONNEMENT AU TEMPS RÉEL — **un seul flux SSE pour toute l'application**.
 *
 * `useRealtimeTopics` ouvre une connexion PAR APPEL. Tant qu'il n'y avait qu'un consommateur
 * (la cloche de notifications), c'était sans conséquence. Au deuxième — le panneau
 * « Discussions » — un même onglet en ouvrirait **deux**, et chacune coûte en réalité deux
 * connexions : navigateur → relais SSR, puis relais → hub. Ce bus rend ce coût indépendant du
 * nombre de consommateurs : N abonnés, un flux.
 *
 * ── Ce qu'il ne change pas ──────────────────────────────────────────────────────────────────
 * Le hub n'émet qu'un NOM DE SUJET, jamais de donnée. Le bus se contente de le distribuer :
 * les abonnés invalident leur cache, ils n'écrivent jamais dedans. C'est ce qui garde le
 * dispositif générique — le bus ne connaît aucun module.
 *
 * ── Pourquoi un module, et pas un contexte ──────────────────────────────────────────────────
 * Les abonnements naissent dans des effets, donc **jamais au rendu serveur** : ce module ne
 * retient rien d'une requête SSR à l'autre. Et `useSyncExternalStore` — le patron du dépôt,
 * cf. `useReducedMotion` — réclame précisément un store externe aux identités stables.
 *
 * ── ⚠ L'invariant qui fait tout l'intérêt : zéro abonné = zéro connexion ────────────────────
 * Le flux ne s'ouvre QUE s'il reste au moins un abonné. Sans cette règle, monter le fournisseur
 * à la racine ouvrirait un flux sur les sites qui n'ont ni cloche ni panneau — une connexion
 * permanente là où il n'y en avait aucune, soit exactement la régression qu'on cherche à éviter.
 */

type Rappel = () => void;

/** Abonnés par sujet. Une entrée disparaît dès que son dernier abonné s'en va. */
const parSujet = new Map<string, Set<(topic: string) => void>>();
/** Abonnés à la resynchronisation — le hub ne dit pas QUOI rafraîchir, seulement qu'il faut. */
const auResync = new Set<(motif: string) => void>();

/** Maintenu à la main : `getSnapshot` doit rendre une valeur stable, pas la recalculer. */
let nbAbonnes = 0;
let etatCourant: EtatTempsReel = "inactif";

/** Observateurs des deux valeurs que React doit suivre. */
const surCompteur = new Set<Rappel>();
const surEtat = new Set<Rappel>();

const notifier = (o: Set<Rappel>) => { for (const r of [...o]) r(); };

/** S'abonne à UN sujet. Rend la fonction de désabonnement. */
export function abonnerSujet(topic: string, rappel: (topic: string) => void): () => void {
  let jeu = parSujet.get(topic);
  if (!jeu) { jeu = new Set(); parSujet.set(topic, jeu); }
  jeu.add(rappel);
  nbAbonnes += 1;
  notifier(surCompteur);

  return () => {
    const courant = parSujet.get(topic);
    if (!courant?.delete(rappel)) return;          // déjà retiré : ne pas décompter deux fois
    if (courant.size === 0) parSujet.delete(topic);
    nbAbonnes -= 1;
    notifier(surCompteur);
  };
}

/** S'abonne aux demandes de resynchronisation complète. Compte comme un abonné. */
export function abonnerResync(rappel: (motif: string) => void): () => void {
  auResync.add(rappel);
  nbAbonnes += 1;
  notifier(surCompteur);

  return () => {
    if (!auResync.delete(rappel)) return;
    nbAbonnes -= 1;
    notifier(surCompteur);
  };
}

/** Distribue un sujet reçu du hub. Un sujet sans abonné ne coûte rien. */
export function diffuserSujet(topic: string): void {
  const jeu = parSujet.get(topic);
  if (!jeu) return;
  // Copie : un abonné qui se désabonne pendant la diffusion ne doit pas tronquer l'itération.
  for (const r of [...jeu]) r(topic);
}

export function diffuserResync(motif: string): void {
  for (const r of [...auResync]) r(motif);
}

export function poserEtat(etat: EtatTempsReel): void {
  if (etat === etatCourant) return;
  etatCourant = etat;
  notifier(surEtat);
}

/* ── Les quatre fonctions que `useSyncExternalStore` exige stables ────────────────────────── */

export function souscrireCompteur(rappel: Rappel): () => void {
  surCompteur.add(rappel);
  return () => { surCompteur.delete(rappel); };
}
export const lireCompteur = (): number => nbAbonnes;

export function souscrireEtat(rappel: Rappel): () => void {
  surEtat.add(rappel);
  return () => { surEtat.delete(rappel); };
}
export const lireEtat = (): EtatTempsReel => etatCourant;

/** Instantané serveur : aucun abonné, aucun flux. Sans lui, `useSyncExternalStore` lève en SSR. */
export const lireCompteurServeur = (): number => 0;
export const lireEtatServeur = (): EtatTempsReel => "inactif";

/** Remise à zéro — réservée aux tests, qui partagent le module d'un cas à l'autre. */
export function _reinitialiserBus(): void {
  parSujet.clear();
  auResync.clear();
  surCompteur.clear();
  surEtat.clear();
  nbAbonnes = 0;
  etatCourant = "inactif";
}
