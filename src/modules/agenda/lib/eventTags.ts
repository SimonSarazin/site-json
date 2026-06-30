import type { Event } from "@communecter/cocolight-api-client";

/** Tags d'un event (array de strings, ou objet `{tag:true}` legacy → clés). */
export function eventTags(ev: Event): string[] {
  const t = (ev.serverData as { tags?: unknown })?.tags;
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  if (t && typeof t === "object") return Object.keys(t);
  return [];
}

/** Tags distincts (triés) présents dans une liste d'events — pour proposer les chips de filtre. */
export function distinctTags(events: Event[]): string[] {
  const set = new Set<string>();
  for (const e of events) for (const t of eventTags(e)) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Filtre client OR : un event passe s'il porte AU MOINS un des tags sélectionnés. Sélection vide = tout. */
export function filterByTags(events: Event[], selected: string[]): Event[] {
  if (selected.length === 0) return events;
  const sel = new Set(selected);
  return events.filter((e) => eventTags(e).some((t) => sel.has(t)));
}
