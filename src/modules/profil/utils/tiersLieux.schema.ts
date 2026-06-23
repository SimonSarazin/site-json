/**
 * Schéma + types + valeurs par défaut du formulaire tiers-lieu.
 *
 * Extraits de l'ancien composant `TiersLieuxForm` (supprimé) : le rendu est désormais 100%
 * `GenericForm` + `tiersLieuDescriptor` (cf. `forms/TiersLieuxGenericModal`). Ce module ne contient
 * que de la DONNÉE (zod + types + defaults), consommée par le descripteur de RENDER, le pipeline
 * READ/WRITE (`tiersLieuxMapping`) et les hooks add/edit.
 *
 * NB : `tiersLieuxSchema` ne sert plus qu'à DÉRIVER le type (`z.infer`) — la validation du form
 * provient du descripteur (zodGen), pas d'ici.
 */
import { z } from "zod";
import { localityFieldsSchema, geoSchema, geoPositionSchema } from "../schemaForm";

const dayHoursSchema = z.object({
  enabled: z.boolean().default(false),
  start: z.string().default("08:00"),
  end: z.string().default("18:00"),
});

const socialLinkSchema = z.object({
  platform: z.string(),
  url: z.string(),
});

export const tiersLieuxSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  openingMonth: z.string().optional(),
  openingYear: z.string().optional(),
  shortDescription: z.string().min(1, "La description courte est requise"),
  structureName: z.string().optional(),
  managementType: z.string().min(1, "Le mode de gestion est requis"),
  managementTypeOther: z.string().optional(),
  family: z.array(z.string()).optional(),
  familyOther: z.string().optional(),
  surfaceBuilt: z.string().optional(),
  surfaceOutdoor: z.string().optional(),
  // Adresse : 14 champs SIG (dont level1..4/codeInsee posés par EditLocationTab). Réutilise le schéma
  // partagé des autres entités — sinon le zodResolver STRIPE les niveaux non déclarés (perte SIG au save).
  ...localityFieldsSchema.shape,
  // Coordonnées posées par EditLocationTab AVEC l'adresse (writeOnly côté descripteur) — déclarées ici pour
  // survivre au zodResolver. cf. tl:geoWrite/tl:geoPositionWrite (liées à localityId).
  geo: geoSchema.optional(),
  geoPosition: geoPositionSchema.optional(),
  logo: z.string().optional(),
  photos: z.array(z.string()).default([]),
  socialLinks: z.array(socialLinkSchema).optional(),
  websiteUrl: z.string().optional(),
  hours: z.object({
    monday: dayHoursSchema,
    tuesday: dayHoursSchema,
    wednesday: dayHoursSchema,
    thursday: dayHoursSchema,
    friday: dayHoursSchema,
    saturday: dayHoursSchema,
    sunday: dayHoursSchema,
  }),
  email: z.string().email("Email invalide").min(1, "L'email est requis"),
  phone: z.string().optional(),
  videoUrl: z.string().optional(),
  description: z.string().optional(),
}).superRefine((data, ctx) => {
  // Adresse : si un champ d'adresse est saisi mais qu'aucune ville n'a été sélectionnée dans la liste
  // SIG (`localityId`), `buildAddressFromForm` DROPPE silencieusement l'adresse (le backend rejette
  // sinon, save atomique → tout perdu). On le signale au lieu de perdre l'adresse en silence.
  const hasAddr = Boolean(data.addressCountry || data.addressLocality || data.postalCode || data.streetAddress);
  if (hasAddr && !data.localityId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["addressLocality"],
      message: "Sélectionnez une ville dans la liste pour valider l'adresse",
    });
  }
});

export type TiersLieuxFormData = z.infer<typeof tiersLieuxSchema>;

export interface TiersLieuxSubmitPayload extends TiersLieuxFormData {
  _logoFile: File | null;
  _photoFiles: File[];
}

export function getDefaultTiersLieuxValues(): TiersLieuxFormData {
  return {
    name: "",
    openingMonth: "",
    openingYear: "",
    shortDescription: "",
    managementType: "",
    family: [],
    addressCountry: "",
    addressLocality: "",
    postalCode: "",
    streetAddress: "",
    localityId: "",
    level1: "", level1Name: "", level2: "", level2Name: "",
    level3: "", level3Name: "", level4: "", level4Name: "", codeInsee: "",
    logo: "",
    photos: [],
    socialLinks: [],
    // Aucun jour pré-coché : la création démarre vide (opt-in), et `parseOpeningHours` réutilise ces
    // défauts comme base/fallback → un tiers-lieu SANS horaires (jamais saisis ou effacés) s'affiche
    // tout décoché (et non Lun–Ven, qui donnait l'illusion d'un effacement non pris). 08:00–18:00 =
    // heures pré-remplies dès qu'on coche un jour.
    hours: {
      monday: { enabled: false, start: "08:00", end: "18:00" },
      tuesday: { enabled: false, start: "08:00", end: "18:00" },
      wednesday: { enabled: false, start: "08:00", end: "18:00" },
      thursday: { enabled: false, start: "08:00", end: "18:00" },
      friday: { enabled: false, start: "08:00", end: "18:00" },
      saturday: { enabled: false, start: "08:00", end: "18:00" },
      sunday: { enabled: false, start: "08:00", end: "18:00" },
    },
    email: "",
  };
}
