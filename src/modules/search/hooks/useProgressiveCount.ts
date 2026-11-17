import { useCallback, useEffect, useRef, useState, type RefCallback } from "react";

/**
 * Affichage PAR TRANCHES d'une liste déjà chargée en entier (la liste triée par taux) : `count` éléments d'abord,
 * `step` de plus chaque fois que la sentinelle (`sentinelRef`, posée sous la liste) entre à l'écran — le
 * défilement infini de la liste paginée, sans requête. Tout rendre d'un coup coûterait des centaines de cartes.
 * `resetKey` change (autre ordre, autres filtres) : retour à la première tranche.
 */
export function useProgressiveCount(total: number, step: number, resetKey: unknown) {
  const [count, setCount] = useState(step);
  // Ajustement PENDANT le rendu (motif React « état dérivé d'une prop ») : un effet afficherait d'abord l'ancienne
  // longueur de liste sur le nouvel ordre.
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    setKey(resetKey);
    setCount(step);
  }

  const observer = useRef<IntersectionObserver | null>(null);
  const sentinelRef: RefCallback<HTMLElement> = useCallback(
    (node) => {
      observer.current?.disconnect();
      if (!node || count >= total || typeof IntersectionObserver === "undefined") return;
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) setCount((c) => Math.min(c + step, Math.max(total, step)));
      });
      observer.current.observe(node);
    },
    // Un observateur NEUF après chaque tranche (`count`) : son premier rappel dit si la sentinelle est encore à
    // l'écran (écran haut, cartes denses) et enchaîne la tranche suivante. Gardé d'une tranche à l'autre, il ne
    // rappelait qu'en ENTRANT à l'écran : la liste s'arrêtait là (même motif que `lastItemRef`, useInfiniteQueryScroll).
    [step, total, count],
  );
  useEffect(() => () => observer.current?.disconnect(), []);

  const shown = Math.min(count, total);
  return { count: shown, hasMore: shown < total, sentinelRef };
}
