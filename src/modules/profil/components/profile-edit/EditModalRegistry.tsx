import { lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import type { EntityTypes, Organization, Poi } from "@communecter/cocolight-api-client";
import { useSite } from "@/hooks/useSite";

export interface EditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: EntityTypes;
}

const editModalRegistry: Record<string, () => Promise<{ default: ComponentType<EditModalProps> }>> = {
  "edit-profile": () =>
    import("../../forms/EditProfileGenericModal").then((m) => ({
      default: (props: EditModalProps) => (
        <m.EditProfileGenericModal
          open={props.open}
          onOpenChange={props.onOpenChange}
          entity={props.entity}
        />
      ),
    })),
  "edit-tiers-lieux": () =>
    import("../../forms/TiersLieuxGenericModal").then((m) => ({
      default: (props: EditModalProps) => (
        <m.TiersLieuxGenericModal
          open={props.open}
          onOpenChange={props.onOpenChange}
          mode="edit"
          organization={props.entity as Organization}
        />
      ),
    })),
  "edit-poi-equipement": () =>
    import("../../forms/PoiEquipementGenericModal").then((m) => ({
      default: (props: EditModalProps) => (
        <m.PoiEquipementGenericModal
          open={props.open}
          onOpenChange={props.onOpenChange}
          mode="edit"
          poi={props.entity as Poi}
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
 * Vérifie si une condition `editModalMatch` est satisfaite par `serverData`.
 *
 * Objet plain `{ key: value }` — AND implicite sur toutes les clés.
 * Pour chaque paire :
 *  - Si `serverData[key]` est un array → `.includes(expectedValue)`
 *  - Sinon → strict equality (`===`)
 *
 * Si `match` est absent/undefined → renvoie `true` (pas de filtre = match always).
 */
function matchesEditModalCondition(
  serverData: Record<string, unknown>,
  match: Record<string, unknown> | undefined
): boolean {
  if (!match) return true;
  return Object.entries(match).every(([key, expected]) => {
    const actual = serverData[key];
    if (Array.isArray(actual)) return actual.includes(expected);
    return actual === expected;
  });
}

/**
 * Résout le nom du modal d'édition à utiliser pour une entité donnée.
 *
 * Règle :
 *  1. Lit `profiles[kind+'s'].editModal` de la config (kind = "organization", "project", ...).
 *  2. Si absent → `"edit-profile"` (générique).
 *  3. Si présent + pas de `editModalMatch` → utilise le custom pour TOUTES les entités du kind.
 *  4. Si présent + `editModalMatch` défini → utilise le custom uniquement si `serverData`
 *     satisfait la condition (cf. `matchesEditModalCondition`). Sinon → générique.
 *
 * Cette fonction est exportée pour permettre aux composants de pré-décider sans
 * monter le DynamicEditModal (ex. afficher/masquer un bouton).
 */
export function resolveEditModalName(
  entity: EntityTypes,
  config: ReturnType<typeof useSite>["config"]
): string {
  // `getEntityType()` retourne déjà le pluriel ("organizations", "projects", "events", ...).
  // Pas besoin de pluraliser à nouveau.
  const profileKey = typeof entity.getEntityType === "function" ? entity.getEntityType() : null;
  const profiles = config.profiles as
    | Record<string, { editModal?: string; editModalMatch?: Record<string, unknown> } | undefined>
    | undefined;
  const profileConfig = profileKey ? profiles?.[profileKey] : undefined;

  if (!profileConfig?.editModal) return "edit-profile";

  const serverData = (entity.serverData ?? {}) as Record<string, unknown>;
  if (!matchesEditModalCondition(serverData, profileConfig.editModalMatch)) {
    return "edit-profile";
  }

  return profileConfig.editModal;
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
