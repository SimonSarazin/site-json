import { z } from "zod";
import { LocalizedString } from "./locale-schema";
import { JsonFormModalConfigSchema } from "./form-modal-schema";

/**
 * Bouton d'action déclaré en config (header de recherche, hero…).
 *
 * Contrat PARTAGÉ : déclaré par le schéma `searchHeader` (`modules/search/schema`)
 * ET rendu par `<ActionButtonGroup>` (`modules/profil`). Vit dans une feuille
 * neutre (ne dépend que de `locale-schema` + `form-modal-schema`) pour que les
 * deux modules l'importent sans créer de dépendance circulaire search↔profil.
 */
export const ActionButtonSchema = z.object({
  label: LocalizedString,
  icon: z.string().optional(),
  href: z.string().optional(),
  variant: z.enum(["default", "outline", "primary", "turquoise"]).optional(),
  action: z.enum(["join-dropdown", "add-project", "add-event", "add-poi", "add-organization", "add-structure", "add-offer"]).optional(),
  modal: z.string().optional(),
  formConfig: JsonFormModalConfigSchema.optional(),
  requiresAdmin: z.boolean().optional(),
});

export type ActionButton = z.infer<typeof ActionButtonSchema>;
