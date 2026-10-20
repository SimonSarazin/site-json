/**
 * Ancrage horizontal de l'infobulle d'une bulle de `map-bubbles`, d'après la position de la bulle sur la
 * carte (`item.x`, en %) : centrée au milieu, calée sur le bord près des bords. Centrée sur une bulle de
 * bord (Boulonnais, x:6 %), l'infobulle sortait de la carte et sa fin devenait illisible.
 *
 * Classes écrites en toutes lettres : Tailwind ne détecte pas un nom construit à l'exécution.
 */
export function tooltipAnchorClass(x: number): string {
  if (x < 25) return "left-0";
  if (x > 75) return "right-0";
  return "left-1/2 -translate-x-1/2";
}
