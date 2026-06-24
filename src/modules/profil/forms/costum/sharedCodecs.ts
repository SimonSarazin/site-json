/**
 * Codecs COMMUNS partagés (le « commun » du moteur de formulaire) : un codec par CONCEPT/WIDGET, au lieu d'un
 * transform par entité (avant : `poi:addressRead` ≈ `tl:addressRead` ; `tl:hoursRead` propre au costum…).
 * Deux familles :
 *  - codec de GROUPE de sérialisation (`address:read`, paramétré par sa liste de clés) ;
 *  - codec lié à un WIDGET spécialisé (`openingHours:read/write`) — fourni AUTOMATIQUEMENT via `WIDGET_DEFAULTS`
 *    (cf. compileCostumSchema) : tout champ `widget:"openingHours"` hérite read/write, zéro code dans le costum.
 * Importé en side-effect par chaque `costum/<entity>/fns`.
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

// ── Codec du WIDGET `openingHours` (clés `openingHours:read`/`openingHours:write`) ────────────────────────
// Modèle form (7 jours `{enabled,start,end}`) ↔ format serveur legacy (array `{dayOfWeek:"Mo", hours:[{opens,
// closes}]}`). Appartient au WIDGET, pas au costum : fourni via WIDGET_DEFAULTS → tout champ openingHours en
// hérite. (Le profil utilise un AUTRE widget → son propre codec `pf:*`.) Ex-`tl:hoursRead`/`tl:hoursWrite`.
export interface DayHours { enabled: boolean; start: string; end: string }
export type OpeningHoursModel = {
  monday: DayHours; tuesday: DayHours; wednesday: DayHours; thursday: DayHours;
  friday: DayHours; saturday: DayHours; sunday: DayHours;
};
const OH_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_TO_DOW: Record<keyof OpeningHoursModel, string> = { monday: "Mo", tuesday: "Tu", wednesday: "We", thursday: "Th", friday: "Fr", saturday: "Sa", sunday: "Su" };
const DOW_TO_DAY: Record<string, keyof OpeningHoursModel> = { Mo: "monday", Tu: "tuesday", We: "wednesday", Th: "thursday", Fr: "friday", Sa: "saturday", Su: "sunday" };

/** Socle horaires : 7 jours décochés 08:00–18:00 (opt-in). Réutilisé par le READ (fallback) ET le défaut du form. */
export const emptyOpeningHours = (): OpeningHoursModel => ({
  monday: { enabled: false, start: "08:00", end: "18:00" },
  tuesday: { enabled: false, start: "08:00", end: "18:00" },
  wednesday: { enabled: false, start: "08:00", end: "18:00" },
  thursday: { enabled: false, start: "08:00", end: "18:00" },
  friday: { enabled: false, start: "08:00", end: "18:00" },
  saturday: { enabled: false, start: "08:00", end: "18:00" },
  sunday: { enabled: false, start: "08:00", end: "18:00" },
});

type OpeningHoursEntry = { dayOfWeek: string; hours: Array<{ opens: string; closes: string }> } | "";

/** WRITE : modèle 7 jours → array serveur (jours cochés), `""` sinon (ordre fixe). */
export function buildOpeningHoursPayload(hours: OpeningHoursModel): OpeningHoursEntry[] {
  return OH_DAYS.map<OpeningHoursEntry>((day) => {
    const slot = hours[day];
    if (slot?.enabled && slot.start && slot.end) return { dayOfWeek: DAY_TO_DOW[day], hours: [{ opens: slot.start, closes: slot.end }] };
    return "" as const;
  });
}

/** READ : array serveur → modèle 7 jours (socle décoché + jours présents cochés). */
function parseOpeningHours(raw: unknown): OpeningHoursModel {
  const result = emptyOpeningHours();
  if (!Array.isArray(raw)) return result;
  for (const entry of raw) {
    if (entry && typeof entry === "object" && "dayOfWeek" in entry && typeof (entry as { dayOfWeek: unknown }).dayOfWeek === "string") {
      const day = DOW_TO_DAY[(entry as { dayOfWeek: string }).dayOfWeek];
      const slots = (entry as { hours?: Array<{ opens?: string; closes?: string }> }).hours;
      if (day && slots && slots[0]) result[day] = { enabled: true, start: slots[0].opens ?? "08:00", end: slots[0].closes ?? "18:00" };
    }
  }
  return result;
}

registerTransform("openingHours:read", (v) => parseOpeningHours(v));
registerTransform("openingHours:write", (v) => {
  const oh = buildOpeningHoursPayload(v as OpeningHoursModel);
  return oh.some((e) => e !== "") ? oh : undefined; // omet openingHours si aucun jour ouvert
});
