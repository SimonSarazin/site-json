import { mergeMongoFilters } from "@/modules/search/lib/mongoFilters";

/**
 * Borne une section `agenda` posée dans un onglet de fiche (`scopeToProfile: true`) aux événements
 * de l'entité affichée : ceux qu'elle organise ou auxquels elle participe — le MÊME filtre que
 * `entity.getEvents()` du SDK (utilisé par `profile-related`), pour que passer d'une liste à l'autre
 * ne change pas le contenu de l'onglet.
 *
 * Un `$or` déjà présent dans `baseParams.filters` (ex. un agenda borné par tag) est COMPOSÉ en ET
 * avec celui de la fiche par `mergeMongoFilters` (forme `$or: { $and: [...] }`, lue par le backend
 * legacy comme par le Node) au lieu d'être écrasé — le périmètre de la config est conservé.
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
        filters: mergeMongoFilters(baseParams.filters, profileEventsFilter(entityId)),
      },
    },
  };
}
