import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";

/**
 * Schemas Zod pour la configuration du module CoForm
 * 
 */

// Variantes d'affichage du formulaire CoForm
export const CoFormVariantSchema = z.enum([
  "default",   // Affichage standard (single page)
  "wizard",    // Multi-étapes avec navigation
  "stepper",   // Avec indicateur de progression visuel
  "tabs",      // Étapes en onglets
]);

export type CoFormVariant = z.infer<typeof CoFormVariantSchema>;

// Mode de soumission des données
export const CoFormSubmitModeSchema = z.enum([
  "step",   // Envoie à chaque fin d'étape
  "final",  // Envoie uniquement à la fin
  "both",   // Envoie à chaque étape ET à la fin
]);

export type CoFormSubmitMode = z.infer<typeof CoFormSubmitModeSchema>;

// Configuration d'une section CoForm dans le site-json
export const CoFormSectionSchema = z.object({
  type: z.literal("coform"),
  id: z.string().optional(),
  props: z.object({
    /** ID du formulaire CoForm à charger */
    formId: z.string().min(1),
    /** Variante d'affichage */
    variant: CoFormVariantSchema.optional().default("wizard"),
    /** Mode de soumission (default "final" — le mode "step" requiert onStepSubmit câblé, cf. README.md#step-mode) */
    submitMode: CoFormSubmitModeSchema.optional().default("final"),
    title: LocalizedString.optional(),
    description: LocalizedString.optional(),
    showProgress: z.boolean().optional().default(true),
    showStepNumbers: z.boolean().optional().default(true),
    redirectAfterSubmit: z.string().optional(),
    className: z.string().optional(),
  }),
});

export type CoFormSection = z.infer<typeof CoFormSectionSchema>;

// Configuration globale du module CoForm
export const CoFormConfigSchema = z.object({
  enabled: z.boolean().default(true),
  submitTimeout: z.number().positive().default(30000),
  autoSave: z.boolean().default(false),
  autoSaveInterval: z.number().positive().default(60000),
});

export type CoFormConfig = z.infer<typeof CoFormConfigSchema>;

