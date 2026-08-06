/**
 * Squelette d'attente d'un widget chargé en `lazy()` — la même barre grise pour tous les
 * `<Suspense fallback>` du moteur de formulaire.
 *
 * Extrait le 2026-07-29 : la définition était DUPLIQUÉE à l'identique dans
 * `formEngine/widgets/registry.tsx` et `profil/forms/registerWidgets.tsx`. Un fichier
 * dédié supprime le doublon et rend chacun des deux fichiers exempt de composant, ce qui
 * rétablit le rafraîchissement à chaud (`react-refresh/only-export-components`).
 *
 * Il vit dans formEngine et non dans profil pour respecter l'inversion de dépendance
 * revendiquée par `registry.tsx` : formEngine est LEAF, c'est profil qui l'importe.
 *
 * `animate-pulse` n'est volontairement PAS gardé par `prefers-reduced-motion` : ici
 * l'animation PORTE l'information « ça charge » (cf. le plancher de `styles/shared.css`,
 * qui ne fige que les animations décoratives).
 */
export const WidgetFallback = () => <div className="h-10 animate-pulse rounded-md bg-muted" />;

export default WidgetFallback;
