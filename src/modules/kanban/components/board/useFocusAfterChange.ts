import { useCallback, useEffect, useRef } from 'react';

/**
 * Rend le focus a `findTarget()` au prochain changement de `signal` — si, et
 * seulement si, le focus a ete PERDU entre-temps.
 *
 * Le cas vise : un geste fait disparaitre l'element qui portait le focus
 * (masquer une colonne depuis son menu, clore le jalon d'une colonne). Le
 * navigateur rend alors le focus a `<body>` et la navigation clavier repart du
 * haut de la page. `arm()` se pose AU GESTE ; la disparition arrive un rendu
 * plus tard (mise a jour optimiste), et c'est la que le focus est replace.
 * Focus encore ailleurs (une boite ouverte, un champ) : on ne le vole pas.
 *
 * `findTarget` doit etre stable (`useCallback`).
 */
export function useFocusAfterChange(signal: unknown, findTarget: () => HTMLElement | null): () => void {
  const armedRef = useRef(false);

  useEffect(() => {
    if (!armedRef.current) return;
    armedRef.current = false;
    const active = document.activeElement;
    if (active === null || active === document.body) findTarget()?.focus();
  }, [signal, findTarget]);

  return useCallback(() => {
    armedRef.current = true;
  }, []);
}
