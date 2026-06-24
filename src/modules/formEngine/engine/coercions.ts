/**
 * Coercions de type GÉNÉRIQUES du moteur (formEngine) — fonctions pures + enregistrement comme transforms
 * nommés (`coerce:*`) dans le registre. Évitent la duplication des coerceurs « type » par entité
 * (avant : `poi:toString`/`tl:pickNumberString`/… ré-implémentaient la même chose). Les descripteurs
 * référencent désormais les clés génériques `coerce:string|number|bool|stringArray|dateYMD`.
 *
 * Importé en side-effect par le barrel formEngine → les `coerce:*` sont enregistrés dès le chargement du
 * moteur (avant tout seedEntity/buildPayload). Les transforms DOMAINE (adresse, social, geo, openingHours,
 * entityRef…) restent dans leur module métier (profil) — eux ne sont pas génériques.
 */
import { format } from "date-fns";
import { registerTransform } from "./transforms";

/** string → string ; number → String(n) ; sinon "". */
export const coerceString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
};

/** number fini → number ; string numérique → number ; vide/non-fini → undefined (champ omis). */
export const coerceNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

/** boolean → tel quel ; number → (===1) ; string ∈ {true,1,oui,yes} (insensible casse) ; sinon false. */
export const coerceBool = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return ["true", "1", "oui", "yes"].includes(value.trim().toLowerCase());
  return false;
};

/** array → strings non vides ; string → split("," ) trim filtré ; sinon []. */
export const coerceStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((e): e is string => typeof e === "string" && e.trim().length > 0);
  if (typeof value === "string") return value.split(",").map((e) => e.trim()).filter((e) => e.length > 0);
  return [];
};

/** Date / string ISO → "YYYY-MM-DD" (attendu par les pickers) ; sinon "". */
export const coerceDateYMD = (value: unknown): string => {
  const date = value instanceof Date ? value : typeof value === "string" && value.trim() ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? format(date, "yyyy-MM-dd") : "";
};

registerTransform("coerce:string", coerceString);
registerTransform("coerce:number", coerceNumber);
registerTransform("coerce:bool", coerceBool);
registerTransform("coerce:stringArray", coerceStringArray);
registerTransform("coerce:dateYMD", coerceDateYMD);
