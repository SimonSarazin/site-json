import { lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useSite } from "@/hooks/useSite";
import { entityMatchData } from "@/lib/entityMatch";
import { check } from "@/modules/formEngine/engine/conditional";
import type { FormValues, Predicate } from "@/modules/formEngine/types";

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

/** Une route de la table `editModals` (ou la paire historique `editModal`/`editModalMatch`). */
interface EditModalRoute {
  editModal?: string;
  editModalMatch?: Record<string, unknown>;
  when?: Predicate;
}

/**
 * Vérifie si une condition `editModalMatch` est satisfaite par la vue matchable de l'entité.
 *
 * Objet plain `{ clé: valeur }` — AND implicite sur toutes les clés.
 * Pour chaque paire :
 *  - Si la valeur courante est un array → `.includes(valeurAttendue)`
 *  - Sinon → égalité stricte (`===`)
 *
 * `match` absent/undefined → `true` (pas de filtre = match universel).
 *
 * ⚠ `data` est la vue {@link entityMatchData} (Proxy), PAS `serverData` brut : les clés pointées
 * (`reference.costum`) et les champs synthétiques (`sourceKey`/`sourceKeys`) y sont donc résolus.
 * Avant ce branchement le lookup était plat, ce qui rendait toute condition de provenance
 * inexprimable — une clé `"source.key"` valait silencieusement `undefined`.
 */
function matchesEditModalCondition(
  data: FormValues,
  match: Record<string, unknown> | undefined
): boolean {
  if (!match) return true;
  return Object.entries(match).every(([key, expected]) => {
    const actual = (data as Record<string, unknown>)[key];
    if (Array.isArray(actual)) return actual.includes(expected);
    return actual === expected;
  });
}

/**
 * Une route matche-t-elle l'entité ? `editModalMatch` (forme plate) ET `when` (prédicat) doivent
 * être satisfaits — les deux sont optionnels, une route sans ni l'un ni l'autre est un catch-all.
 *
 * GARDE : un prédicat malformé (ex. `op:"matches"` avec un regex invalide) fait échouer la route
 * au lieu de casser tout le rendu — même politique que `firstMatching` (cf. `lib/entityMatch`).
 * Échouer plutôt que matcher est le choix SÛR : au pire l'utilisateur obtient le formulaire
 * générique, jamais un formulaire costum sur une entité qui n'en relève pas.
 */
function routeMatches(data: FormValues, route: EditModalRoute): boolean {
  if (!matchesEditModalCondition(data, route.editModalMatch)) return false;
  try {
    return check(route.when, data);
  } catch (err) {
    console.warn(`[EditModalRegistry] prédicat "when" invalide sur ${route.editModal} — route ignorée`, err);
    return false;
  }
}

/**
 * Résout le nom du modal d'édition à utiliser pour une entité donnée.
 *
 * Règle :
 *  1. Lit `profiles[<type>]` de la config (`getEntityType()` renvoie DÉJÀ le pluriel :
 *     "organizations", "projects", … — ne pas re-pluraliser).
 *  2. Table `editModals[]` : le PREMIER élément dont la condition matche gagne.
 *  3. Repli `editModal` + `editModalMatch` (format historique, une seule route).
 *  4. Rien ne matche → `"edit-profile"` (générique).
 *
 * Conditions d'une route (toutes optionnelles, cumulatives) :
 *  - `editModalMatch` — forme plate `{clé: valeur}`, cf. {@link matchesEditModalCondition} ;
 *  - `when` — prédicat complet (`and`/`or`/`not`, ops `eq`/`contains`/`ne`/…), même grammaire que
 *    `list.itemRules` et les règles d'icônes de la palette.
 * Une route SANS condition est un **catch-all** : elle s'applique à TOUTES les entités du type,
 * y compris celles étrangères au costum, et court-circuite les routes suivantes → la placer en
 * dernier, et n'y recourir que si le formulaire vaut vraiment pour toute la collection.
 *
 * ⚠ **Périmètre costum.** Ni cette fonction ni le formulaire costum ne vérifient d'eux-mêmes
 * qu'une entité relève du costum : c'est à la config de le dire. Aucun champ PLAT ne le porte —
 * la provenance vit dans `source.key`/`source.keys` (exposés en `sourceKey`/`sourceKeys`) et le
 * rattachement secondaire dans `reference.costum` (l'`afterSave` legacy pose ce marqueur quand la
 * provenance diffère du costum). Le patron est donc :
 *
 * ```json
 * "when": { "or": [
 *   { "field": "sourceKeys",       "op": "contains", "value": "<costumSlug>" },
 *   { "field": "reference.costum", "op": "contains", "value": "<costumSlug>" }
 * ]}
 * ```
 *
 * ⚠ **Champ non projeté = règle morte, en silence.** Un prédicat portant sur un champ absent de la
 * réponse serveur ne matchera jamais sans lever d'erreur. `element/about` (fiche profil) projette
 * bien `source`, `reference`, `links` et `costum` ; en revanche les résultats de RECHERCHE sont
 * limités à `baseParams.defaultFields` — vérifier la projection avant de router sur un champ.
 *
 * Exportée pour permettre à un composant de pré-décider sans monter `DynamicEditModal`
 * (ex. afficher/masquer un bouton) — usage prévu mais pas encore en place.
 */
export function resolveEditModalName(
  entity: EntityTypes,
  config: ReturnType<typeof useSite>["config"]
): string {
  const profileKey = typeof entity.getEntityType === "function" ? entity.getEntityType() : null;
  const profiles = config.profiles as
    | Record<string, ({ editModals?: EditModalRoute[] } & EditModalRoute) | undefined>
    | undefined;
  const profileConfig = profileKey ? profiles?.[profileKey] : undefined;
  if (!profileConfig) return "edit-profile";

  // Vue matchable (serverData + `sourceKey`/`sourceKeys` synthétiques + chemins pointés résolus),
  // calculée UNE fois pour toutes les routes du type.
  const data = entityMatchData(entity);

  // 1. Table de routage multi sous-types (costum à plusieurs forms / collection) : PREMIER match gagne.
  //    (ex. poi → edit-<slug>-recoveryCenter si type==="recoveryCenter", edit-<slug>-article si "article", …)
  if (Array.isArray(profileConfig.editModals)) {
    for (const route of profileConfig.editModals) {
      if (route.editModal && routeMatches(data, route)) return route.editModal;
    }
  }

  // 2. Rétro-compat : editModal unique conditionnel (comportement historique).
  if (profileConfig.editModal && routeMatches(data, profileConfig)) {
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
