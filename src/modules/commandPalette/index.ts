/**
 * API publique du module `commandPalette`.
 *
 * Pour enregistrer une source de commandes depuis un autre module :
 * ```ts
 * import { registerCommandSource } from "@/modules/commandPalette";
 * registerCommandSource({ namespace: "mon-module", getCommands: (ctx) => [...] });
 * ```
 *
 * Note : ce barrel n'exporte volontairement PAS le `CommandPaletteProvider` ni
 * le `CommandTriggerButton` (composants React) afin de rester sans cycle —
 * RootLayout et les headers les importent par chemin direct.
 */
export { registerCommandSource, getCommandSources, getCommandGroup } from "./registry/registry";
export type {
  Command,
  CommandGroup,
  CommandGroupId,
  CommandId,
  CommandReadContext,
  CommandRunContext,
  CommandSource,
  LocalizedText,
} from "./registry/types";
export { CommandPaletteConfigSchema, type CommandPaletteConfig } from "./schema";
