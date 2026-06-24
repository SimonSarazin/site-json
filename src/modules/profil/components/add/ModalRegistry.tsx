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
  "add-poi-equipement": () => Promise.all([import("../../forms/EntityFormModal"), import("../../forms/configs/poiEquipement")]).then(([m, c]) => ({
    default: (props: ModalProps) => <m.EntityFormModal config={c.poiEquipementModalConfig} open={props.open} onOpenChange={props.onOpenChange} mode="add" parent={props.parent} />,
  })),
  "add-tiers-lieux": () => Promise.all([import("../../forms/EntityFormModal"), import("../../forms/configs/tiersLieu")]).then(([m, c]) => ({
    default: (props: ModalProps) => <m.EntityFormModal config={c.tiersLieuModalConfig} open={props.open} onOpenChange={props.onOpenChange} mode="add" parent={props.parent} />,
  })),
};

const lazyComponents: Record<string, ComponentType<ModalProps>> = {};

function ensureLazyModal(modalName: string): void {
  if (!modalRegistry[modalName]) {
    console.log(`Modal "${modalName}" not found in registry`);
    return;
  }

  if (!lazyComponents[modalName]) {
    lazyComponents[modalName] = lazy(modalRegistry[modalName]);
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
