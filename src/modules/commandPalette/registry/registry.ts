/**
 * Registre central des sources de commandes.
 * Les modules s'enregistrent ici via `registerCommandSource()` — calqué sur
 * `src/lib/permissions/registry.ts` (enregistrement par side-effect d'import).
 */
import type { CommandGroup, CommandGroupId, CommandSource } from "./types";

/** Sources enregistrées, indexées par namespace. */
const sources = new Map<string, CommandSource>();
/** Métadonnées de groupes agrégées depuis toutes les sources. */
const groups = new Map<CommandGroupId, CommandGroup>();

/**
 * Enregistre une source de commandes.
 *
 * @example
 * registerCommandSource({
 *   namespace: "core:navigation",
 *   getCommands: (ctx) => ctx.config.pages.map(...),
 * });
 */
export function registerCommandSource(source: CommandSource): void {
  if (sources.has(source.namespace)) {
    console.warn(
      `[commandPalette] source "${source.namespace}" already registered, overwriting`
    );
  }
  sources.set(source.namespace, source);
  source.groups?.forEach((g) => groups.set(g.id, g));
}

/** Toutes les sources enregistrées. */
export function getCommandSources(): CommandSource[] {
  return Array.from(sources.values());
}

/** Métadonnées d'un groupe (heading, ordre) — `undefined` si inconnu. */
export function getCommandGroup(id: CommandGroupId): CommandGroup | undefined {
  return groups.get(id);
}

/** @internal — utilisé uniquement dans les tests. */
export function _resetForTesting(): void {
  sources.clear();
  groups.clear();
}
