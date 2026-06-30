/**
 * LayoutRegistry (§5 du design) : `LayoutSpec.kind` → composant de layout, **code-splitté** via
 * `React.lazy` + `import()` dynamique (Vite émet un chunk par layout, chargé à la demande).
 * Extensible : `registerLayout(kind, comp)`. Fournis : `flat`, `wizard`, `tabs` (bâtis sur Radix Tabs).
 * Le rendu attend une frontière `<Suspense>` (assurée par GenericForm).
 */
import { lazy, type ComponentType } from "react";
import type { LayoutProps } from "./shared";

export type { LayoutProps } from "./shared";

const layoutRegistry: Record<string, ComponentType<LayoutProps>> = {
  flat: lazy(() => import("./FlatLayout")),
  wizard: lazy(() => import("./WizardLayout")),
  tabs: lazy(() => import("./TabsLayout")),
};

export function registerLayout(kind: string, comp: ComponentType<LayoutProps>): void {
  layoutRegistry[kind] = comp;
}

export function getLayout(kind: string): ComponentType<LayoutProps> {
  return layoutRegistry[kind] ?? layoutRegistry.flat;
}
