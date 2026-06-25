import { lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import type { JsonFormModalConfig } from "@/types/site-schema";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
  formConfig?: JsonFormModalConfig;
}

const modalRegistry: Record<string, () => Promise<{ default: ComponentType<ModalProps> }>> = {
  "add-organization": () => Promise.all([import("../../forms/EntityFormModal"), import("../../forms/configs/addStandard")]).then(([m, c]) => ({
    default: (props: ModalProps) => <m.EntityFormModal config={c.addOrganizationConfig} open={props.open} onOpenChange={props.onOpenChange} mode="add" parent={props.parent} />,
  })),
  "add-project": () => Promise.all([import("../../forms/EntityFormModal"), import("../../forms/configs/addStandard")]).then(([m, c]) => ({
    default: (props: ModalProps) => <m.EntityFormModal config={c.addProjectConfig} open={props.open} onOpenChange={props.onOpenChange} mode="add" parent={props.parent} />,
  })),
  "add-event": () => Promise.all([import("../../forms/EntityFormModal"), import("../../forms/configs/addStandard")]).then(([m, c]) => ({
    default: (props: ModalProps) => <m.EntityFormModal config={c.addEventConfig} open={props.open} onOpenChange={props.onOpenChange} mode="add" parent={props.parent} />,
  })),
  "add-poi": () => Promise.all([import("../../forms/EntityFormModal"), import("../../forms/configs/addStandard")]).then(([m, c]) => ({
    default: (props: ModalProps) => <m.EntityFormModal config={c.addPoiConfig} open={props.open} onOpenChange={props.onOpenChange} mode="add" parent={props.parent} />,
  })),
  // add-equipements-sportifs / add-tiers-lieux : résolus DYNAMIQUEMENT par la table runtime costum (cf.
  // costumModalThunk) — id = identité costum. Permet aussi les costums de config (config.costumForms) sans entrée ici.
};

/** Résolveur DYNAMIQUE des modales d'AJOUT costum : `add-<id>` → spec de la table runtime (TS connu OU config JSON). */
function costumModalThunk(modalName: string): (() => Promise<{ default: ComponentType<ModalProps> }>) | undefined {
  const m = /^add-(.+)$/.exec(modalName);
  if (!m) return undefined;
  const id = m[1];
  return () => Promise.all([import("../../forms/EntityFormModal"), import("../../forms/costum/registerCostumForms")]).then(([mod, reg]) => {
    const spec = reg.getCostumModalSpec(id);
    return {
      default: (props: ModalProps) =>
        spec ? <mod.EntityFormModal spec={spec} open={props.open} onOpenChange={props.onOpenChange} mode="add" parent={props.parent} /> : null,
    };
  });
}

const lazyComponents: Record<string, ComponentType<ModalProps>> = {};

function ensureLazyModal(modalName: string): void {
  const thunk = modalRegistry[modalName] ?? costumModalThunk(modalName);
  if (!thunk) {
    console.log(`Modal "${modalName}" not found in registry`);
    return;
  }
  if (!lazyComponents[modalName]) {
    lazyComponents[modalName] = lazy(thunk);
  }
}

export function DynamicModal({
  modalName,
  open,
  onOpenChange,
  parent,
  formConfig,
}: {
  modalName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
  formConfig?: JsonFormModalConfig;
}) {
  ensureLazyModal(modalName);
  const ModalComponent = lazyComponents[modalName];

  if (!ModalComponent) {
    return null;
  }

  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ModalComponent open={open} onOpenChange={onOpenChange} parent={parent} formConfig={formConfig} />
    </Suspense>
  );
}
