import { z } from "zod";
import { LocalizedString } from "./locale-schema";

/**
 * Schémas du modal de formulaire JSON (CoForm-like) déclaré dans les configs.
 * Fichier feuille (ne dépend que de `locale-schema`) pour être importable à la
 * fois par `site-schema.ts` ET par les schémas de module (`modules/search/schema`,
 * via `ActionButtonSchema`) sans créer de dépendance circulaire.
 *
 * Consommateurs : `ActionButtonSchema` (searchHeader), `CommuneTransparenteActionButtonSchema`,
 * et le module profil (`JsonFormModal`, `ModalRegistry`).
 */

const JsonFormModalFieldSchema = z.object({
  name: z.string(),
  label: LocalizedString,
  type: z.enum(["text", "email", "tel", "number", "textarea", "select", "multiselect", "checkbox", "radio", "date", "url", "location", "file"]).default("text"),
  required: z.boolean().default(false),
  placeholder: LocalizedString.optional(),
  options: z.array(z.object({ value: z.string(), label: LocalizedString })).optional(),
  validation: z.string().optional(),
});

const JsonFormModalStepSchema = z.object({
  title: LocalizedString,
  description: LocalizedString.optional(),
  icon: z.string().optional(),
  fields: z.array(JsonFormModalFieldSchema),
});

export const JsonFormModalConfigSchema = z.object({
  title: LocalizedString,
  icon: z.string().optional(),
  steps: z.array(JsonFormModalStepSchema).optional(),
  fields: z.array(JsonFormModalFieldSchema).optional(),
  submitLabel: LocalizedString,
  submitMode: z.enum(["fetch", "sdk"]).default("fetch"),
  entityType: z.enum(["organization", "project", "event", "poi"]).optional(),
  action: z.string().optional(),
  method: z.enum(["GET", "POST"]).default("POST"),
  successMessage: LocalizedString.optional(),
  errorMessage: LocalizedString.optional(),
  tagsFrom: z.array(z.string()).optional(),
  extraData: z.record(z.string(), z.unknown()).optional(),
});

export type JsonFormModalConfig = z.infer<typeof JsonFormModalConfigSchema>;
export type JsonFormModalField = z.infer<typeof JsonFormModalFieldSchema>;
export type JsonFormModalStep = z.infer<typeof JsonFormModalStepSchema>;
