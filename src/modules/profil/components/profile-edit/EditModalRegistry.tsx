import { lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
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
  // edit-tiers-lieux / edit-equipements-sportifs : résolus DYNAMIQUEMENT par la table runtime costum (cf.
  // costumEditThunk) — id = identité costum. Permet aussi les costums de config (config.costumForms) sans entrée ici.
};

/** Résolveur DYNAMIQUE des modales d'ÉDITION costum : `edit-<id>` → spec de la table runtime (TS connu OU config JSON). */
function costumEditThunk(modalName: string): (() => Promise<{ default: ComponentType<EditModalProps> }>) | undefined {
  const m = /^edit-(.+)$/.exec(modalName);
  if (!m) return undefined;
  const id = m[1];
  return () => Promise.all([import("../../forms/EntityFormModal"), import("../../forms/costum/registerCostumForms")]).then(([mod, reg]) => {
    const spec = reg.getCostumModalSpec(id);
    return {
      default: (props: EditModalProps) =>
        spec ? <mod.EntityFormModal spec={spec} open={props.open} onOpenChange={props.onOpenChange} mode="edit" entity={props.entity} /> : null,
    };
  });
}

const lazyComponents: Record<string, ComponentType<EditModalProps>> = {};

function ensureLazyEditModal(modalName: string): void {
  const thunk = editModalRegistry[modalName] ?? costumEditThunk(modalName);
  if (!thunk) {
    console.warn(`Edit modal "${modalName}" not found in registry`);
    return;
  }
  if (!lazyComponents[modalName]) {
    lazyComponents[modalName] = lazy(thunk);
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
    | Record<string, {
        editModal?: string;
        editModalMatch?: Record<string, unknown>;
        editModals?: Array<{ editModal: string; editModalMatch?: Record<string, unknown> }>;
      } | undefined>
    | undefined;
  const profileConfig = profileKey ? profiles?.[profileKey] : undefined;
  const serverData = (entity.serverData ?? {}) as Record<string, unknown>;

  // 1. Table de routage multi sous-types (costum à plusieurs forms / collection) : PREMIER match gagne.
  //    (ex. poi → edit-<slug>-recoveryCenter si type==="recoveryCenter", edit-<slug>-article si "article", …)
  if (Array.isArray(profileConfig?.editModals)) {
    for (const route of profileConfig.editModals) {
      if (route.editModal && matchesEditModalCondition(serverData, route.editModalMatch)) return route.editModal;
    }
  }

  // 2. Rétro-compat : editModal unique conditionnel (comportement historique).
  if (profileConfig?.editModal && matchesEditModalCondition(serverData, profileConfig.editModalMatch)) {
    return profileConfig.editModal;
  }

  // 3. Générique.
  return "edit-profile";
}

/**
 * Wrapper config-driven : choisit dynamiquement le modal d'édition pour l'entité.
 * Remplace les usages directs de `<EditProfileModal>` dans les headers de profil.
 * `modalName` (optionnel) FORCE une clé (ex. `edit-<costum>` ou `edit-profile`) en
 * court-circuitant la résolution `profiles[type].editModal` — utilisé par l'admin
 * quand la config de section choisit explicitement costum ou standard.
 */
export function DynamicEditModal({
  open,
  onOpenChange,
  entity,
  modalName: forcedModalName,
}: EditModalProps & { modalName?: string }) {
  const { config } = useSite();
  const modalName = forcedModalName ?? resolveEditModalName(entity, config);
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
