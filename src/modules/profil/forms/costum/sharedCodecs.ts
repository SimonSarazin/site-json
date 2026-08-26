/**
 * Codecs COMMUNS partagés (le « commun » du moteur de formulaire) : un codec par CONCEPT/WIDGET, au lieu d'un
 * transform par entité (avant : `poi:addressRead` ≈ `tl:addressRead` ; `tl:hoursRead` propre au costum…).
 * Deux familles :
 *  - codec de GROUPE de sérialisation (`address:read`, paramétré par sa liste de clés) ;
 *  - codec lié à un WIDGET spécialisé (`openingHours:read/write`) — fourni AUTOMATIQUEMENT via `WIDGET_DEFAULTS`
 *    (cf. compileCostumSchema) : tout champ `widget:"openingHours"` hérite read/write, zéro code dans le costum.
 * Importé en side-effect par chaque `costum/<entity>/fns`.
 */
import { formatISO } from "date-fns";
import { registerTransform } from "@/modules/formEngine/engine/transforms";
import { coerceString } from "@/modules/formEngine/engine/coercions";
import { buildAddressFromForm } from "../../hooks/mutationUtils";
import { DAYS } from "@/constants/DAYS";

/** Clés d'une adresse PostalAddress (objet serveur `address` ↔ champs plats du form), incl. les 11 SIG
 *  (level1..5/level*Name/codeInsee) requis pour le round-trip complet (parité legacy Element::updateField ;
 *  contrat SDK ≥ 1.0.173). level2 = niveau d'autres pays (Wallonie/BE, provinces/MG), level5 = EPCI. */
export const ADDRESS_KEYS = [
  "addressCountry", "addressLocality", "localityId", "postalCode", "streetAddress",
  "level1", "level1Name", "level2", "level2Name", "level3", "level3Name",
  "level4", "level4Name", "level5", "level5Name", "codeInsee",
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

/**
 * WRITE adresse GÉNÉRIQUE (clé `address:write`) : champs plats du form → objet `address` imbriqué (PostalAddress),
 * `undefined` si pas de `localityId` (→ clé omise). `buildAddressFromForm` ne lit que les champs adresse de `all`.
 * Unifie l'ex-`poi:addressWrite` (buildAddressFromForm direct) et `tl:addressWrite` (transformFormDataWithAddress().address) —
 * tous deux ≡ buildAddressFromForm(<champs adresse>). Référencé par `serializeGroups.address.write` des 2 costums.
 */
registerTransform("address:write", (all) => buildAddressFromForm((all ?? {}) as Record<string, string>));

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
  // Pas de modèle 7 jours (champ jamais rendu, défaut absent — un champ `object` sans default est
  // `undefined` depuis defaultForType) → clé OMISE, comme « aucun jour ouvert ». Sans cette garde,
  // `hours[day]` crashait sur undefined et emportait la CRÉATION entière de 3 forms SSBE.
  if (v == null || typeof v !== "object") return undefined;
  const oh = buildOpeningHoursPayload(v as OpeningHoursModel);
  return oh.some((e) => e !== "") ? oh : undefined; // omet openingHours si aucun jour ouvert
});

// ── Codec de GROUPE `telephone` (structure serveur `{mobile:[…], fixe:[…]}`) — LOSSLESS ──────────────────
// Le form saisit UNE chaîne ; le serveur stocke un objet à listes (mesuré : 133/133 orgs SSBE et 65/65
// cyber-reunion). La 1ʳᵉ version (champ simple, write `{mobile:[v]}`) était DESTRUCTRICE, prouvé sur la
// base : une fiche `{fixe:[…]}` relue puis re-sauvée sans modification migrait vers `mobile`, et les
// numéros MULTIPLES étaient tronqués au premier. D'où un GROUPE de sérialisation (patron `address`) avec
// deux membres cachés qui transportent ce que la chaîne seule ne peut pas dire :
//   `_telSlot` — la clé d'origine (mobile|fixe) : la réécriture retourne dans le MÊME emplacement ;
//   `_telRest` — les AUTRES clés de l'objet, JSON tel quel : rien n'est perdu au round-trip.
// Multiples : la chaîne est le join ", " de la liste, le write la re-split — l'aller-retour no-op
// reproduit l'objet à l'identique (le diff du SDK n'émet alors rien).
registerTransform("telephone:read", (t) => {
  const o = (t ?? {}) as Record<string, unknown>;
  const slot = Array.isArray(o.mobile) && o.mobile.length ? "mobile" : Array.isArray(o.fixe) && o.fixe.length ? "fixe" : "mobile";
  const liste = Array.isArray(o[slot]) ? (o[slot] as unknown[]).map(String) : [];
  const reste: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (k !== slot) reste[k] = v;
  return {
    telephone: liste.join(", "),
    _telSlot: slot,
    ...(Object.keys(reste).length ? { _telRest: JSON.stringify(reste) } : {}),
  };
});
registerTransform("telephone:write", (all) => {
  const v = (all as Record<string, unknown>)?.telephone;
  const s = typeof v === "string" ? v.trim() : "";
  const slot = String((all as Record<string, unknown>)?._telSlot ?? "mobile") === "fixe" ? "fixe" : "mobile";
  let reste: Record<string, unknown> = {};
  try { reste = JSON.parse(String((all as Record<string, unknown>)?._telRest ?? "{}")) as Record<string, unknown>; } catch { /* reste vide */ }
  const nums = s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
  if (!nums.length && !Object.keys(reste).length) return undefined; // rien → clé omise (create) / intacte (edit sans emitEmpty)
  return { ...reste, ...(nums.length ? { [slot]: nums } : {}) };
});

// ── Codec WRITE générique `omitEmpty` ─────────────────────────────────────────────────────────────
// OMET le champ du payload si la valeur est vide (`null`/`""`/`[]`/`{}`) → clé absente (omit-empty),
// sinon passe la valeur BRUTE. Pour des champs OPTIONNELS/CONDITIONNELS déclarés (sérialisation) que
// l'AJV ADD rejette si envoyés vides — ex. `startDate`/`endDate`/`openingHours` pilotés par le composite
// `eventDates` : en mode ponctuel `openingHours` reste `[]` (→ omis) ; en récurrent `startDate`/`endDate`
// restent `""` (→ omis). Pendant costum du « le base ne déclare pas ces champs » (donc ne les émet pas).
registerTransform("omitEmpty", (v) =>
  v == null ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && Object.keys(v as object).length === 0)
    ? undefined
    : v,
);

// ── Codecs WRITE date d'EVENT (pendants costum de `pf:isoDate`/`pf:timeZone` de editProfilePayload, qui
// ne sont PAS importés par les forms costum) ──────────────────────────────────────────────────────────
// `eventDate:write` : le composite `eventDates` (EditEventDatesTab) stocke une STRING `toISOString()`
// (`…:05.000Z`, millis+Z) que le LEGACY REJETTE (« The start date is not well formated »). `formatISO(new
// Date(v))` la réémet en ISO offset LOCAL SANS millis (ex. `…:05+04:00`), le format que le base envoie et
// que le legacy accepte. Vide/invalide → `undefined` (omis, omit-empty). Identique à `pf:isoDate`.
// RECURRENCY-AWARE : le composite `eventDates` ne DÉMONTE pas les champs à la bascule (RHF
// shouldUnregister=false) → une startDate/endDate rémanente d'un mode ponctuel survivrait en récurrent.
// On l'OMET donc dès que `recurrency` est vrai (branche récurrente du contrat = openingHours, PAS de dates),
// ignorant toute valeur rémanente. Sinon : `.000Z` (composite) → offset local sans millis (accepté legacy).
registerTransform("eventDate:write", (v, all) => {
  if ((all as Record<string, unknown> | undefined)?.recurrency) return undefined; // récurrent → date omise
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : formatISO(d);
});
// RECURRENCY-AWARE : en PONCTUEL, `openingHours` (rémanent) est OMIS ; en RÉCURRENT, on NORMALISE l'array
// partiel du composite (jours cochés uniquement) en EXACTEMENT 7 entrées Mo→Su (jour vide → `""`), comme
// le form event de base (`editProfilePayload.buildOpeningHours`) — le contrat ADD_EVENT exige `minItems:7`.
registerTransform("eventOpeningHours:write", (v, all) => {
  if (!(all as Record<string, unknown> | undefined)?.recurrency) return undefined; // ponctuel → omis
  const arr = Array.isArray(v) ? v : [];
  return DAYS.map((day) => arr.find((o) => (o as { dayOfWeek?: unknown })?.dayOfWeek === day) ?? "");
});
// `eventTimeZone:write` : fuseau du navigateur si non fourni (comme `pf:timeZone`) — métadonnée envoyée par
// le form de base (`timeZone=Indian/Reunion`).
registerTransform("eventTimeZone:write", (v) =>
  v && String(v).trim() ? v : Intl.DateTimeFormat().resolvedOptions().timeZone,
);

// ── Codec SOCIAL (clés `social:read`/`social:write`) ──────────────────────────────────────────────────────
// Objet serveur `socialNetwork` `{facebook:url, …}` ↔ liste form `[{platform,url}]`. Clé PARTAGÉE NOMMÉE (le
// widget `fieldArray` est générique → ne peut pas posséder ce codec ; le sens « social » vient du champ).
// Référencé explicitement par le champ. Ex-`tl:socialRead`/`tl:socialWrite`. (Le profil a son propre `pf:*`,
// widget 9-grille différent.)
function parseSocialLinks(value: unknown): Array<{ platform: string; url: string }> {
  if (Array.isArray(value)) {
    return value
      .filter((s): s is { platform: string; url: string } => s !== null && typeof s === "object" && "platform" in s && "url" in s)
      .map((s) => ({ platform: String(s.platform ?? ""), url: String(s.url ?? "") }));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, url]) => typeof url === "string" && (url as string).trim().length > 0)
      .map(([platform, url]) => ({ platform, url: String(url) }));
  }
  return [];
}
function buildSocialNetwork(links?: Array<{ platform: string; url: string }>): Record<string, string> | undefined {
  const obj: Record<string, string> = {};
  for (const l of links ?? []) {
    const p = (l.platform ?? "").trim();
    const url = (l.url ?? "").trim();
    if (p && url) obj[p] = url;
  }
  return Object.keys(obj).length > 0 ? obj : undefined;
}
registerTransform("social:read", (v) => parseSocialLinks(v));
registerTransform("social:write", (links) => buildSocialNetwork(links as Array<{ platform: string; url: string }>));

// ── Codecs de GROUPE PARAMÉTRÉS ───────────────────────────────────────────────────────────────────────────
// Codec générique + `params` en DONNÉES (serializeGroups[x].params, reçus en 3e arg). Réutilisables par toute
// entité : la spécificité (noms de champs, valeurs connues, format) vit dans le schéma, pas dans du code costum.
const pickStr = (v: unknown): string => (typeof v === "string" ? v : "");

// monthYear : 2 selects mois+année ↔ date-string serveur. params {monthField, yearField, day}. (Ex-tl:openingDate*.)
registerTransform("monthYear:read", (v, _all, p) => {
  const mf = String(p?.monthField ?? "month"), yf = String(p?.yearField ?? "year");
  const s = pickStr(v);
  let month = "", year = "";
  if (s) {
    const parts = s.split("/");
    if (parts.length === 3) { month = parts[1] ?? ""; year = parts[2] ?? ""; }
    else if (parts.length === 2) { month = parts[0] ?? ""; year = parts[1] ?? ""; }
    else { year = s; }
  }
  return { [mf]: month, [yf]: year };
});
registerTransform("monthYear:write", (_v, all, p) => {
  const mf = String(p?.monthField ?? "month"), yf = String(p?.yearField ?? "year"), day = String(p?.day ?? "01");
  const month = pickStr((all as Record<string, unknown>)[mf]), year = pickStr((all as Record<string, unknown>)[yf]);
  if (!month && !year) return undefined;
  if (month && year) return `${day}/${month}/${year}`;
  return month || year;
});

// enumOrOther : select « valeur connue OU 'autre' + texte libre » ↔ valeur serveur. params {valueField, otherField, known[], other}. (Ex-tl:manageModel*.)
registerTransform("enumOrOther:read", (v, _all, p) => {
  const vf = String(p?.valueField ?? "value"), of = String(p?.otherField ?? "valueOther");
  const known = (p?.known as string[] | undefined) ?? [], other = String(p?.other ?? "autre");
  const s = pickStr(v);
  if (!s) return { [vf]: "", [of]: "" };
  return known.includes(s) ? { [vf]: s, [of]: "" } : { [vf]: other, [of]: s };
});
registerTransform("enumOrOther:write", (_v, all, p) => {
  const vf = String(p?.valueField ?? "value"), of = String(p?.otherField ?? "valueOther"), other = String(p?.other ?? "autre");
  const a = all as Record<string, unknown>, v = pickStr(a[vf]);
  if (!v) return undefined;
  return v === other && pickStr(a[of]) ? pickStr(a[of]) : v;
});

// multiCsv : multi-select (+ 'autre' → texte libre) ↔ CSV serveur. params {arrayField, otherField, other, separator, readOtherFrom}. (Ex-tl:typePlace*.)
registerTransform("multiCsv:read", (v, all, p) => {
  const af = String(p?.arrayField ?? "items"), of = String(p?.otherField ?? "itemsOther");
  const readOtherFrom = p?.readOtherFrom ? String(p.readOtherFrom) : undefined;
  let arr: string[] = [];
  if (Array.isArray(v)) arr = v.filter((x): x is string => typeof x === "string");
  else if (typeof v === "string" && v) arr = v.split(",").map((s) => s.trim()).filter(Boolean);
  const other = readOtherFrom ? pickStr((all as Record<string, unknown>)[readOtherFrom]) : "";
  return { [af]: arr, [of]: other };
});
registerTransform("multiCsv:write", (_v, all, p) => {
  const af = String(p?.arrayField ?? "items"), of = String(p?.otherField ?? "itemsOther");
  const other = String(p?.other ?? "autre"), sep = String(p?.separator ?? ", ");
  const a = all as Record<string, unknown>;
  const arr = (a[af] as string[] | undefined) ?? [], otherText = pickStr(a[of]).trim();
  const parts = arr.map((f) => (f === other ? otherText : f)).filter(Boolean);
  return parts.length > 0 ? parts.join(sep) : undefined;
});

