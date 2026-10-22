import { useEffect, useId, useSyncExternalStore } from "react";

/**
 * Qui monte la MODALE d'un espace, sur cette page : une seule par espace.
 *
 * Plusieurs écrans ouvrent le même espace : la fiche d'un commun, et le formulaire qu'elle ouvre
 * par-dessus, dont chaque question a son bouton ; ailleurs, un formulaire seul. Chacun se déclare
 * HÔTE, et un seul monte la modale — le premier par rang (la page avant un formulaire posé sur
 * elle), puis par arrivée. Les autres boutons ouvrent l'espace par l'adresse, comme ceux des
 * paliers ; deux modales du même espace s'ouvriraient l'une sur l'autre.
 *
 * Rien au serveur : un hôte se déclare dans un effet, donc au navigateur seulement — la modale ne se
 * rend jamais côté serveur, où la marque du lanceur n'existe pas (doc/38, devoirs de l'hôte).
 */
export type SpaceHostRank = "page" | "form";

const RANGS: Readonly<Record<SpaceHostRank, number>> = { page: 0, form: 1 };

interface Hote {
  readonly id: string;
  readonly rang: number;
  readonly arrivee: number;
}

const hotes = new Map<string, readonly Hote[]>();
const abonnes = new Set<() => void>();
let arrivees = 0;

function prevenir(): void {
  for (const abonne of abonnes) abonne();
}

/** Déclare un hôte de l'espace `space` (sa clé, `answers:65a1…`) ; rend de quoi le retirer. */
export function declareSpaceHost(space: string, id: string, rank: SpaceHostRank): () => void {
  arrivees += 1;
  const hote: Hote = { id, rang: RANGS[rank], arrivee: arrivees };
  hotes.set(space, [...(hotes.get(space) ?? []), hote]);
  prevenir();
  return () => {
    const restants = (hotes.get(space) ?? []).filter(autre => autre !== hote);
    if (restants.length > 0) hotes.set(space, restants);
    else hotes.delete(space);
    prevenir();
  };
}

/** L'hôte qui monte la modale de cet espace, ou `null` s'il n'y en a pas. */
export function spaceHostOf(space: string): string | null {
  let elu: Hote | null = null;
  for (const hote of hotes.get(space) ?? []) {
    if (elu === null || hote.rang < elu.rang || (hote.rang === elu.rang && hote.arrivee < elu.arrivee)) elu = hote;
  }
  return elu?.id ?? null;
}

function abonner(rappel: () => void): () => void {
  abonnes.add(rappel);
  return () => {
    abonnes.delete(rappel);
  };
}

/**
 * L'appelant monte-t-il la modale de cet espace ? Il s'en déclare hôte tant qu'il est monté. Faux
 * au serveur et au premier rendu du navigateur : la déclaration se fait dans un effet.
 */
export function useSpaceHost(space: string, rank: SpaceHostRank): boolean {
  const id = useId();
  useEffect(() => declareSpaceHost(space, id, rank), [space, id, rank]);
  return useSyncExternalStore(abonner, () => spaceHostOf(space) === id, () => false);
}
