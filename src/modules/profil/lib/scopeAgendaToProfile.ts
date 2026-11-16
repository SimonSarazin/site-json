/**
 * Borne une section `agenda` posée dans un onglet de fiche (`scopeToProfile: true`) aux événements
 * de l'entité affichée : ceux qu'elle organise ou auxquels elle participe — le MÊME filtre que
 * `entity.getEvents()` du SDK (utilisé par `profile-related`), pour que passer d'une liste à l'autre
 * ne change pas le contenu de l'onglet.
 *
 * L'option possède la clé `$or` des `baseParams.filters` : un `$or` déjà présent en config est
 * remplacé (deux `$or` ne se combinent pas sans `$and`, que la recherche costum ne garantit pas).
 *
 * Sans `scopeToProfile`, la section est rendue telle quelle (opt-in).
 */
export interface AgendaLikeSection {
  type: string;
  props?: {
    scopeToProfile?: boolean;
    baseParams?: { filters?: Record<string, unknown> } & Record<string, unknown>;
  } & Record<string, unknown>;
}

export function profileEventsFilter(entityId: string): Record<string, unknown> {
  return {
    $or: {
      [`links.attendees.${entityId}`]: { $exists: true },
      [`organizer.${entityId}`]: { $exists: true },
    },
  };
}

export function scopeAgendaToProfile<S extends AgendaLikeSection>(section: S, entityId: string): S {
  if (section.type !== "agenda" || section.props?.scopeToProfile !== true) return section;
  const baseParams = section.props.baseParams ?? {};
  return {
    ...section,
    props: {
      ...section.props,
      baseParams: {
        ...baseParams,
        filters: { ...(baseParams.filters ?? {}), ...profileEventsFilter(entityId) },
      },
    },
  };
}
