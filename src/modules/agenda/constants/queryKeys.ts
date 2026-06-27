/** Clés react-query de l'agenda. La plage/le type/le texte font partie de la clé → refetch auto au changement. */
export const AGENDA_QUERY_KEYS = {
  CALENDAR: (p: { scope?: string; rangeStart: string; rangeEnd: string; type?: string; name?: string }) =>
    ["agenda", "calendar", p.scope ?? "", p.rangeStart, p.rangeEnd, p.type ?? "", p.name ?? ""] as const,
  LIST: (p: { scope?: string; type?: string; name?: string }) =>
    ["agenda", "list", p.scope ?? "", p.type ?? "", p.name ?? ""] as const,
};
