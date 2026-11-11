/**
 * Recherche texte et carte de l'annuaire des ressources (`coform-resource-directory`) — CÔTÉ
 * NAVIGATEUR. Le backend (`Navigator::getRessourceTL`) ne sait chercher ni par lieu porteur ni par
 * ville ; l'annuaire charge de toute façon l'ensemble de ses ressources et de leurs lieux porteurs.
 */

import type { ResourceNameFallback } from "./resourceDirectory";

type Translate = (key: string, fallback?: string, params?: Record<string, unknown>) => string;

/**
 * Nom affiché d'une ressource — UNE règle pour la carte, l'aperçu, la recherche et la carte
 * géographique : nom saisi, sinon libellé de repli traduit (« Coworking », « N salles de réunion »),
 * sinon nom du lieu porteur, sinon « Lieu inconnu ».
 */
export function resourceDisplayName(
  model: { name?: string; nameFallback?: ResourceNameFallback },
  t: Translate,
  parentName?: string,
): string {
  return (
    model.name ??
    (model.nameFallback ? t(model.nameFallback.key, undefined, model.nameFallback.params) : undefined) ??
    parentName ??
    t("resourceDirectory.unknownPlace")
  );
}

/** Minuscules, sans accents ni espaces superflus : « Lillé  » ≡ « lille ». */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Chaque mot de la recherche se trouve-t-il dans l'un des textes de la ressource (nom du service,
 * nom du lieu porteur, ville, code postal) ? Recherche vide → vrai.
 */
export function matchesResourceSearch(texts: ReadonlyArray<string | null | undefined>, query: string): boolean {
  const words = normalizeSearchText(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeSearchText(texts.filter(Boolean).join(" "));
  return words.every((w) => haystack.includes(w));
}

/** Point de carte d'un service : ses coordonnées (les siennes ou celles de son lieu porteur), son lieu. */
export interface ServicePoint {
  id: string;
  parentId?: string;
  lng: number;
  lat: number;
}

/**
 * Position de chaque service sur la carte : la sienne, sinon celle de son lieu porteur, sinon celle d'un
 * autre service du même lieu. Ni le lieu porteur ni toutes ses réponses ne sont toujours géolocalisés
 * (mesuré : 10 services sur 25 sans position propre, dont les lieux n'en ont pas non plus) ; leurs
 * services géolocalisés suffisent à placer les autres. Sans aucune de ces sources : non placé.
 */
export function resolveServicePoints(
  services: ReadonlyArray<{
    id: string;
    parentId?: string;
    own: { lng: number; lat: number } | null;
    parent: { lng: number; lat: number } | null;
  }>,
): ServicePoint[] {
  const parSoeur = new Map<string, { lng: number; lat: number }>();
  for (const s of services) {
    if (s.parentId && s.own && !parSoeur.has(s.parentId)) parSoeur.set(s.parentId, s.own);
  }
  return services.flatMap((s) => {
    const pos = s.own ?? s.parent ?? (s.parentId ? parSoeur.get(s.parentId) : undefined);
    return pos ? [{ id: s.id, ...(s.parentId ? { parentId: s.parentId } : {}), lng: pos.lng, lat: pos.lat }] : [];
  });
}

/**
 * Un repère par LIEU, et non par service : un lieu porte jusqu'à une vingtaine de services, dont des
 * repères superposés resteraient indissociables même au zoom maximal. Regroupe par LIEU PORTEUR
 * (`parentId`) et non par point : deux lieux d'un même bâtiment (ou géocodés au centre de leur commune)
 * restent deux repères, et un lieu dont un service a sa propre position n'en donne qu'un. Repère placé
 * à la position du lieu quand elle est connue (`placeCoords`), sinon à celle de son premier service.
 * Service sans lieu : regroupé par point exact. Ordre d'arrivée ; la popup du repère les liste
 * (`MapPopupResourcePlace`).
 */
export function groupServicesByPlace(
  points: readonly ServicePoint[],
  placeCoords: (parentId: string) => { lng: number; lat: number } | null | undefined = () => null,
): Array<{ parentId?: string; lng: number; lat: number; ids: string[] }> {
  const groupes = new Map<string, { parentId?: string; lng: number; lat: number; ids: string[] }>();
  for (const p of points) {
    const cle = p.parentId ? `lieu:${p.parentId}` : `point:${p.lng},${p.lat}`;
    const g = groupes.get(cle);
    if (g) {
      g.ids.push(p.id);
      continue;
    }
    const pos = (p.parentId ? placeCoords(p.parentId) : null) ?? p;
    groupes.set(cle, { ...(p.parentId ? { parentId: p.parentId } : {}), lng: pos.lng, lat: pos.lat, ids: [p.id] });
  }
  return [...groupes.values()];
}

export interface ServiceSuggestion {
  id: string;
  /** Nom du service. */
  title: string;
  /** Lieu porteur et ville. */
  subtitle: string;
}

/**
 * Suggestions de services pour une saisie : mêmes champs et même règle que la recherche de
 * l'annuaire (`matchesResourceSearch`), dans l'ordre de l'annuaire, plafonnées à `limit`. Saisie de
 * moins de 2 caractères → aucune.
 */
export function buildServiceSuggestions(
  resources: ReadonlyArray<{ id: string; name: string; parentName?: string; locality?: string; postalCode?: string }>,
  query: string,
  limit = 8,
): ServiceSuggestion[] {
  if (normalizeSearchText(query).length < 2) return [];
  const out: ServiceSuggestion[] = [];
  for (const r of resources) {
    if (!matchesResourceSearch([r.name, r.parentName, r.locality, r.postalCode], query)) continue;
    out.push({ id: r.id, title: r.name, subtitle: [r.parentName, r.locality].filter(Boolean).join(" · ") });
    if (out.length >= limit) break;
  }
  return out;
}
