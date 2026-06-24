/**
 * Codecs de GROUPE COMMUNS aux costums (le « commun » du moteur de formulaire). Un seul codec par concept,
 * paramétré par sa liste de clés — au lieu d'un transform par entité (avant : `poi:addressRead` ≈
 * `tl:addressRead`, même logique dupliquée). Importé en side-effect par chaque `costum/<entity>/fns`.
 */
import { registerTransform } from "@/modules/formEngine/engine/transforms";
import { coerceString } from "@/modules/formEngine/engine/coercions";

/** Clés d'une adresse PostalAddress (objet serveur `address` ↔ champs plats du form), incl. les 9 SIG
 *  (level1..4/level*Name/codeInsee) requis pour le round-trip complet (parité buildEditDefaults). */
export const ADDRESS_KEYS = [
  "addressCountry", "addressLocality", "localityId", "postalCode", "streetAddress",
  "level1", "level1Name", "level2", "level2Name", "level3", "level3Name", "level4", "level4Name", "codeInsee",
] as const;

/**
 * READ adresse GÉNÉRIQUE (clé `address:read`) : objet serveur → champs plats. OMIT-EMPTY — un champ vide est
 * OMIS du retour → le SOCLE (createEmptyDefaults/getDefaultTiersLieuxValues) fournit le défaut (pays de scope
 * pour poi, "" pour tiers-lieu). seedEntity = {...socle, ...read} ; omettre les vides préserve donc le socle.
 * Remplace `poi:addressRead` (coerceString) ET `tl:addressRead` (pickString) — équivalents pour des strings.
 */
registerTransform("address:read", (a) => {
  const o = (a ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of ADDRESS_KEYS) {
    const v = coerceString(o[k]);
    if (v) out[k] = v; // vide → omis (le socle fournit le défaut)
  }
  return out;
});
