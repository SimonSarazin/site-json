/** Clés react-query de l'agenda. La plage/le type/le texte font partie de la clé → refetch auto au changement. */
export const AGENDA_QUERY_KEYS = {
  /**
   * Horloge partagée (now + bornes dérivées) — clé STABLE par fenêtre. Préchargée côté SSR puis
   * hydratée : le composant ET le prefetch lisent les MÊMES bornes ISO → les clés CALENDAR
   * coïncident serveur↔client (pas de mismatch d'hydratation sur une plage qui dépend de `now`).
   */
  CLOCK: (windowMonths: number) => ["agenda", "clock", windowMonths] as const,
  CALENDAR: (p: { scope?: string; rangeStart: string; rangeEnd: string; type?: string; name?: string; base?: string }) =>
    ["agenda", "calendar", p.scope ?? "", p.rangeStart, p.rangeEnd, p.type ?? "", p.name ?? "", p.base ?? ""] as const,
  LIST: (p: { scope?: string; type?: string; name?: string; base?: string }) =>
    ["agenda", "list", p.scope ?? "", p.type ?? "", p.name ?? "", p.base ?? ""] as const,
};
