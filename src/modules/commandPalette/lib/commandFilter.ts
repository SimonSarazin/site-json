import type { Command, CommandGroup, CommandGroupId } from "../registry/types";
import { getCommandGroup } from "../registry/registry";
import { resolveText } from "./resolveText";
import { matchText } from "./matchCommand";

/**
 * Filtre une liste de commandes par la requête. Une requête vide laisse tout
 * passer. Le texte indexé = label résolu + keywords.
 */
export function filterCommands(commands: Command[], query: string, locale: string): Command[] {
  if (!query.trim()) return commands;
  return commands.filter((cmd) => {
    const haystack = [resolveText(cmd.label, locale), ...(cmd.keywords ?? [])].join(" ");
    return matchText(haystack, query);
  });
}

export interface RenderedGroup {
  group: CommandGroup;
  commands: Command[];
}

/**
 * Regroupe les commandes par `group`, applique les métadonnées de groupe
 * (heading/order depuis le registre), limite à `maxPerGroup` et trie par ordre.
 */
export function groupCommands(commands: Command[], maxPerGroup: number): RenderedGroup[] {
  const byGroup = new Map<CommandGroupId, Command[]>();
  for (const cmd of commands) {
    const arr = byGroup.get(cmd.group) ?? [];
    arr.push(cmd);
    byGroup.set(cmd.group, arr);
  }

  const out: RenderedGroup[] = [];
  for (const [id, cmds] of byGroup) {
    const meta = getCommandGroup(id) ?? { id, heading: id };
    out.push({ group: meta, commands: cmds.slice(0, maxPerGroup) });
  }
  out.sort((a, b) => (a.group.order ?? 100) - (b.group.order ?? 100));
  return out;
}
