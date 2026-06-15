import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";
import { PreviewConfSchema } from "@/modules/search/schema";

/**
 * Action au clic sur un résultat d'entité — même pattern déclaratif que le
 * `table.rowAction` de l'observatoire : navigation profil (défaut) ou
 * ouverture du détail du module search (`SwitchDetailsMode`).
 */
export const EntityItemActionSchema = z.object({
  kind: z.enum(["profil", "preview"]),
  /** kind "preview" : conteneur du détail (défaut : dialog). */
  detailsMode: z.enum(["drawer", "dialog"]).optional(),
  /** kind "preview" : contenu du détail (ex. { "type": "poi-amenities" }). */
  preview: PreviewConfSchema.optional(),
});
export type EntityItemAction = z.infer<typeof EntityItemActionSchema>;

/**
 * Config JSON de la palette, champ top-level optionnel `site.commandPalette`.
 * Absente → fonctionnalité désactivée. Présente sans `enabled` → activée.
 */
export const CommandPaletteConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** `mod` = Cmd sur macOS, Ctrl ailleurs. Ex: `"mod+k"`. */
  keybinding: z.string().default("mod+k"),
  /** Override du placeholder de l'input (sinon i18n par défaut). */
  placeholder: LocalizedString.optional(),
  /** Liste blanche de namespaces de sources. `undefined` = toutes les sources. */
  sources: z.array(z.string()).optional(),
  maxResultsPerGroup: z.number().int().positive().default(10),
  /**
   * Largeur du bouton de header :
   * - `full` : icône + libellé + raccourci (défaut),
   * - `compact` : icône + raccourci (sans libellé),
   * - `icon` : icône seule (le plus étroit).
   */
  triggerVariant: z.enum(["full", "compact", "icon"]).default("full"),
  /** Config de la source de recherche d'entités backend (fournie par le module profil). */
  entitySearch: z
    .object({
      enabled: z.boolean().default(true),
      /** Types d'entités cherchés. Défaut : organizations / projects / events / poi / citoyens. */
      searchType: z.array(z.string()).optional(),
      /** Nombre max de résultats (= `indexStep`). */
      limit: z.number().int().positive().default(8),
      /** Champs additionnels fusionnés dans le payload `searchCostum` (avancé : filters, scope…). */
      params: z.record(z.string(), z.unknown()).optional(),
      /** Action au clic sur un résultat (défaut : navigation `/profil/:slug`). */
      itemAction: EntityItemActionSchema.optional(),
      /** Surcharge par type d'entité (clé = type de l'entité, ex. `"poi"`). */
      itemActionByType: z.record(z.string(), EntityItemActionSchema).optional(),
    })
    .optional(),
});

export type CommandPaletteConfig = z.infer<typeof CommandPaletteConfigSchema>;
