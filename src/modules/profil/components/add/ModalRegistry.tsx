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
  "add-organization": () => import("../../forms/AddEntityGenericModals").then(m => ({ default: m.AddOrganizationGenericModal })),
  "add-project": () => import("../../forms/AddEntityGenericModals").then(m => ({ default: m.AddProjectGenericModal })),
  "add-event": () => import("../../forms/AddEntityGenericModals").then(m => ({ default: m.AddEventGenericModal })),
  "add-poi": () => import("../../forms/AddEntityGenericModals").then(m => ({ default: m.AddPoiGenericModal })),
  "add-poi-equipement": () => import("../../forms/PoiEquipementGenericModal").then(m => ({ default: m.PoiEquipementGenericModal })),
  "add-tiers-lieux": () => import("../../forms/TiersLieuxGenericModal").then(m => ({ default: m.TiersLieuxGenericModal })),
  "register-cyber-reunion": () => import("./RegisterCyberReunionModal").then(m => ({ default: m.RegisterCyberReunionModal })),
  // json-form reste sur l'ancien modal jusqu'à P3 : JsonFormHost (moteur) est prêt mais le payload
  // générique perd les champs costum non déclarés de cyber-reunion (siren/phone/website…). P3 ajoutera
  // un payloadFn dédié (+ complétion du schéma costum) puis re-pointera ici vers JsonFormHost.
  "json-form": () => import("./JsonFormModal").then(m => ({ default: m.JsonFormModal })),
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

export const availableModals = Object.keys(modalRegistry);

export function isValidModal(modalName: string): boolean {
  return modalName in modalRegistry;
}
