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
 * Adresse COMPLÈTE obligatoire : exige ville sélectionnée (`localityId`) + code postal + rue
 * (le formulaire est en cascade pays→ville→CP→rue, cf. EditLocationTab). Erreur portée sur le champ
 * CONTENEUR `address` (toujours rendu par le widget `location` → message visible même pays non saisi ;
 * les sous-champs internes n'apparaissent qu'après). Plus strict qu'`addressValid` (qui n'exige rien
 * tant que l'adresse n'est pas entamée).
 */
export const addressComplete: ValidateFn = (v: FormValues) =>
  (v.localityId && v.postalCode && v.streetAddress)
    ? []
    : [{ path: "address", message: "validation.address.required" }];

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

/** Édition événement : `organizer` requis (inconditionnel) + dates (cf. `eventDatesValid`). */
export const editEventValid: ValidateFn = (v: FormValues) => {
  const issues: Array<{ path: string; message: string }> = [];
  if (!v.organizer || Object.keys(v.organizer as Record<string, unknown>).length === 0)
    issues.push({ path: "organizer", message: "validation.organizer.required" });
  return [...issues, ...eventDatesValid(v)];
};

/**
 * Ajout événement : `organizer` requis SAUF si `_hasParent` (le parent devient l'organisateur) +
 * dates + adresse. `_hasParent` = champ caché (default = présence d'un parent) → modélise au RUNTIME le
 * contexte qui était une closure dans le descripteur (parité exacte, désormais sérialisable).
 */
export const addEventValid: ValidateFn = (v: FormValues) => {
  const issues: Array<{ path: string; message: string }> = [];
  if (!v._hasParent && (!v.organizer || Object.keys(v.organizer as Record<string, unknown>).length === 0))
    issues.push({ path: "organizer", message: "validation.organizer.required" });
  return [...issues, ...eventDatesValid(v), ...addressValid(v)];
};

registerValidate("addressValid", addressValid);
registerValidate("addressComplete", addressComplete);
registerValidate("eventDatesValid", eventDatesValid);
registerValidate("editEventValid", editEventValid);
registerValidate("addEventValid", addEventValid);
