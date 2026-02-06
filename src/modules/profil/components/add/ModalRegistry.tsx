import { lazy, Suspense, ComponentType } from "react";
import { Loader2 } from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
}

const modalRegistry: Record<string, () => Promise<{ default: ComponentType<ModalProps> }>> = {
  "add-organization": () => import("./AddOrganizationModal").then(m => ({ default: m.AddOrganizationModal })),
  "add-project": () => import("./AddProjectModal").then(m => ({ default: m.AddProjectModal })),
  "add-event": () => import("./AddEventModal").then(m => ({ default: m.AddEventModal })),
  "add-poi": () => import("./AddPoiModal").then(m => ({ default: m.AddPoiModal })),
  "register-cyber-reunion": () => import("./RegisterCyberReunionModal").then(m => ({ default: m.RegisterCyberReunionModal })),
};

const lazyComponents: Record<string, ComponentType<ModalProps>> = {};

function getLazyModal(modalName: string): ComponentType<ModalProps> | null {
  if (!modalRegistry[modalName]) {
    console.log(`Modal "${modalName}" not found in registry`);
    return null;
  }

  if (!lazyComponents[modalName]) {
    lazyComponents[modalName] = lazy(modalRegistry[modalName]);
  }

  return lazyComponents[modalName];
}

export function DynamicModal({
  modalName,
  open,
  onOpenChange,
  parent,
}: {
  modalName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
}) {
  const ModalComponent = getLazyModal(modalName);

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
      <ModalComponent open={open} onOpenChange={onOpenChange} parent={parent} />
    </Suspense>
  );
}

export const availableModals = Object.keys(modalRegistry);

export function isValidModal(modalName: string): boolean {
  return modalName in modalRegistry;
}
