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
  "add-organization": () => import("./AddOrganizationModal").then(m => ({ default: m.AddOrganizationModal })),
  "add-project": () => import("./AddProjectModal").then(m => ({ default: m.AddProjectModal })),
  "add-event": () => import("./AddEventModal").then(m => ({ default: m.AddEventModal })),
  "add-poi": () => import("./AddPoiModal").then(m => ({ default: m.AddPoiModal })),
  "add-new-ct": () => import("./AddCTModal").then(m => ({ default: m.AddCTModal })),
  "register-cyber-reunion": () => import("./RegisterCyberReunionModal").then(m => ({ default: m.RegisterCyberReunionModal })),
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
