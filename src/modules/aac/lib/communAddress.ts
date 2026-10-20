/**
 * Adresse d'un commun et facette des communes (fonctions pures).
 *
 * Le rôle `adresse` vise en général une question `tpls.forms.cplx.address`, stockée en
 * `StoredLocality` (objet, pas chaîne). La désérialisation passe par `parseStoredToEntries`
 * (`coform/utils/coformLocality`), qui gère toutes les formes présentes en base.
 */
import { parseStoredToEntries } from "@/modules/coform/utils/coformLocality";
import type { PostalAddress } from "@/lib/location/types";
import type { AacFacetOption } from "./directoryFilterActions";

/** Adresse d'un commun, telle que l'UI la consomme. */
export interface AacCommunAddress {
  /** Commune affichée et groupée par le filtre ; `""` pour une adresse en texte libre. */
  locality: string;
  postalCode: string;
  streetAddress: string;
  country: string;
  /** Id `cities` de l'adresse principale, `""` sinon. */
  localityId: string;
  /** Ligne complète (« 12 rue Juliette Dodu, 97400, Saint-Denis »). */
  label: string;
}

const toStr = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Rue, code postal, commune, les vides retirés. */
function formatLine(a: PostalAddress): string {
  return [a.streetAddress, a.postalCode, a.addressLocality]
    .map((p) => toStr(p))
    .filter(Boolean)
    .join(", ");
}

/**
 * Adresse lue dans la valeur brute du champ configuré ; `null` si elle ne décrit rien.
 * Une chaîne (question texte) devient le `label`, sans commune.
 */
export function readCommunAddress(raw: unknown): AacCommunAddress | null {
  if (typeof raw === "string") {
    const label = raw.trim();
    return label
      ? { locality: "", postalCode: "", streetAddress: "", country: "", localityId: "", label }
      : null;
  }

  const entries = parseStoredToEntries(raw);
  if (entries.length === 0) return null;

  // Adresse principale (`center`), sinon la première, comme côté coform.
  const main = entries.find((e) => e.center) ?? entries[0];
  const address = main.address ?? {};

  const resolved: AacCommunAddress = {
    locality: toStr(address.addressLocality),
    postalCode: toStr(address.postalCode),
    streetAddress: toStr(address.streetAddress),
    country: toStr(address.addressCountry),
    localityId: toStr(address.localityId),
    label: formatLine(address),
  };

  // Une entrée sans libellé ne décrit rien d'affichable.
  return resolved.label || resolved.locality ? resolved : null;
}

/**
 * Facette « Commune », jumelle de `countTagFacets`. Identifiant = nom de la commune
 * (pas `localityId`) : deux homonymes comptent pour une seule option.
 */
export function countCommuneFacets(
  cards: readonly { address: AacCommunAddress | null }[]
): AacFacetOption[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const locality = card.address?.locality;
    if (!locality) continue;
    counts.set(locality, (counts.get(locality) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, label: id, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"));
}
