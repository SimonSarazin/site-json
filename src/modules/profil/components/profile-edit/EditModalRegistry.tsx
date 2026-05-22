import { lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import type { EntityTypes, Organization } from "@communecter/cocolight-api-client";
import { useSite } from "@/hooks/useSite";

export interface EditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: EntityTypes;
}

const editModalRegistry: Record<string, () => Promise<{ default: ComponentType<EditModalProps> }>> = {
  "edit-profile": () =>
    import("./EditProfileModal").then((m) => ({
      default: (props: EditModalProps) => (
        <m.EditProfileModal
          open={props.open}
          onOpenChange={props.onOpenChange}
          entity={props.entity}
        />
      ),
    })),
  "edit-tiers-lieux": () =>
    import("../edit/EditTiersLieuxModal").then((m) => ({
      default: (props: EditModalProps) => (
        <m.EditTiersLieuxModal
          open={props.open}
          onOpenChange={props.onOpenChange}
          organization={props.entity as Organization}
        />
      ),
    })),
};

const lazyComponents: Record<string, ComponentType<EditModalProps>> = {};

function ensureLazyEditModal(modalName: string): void {
  if (!editModalRegistry[modalName]) {
    console.warn(`Edit modal "${modalName}" not found in registry`);
    return;
  }
  if (!lazyComponents[modalName]) {
    lazyComponents[modalName] = lazy(editModalRegistry[modalName]);
  }
}

/**
 * Résout le nom du modal d'édition à utiliser pour une entité donnée.
 *
 * Règle : si l'entité correspond au `costum` du site (via `costumSlug`), on lit
 * `profiles[kind].editModal` de la config. Sinon → `"edit-profile"` (générique).
 *
 * Cette fonction est exportée pour permettre aux composants de pré-décider sans
 * monter le DynamicEditModal (ex. afficher/masquer un bouton).
 */
export function resolveEditModalName(
  entity: EntityTypes,
  config: ReturnType<typeof useSite>["config"]
): string {
  const data = entity.serverData as Record<string, unknown> | null | undefined;
  const isCostumEntity =
    config.costum?.slug && data?.costumSlug === config.costum.slug;

  if (!isCostumEntity) return "edit-profile";

  const kind = typeof entity.getEntityType === "function" ? entity.getEntityType() : null;
  const profileKey = kind ? `${kind}s` : null;
  const profiles = config.profiles as Record<string, { editModal?: string } | undefined> | undefined;
  const profileConfig = profileKey ? profiles?.[profileKey] : undefined;
  return profileConfig?.editModal ?? "edit-profile";
}

/**
 * Wrapper config-driven : choisit dynamiquement le modal d'édition pour l'entité.
 * Remplace les usages directs de `<EditProfileModal>` dans les headers de profil.
 */
export function DynamicEditModal({
  open,
  onOpenChange,
  entity,
}: EditModalProps) {
  const { config } = useSite();
  const modalName = resolveEditModalName(entity, config);
  ensureLazyEditModal(modalName);
  const ModalComponent = lazyComponents[modalName];

  if (!ModalComponent) return null;

  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ModalComponent open={open} onOpenChange={onOpenChange} entity={entity} />
    </Suspense>
  );
}
