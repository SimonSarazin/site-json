/**
 * `unknown` → `string | null` : une string non vide (espaces retirés), sinon `null`. Une fiche d'une
 * collection partagée par plusieurs costums peut porter un champ texte en forme inattendue (objet,
 * nombre) — `<p>{value}</p>` sur un objet lève « Objects are not valid as a React child ». Mutualise
 * le `toText` dupliqué entre `ProfileSsbeAbout.tsx` et `ProfileParent62About.tsx`.
 */
export function toText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
