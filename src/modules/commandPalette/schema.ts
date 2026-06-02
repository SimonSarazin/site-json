import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";

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
});

export type CommandPaletteConfig = z.infer<typeof CommandPaletteConfigSchema>;
