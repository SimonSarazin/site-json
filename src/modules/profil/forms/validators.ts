/**
 * Validators cross-champ NOMMÉS du domaine profil, enregistrés dans le `validateRegistry` du moteur
 * (cf. P1 de doc/formulaire-config-driven.md). Les descripteurs TS peuvent passer la fonction inline ;
 * les configs JSON les référencent par CLÉ (`validateFn`/`validate`). Même fonction = même comportement.
 * Importer ce module (side-effect) enregistre les clés — fait par le host config-driven (P2).
 */
import { registerValidate, type FormValues, type ValidateFn } from "@/modules/formEngine";
import { addressValidate } from "./addCommon";

/** Adresse saisie sans ville sélectionnée (localityId) → erreur sur `addressLocality`. */
export const addressValid: ValidateFn = addressValidate;

/**
 * Dates d'événement : ponctuel (recurrency=false) → startDate/endDate requis + endDate ≥ startDate ;
 * récurrent → openingHours non vide. N'inclut PAS `organizer` (sa condition varie selon le contexte
 * add/edit — gérée par chaque descripteur).
 */
export const eventDatesValid: ValidateFn = (v: FormValues) => {
  const issues: Array<{ path: string; message: string }> = [];
  if (!v.recurrency) {
    if (!v.startDate) issues.push({ path: "startDate", message: "validation.startDate.required" });
    if (!v.endDate) issues.push({ path: "endDate", message: "validation.endDate.required" });
    if (v.startDate && v.endDate && new Date(v.endDate as string) < new Date(v.startDate as string))
      issues.push({ path: "endDate", message: "validation.endDate.afterStart" });
  } else {
    const oh = Array.isArray(v.openingHours) ? (v.openingHours as unknown[]).filter((h) => h !== "") : [];
    if (oh.length === 0) issues.push({ path: "openingHours", message: "validation.openingHours.required" });
  }
  return issues;
};

registerValidate("addressValid", addressValid);
registerValidate("eventDatesValid", eventDatesValid);
