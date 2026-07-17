import type { ComponentType } from "react";

import type { AdminSection } from "../schema";

/**
 * Registre des sections admin COSTUM (calqué sur `registerPermissions`/`costumFormRegistry`).
 * Un costum injecte son propre dashboard/section admin via `registerAdminSection(type, Component)` —
 * comme `ProfileTiersLieuxInfo` injecte une section profil, sans toucher au cœur.
 * Les sections BUILTIN (dashboard/members/resource/import/export/reference/moderation) sont résolues
 * directement par `AdminSectionRenderer` ; ce registre ne sert qu'aux `type` costum.
 */
export type AdminSectionComponent = ComponentType<{ section: AdminSection }>;

const registry = new Map<string, AdminSectionComponent>();

export function registerAdminSection(type: string, component: AdminSectionComponent): void {
  if (registry.has(type)) {
    console.warn(`[admin] section costum "${type}" déjà enregistrée — écrasée`);
  }
  registry.set(type, component);
}

export function getAdminSection(type: string): AdminSectionComponent | undefined {
  return registry.get(type);
}

export function listAdminSectionTypes(): string[] {
  return [...registry.keys()];
}
