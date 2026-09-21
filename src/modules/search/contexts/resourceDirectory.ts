import { createContext, useContext } from "react";

/** Infos du tiers-lieu porteur d'une ressource, résolues par la section. */
export interface ResourceParentInfo {
  id: string;
  name?: string;
  slug?: string;
  imageUrl?: string;
  streetAddress?: string;
  postalCode?: string;
  addressLocality?: string;
  /** `address.level1` — sert la garde région de la section. */
  level1?: string;
  coords?: { lat: number; lng: number } | null;
}

/**
 * Lieux porteurs résolus (`id → infos`), fournis par
 * `CoformResourceDirectorySection`. `null` hors section → la carte retombe sur
 * les seules données de la réponse (`links.organizations` : nom seul).
 */
const ResourceParentsContext = createContext<Map<string, ResourceParentInfo> | null>(null);

export const ResourceParentsProvider = ResourceParentsContext.Provider;

export function useResourceParentsMap(): Map<string, ResourceParentInfo> | null {
  return useContext(ResourceParentsContext);
}

/** Tiers-lieu dont on ne veut voir que les ressources (`filters.parentId` serveur). */
export interface ActiveResourceParent {
  id: string;
  name?: string;
}

/**
 * Actions transverses de l'annuaire — le clic sur « Porté par {tiers-lieu} »
 * d'une carte pose le filtre « porté par » de la section (serveur), il ne
 * n'ouvre pas le détail. `null` hors section.
 */
export interface ResourceDirectoryActions {
  activeParent: ActiveResourceParent | null;
  setActiveParent: (parent: ActiveResourceParent | null) => void;
}

const ResourceDirectoryActionsContext = createContext<ResourceDirectoryActions | null>(null);

export const ResourceDirectoryActionsProvider = ResourceDirectoryActionsContext.Provider;

export function useResourceDirectoryActions(): ResourceDirectoryActions | null {
  return useContext(ResourceDirectoryActionsContext);
}
