/**
 * Mapping aligné sur les `states` de `commonTableV2.php` (lignes 695-740).
 * 5 paliers de couleur, identifiés par tranche de 0.5 :
 *   ]0, 2[ Acceptable #28a745  → green
 *   [2, 3[ Tolérable  #17a2b8  → cyan
 *   [3, 4[ Modéré     #007bff  → blue
 *   [4, 5[ Urgent     #ffc107  → amber
 *   {5}    Critique   #dc3545  → red
 *   {0}    label caché (non renseigné)
 *
 * Retourne uniquement `{idx, trackTint, textColor}` — le label est résolu
 * par l'appelant via i18n (`coform.commonTable.note.level.{idx}`).
 */
export function getNoteAppearance(value: number): {
  idx: number;
  trackTint: string;
  textColor: string;
} {
  if (value <= 0) {
    return { idx: 0, trackTint: "", textColor: "text-muted-foreground" };
  }
  if (value < 2) {
    return {
      idx: 1,
      trackTint: "[&_[data-slot=slider-range]]:bg-green-600",
      textColor: "text-green-600",
    };
  }
  if (value < 3) {
    return {
      idx: 2,
      trackTint: "[&_[data-slot=slider-range]]:bg-cyan-600",
      textColor: "text-cyan-600",
    };
  }
  if (value < 4) {
    return {
      idx: 3,
      trackTint: "[&_[data-slot=slider-range]]:bg-blue-600",
      textColor: "text-blue-600",
    };
  }
  if (value < 5) {
    return {
      idx: 4,
      trackTint: "[&_[data-slot=slider-range]]:bg-amber-500",
      textColor: "text-amber-600",
    };
  }
  return {
    idx: 5,
    trackTint: "[&_[data-slot=slider-range]]:bg-red-600",
    textColor: "text-red-600",
  };
}
