import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";
import { costumListsOf, staticListValues } from "@/lib/costumLists";
import {
  isSamePermutation,
  prepareNewListKey,
  prepareNewValue,
  prepareRenamedValue,
  removeValueAt,
  type ListEditRejection,
} from "../lib/costumListsEditing";

/** Entité porteuse EXPLOITABLE par ce hook — sous-ensemble de `BaseEntity` (SDK) réellement
 *  utilisé, comme `ExclusiveWritable` (`lib/exclusiveFlag.ts`) pour la même raison : un contrat
 *  minimal, facile à simuler dans les tests, plutôt que le type SDK complet. */
export interface CostumListsWritableCarrier {
  isAdmin: (options?: { checkHierarchy?: boolean; silent?: boolean }) => boolean;
  updateField: (path: string, value: unknown, opts?: { arrayForm?: boolean }) => Promise<unknown>;
  refresh: () => Promise<unknown>;
  serverData?: Record<string, unknown>;
}

class ListEditRejectedError extends Error {
  constructor(public reason: ListEditRejection) {
    super(reason);
  }
}

type ListOp =
  | { kind: "add"; key: string; value: string }
  | { kind: "rename"; key: string; index: number; value: string }
  | { kind: "remove"; key: string; index: number }
  | { kind: "reorder"; key: string; next: string[] }
  | { kind: "createList"; key: string; value: string };

/**
 * Exécute UNE opération d'édition de `costum.lists` sur le carrier — un seul `carrier.updateField`
 * par opération (jamais une boucle), suivi d'un `carrier.refresh()` pour que
 * `useCostumListsReactive` (donc les filtres et `ValueSelectField`) se remette à jour sans reload —
 * même discipline que `growCostumLists` (`profil/forms/costum/parent62/fns.ts`).
 *
 * DEUX primitives (cf. `Endpoint SDK` — `UpdatePathValueData.edit` : « préférer omettre `arrayForm`
 * pour écraser un array ») :
 *  - ajouter / créer-liste : `$push` via `{arrayForm:true}` — ÉPROUVÉ en prod (identique à
 *    `growCostumLists`). Une nouvelle liste n'est donc JAMAIS créée vide : elle naît avec sa
 *    première valeur, dans le même appel. Constaté en pratique (communecter-dev) : un `$set` d'un
 *    tableau VIDE (`[]`) sur une clé inédite n'est pas persisté — `element/updatepathvalue` traite
 *    une valeur vide comme un no-op côté backend — alors que `$push` d'une vraie première valeur
 *    fonctionne (Mongo auto-vivifie le tableau manquant), et se comporte alors comme n'importe quel
 *    ajout de valeur ordinaire.
 *  - renommer/réordonner/supprimer : `$set` d'un tableau complet NON VIDE, sans aucune option —
 *    structurellement identique à un `$set` de champ simple, mais jamais exercé dans ce repo sur
 *    `costum.lists` avant l'ajout de cette section : à surveiller si un jour ces opérations doivent
 *    pouvoir VIDER une liste (dernier élément supprimé) — même risque de no-op silencieux qu'observé
 *    ci-dessus pour la création, non encore rencontré en pratique le cas échéant.
 *
 * Validation (doublon, vide, index hors bornes…) faite ICI, avant tout appel réseau — fail-fast
 * local, même choix que `selectNewValues`/`growCostumLists`.
 */
async function runListOp(carrier: CostumListsWritableCarrier, op: ListOp): Promise<void> {
  if (!carrier.isAdmin()) throw new Error("forbidden");
  const listes = costumListsOf(carrier);
  const path = `costum.lists.${op.key}`;

  if (op.kind === "createList") {
    const keyRes = prepareNewListKey(op.key, Object.keys(listes));
    if (!keyRes.ok) throw new ListEditRejectedError(keyRes.reason);
    const valueRes = prepareNewValue(op.value, []);
    if (!valueRes.ok) throw new ListEditRejectedError(valueRes.reason);
    await carrier.updateField(`costum.lists.${keyRes.value}`, valueRes.value, { arrayForm: true });
  } else if (op.kind === "add") {
    const existing = staticListValues(listes[op.key]) ?? [];
    const res = prepareNewValue(op.value, existing);
    if (!res.ok) throw new ListEditRejectedError(res.reason);
    await carrier.updateField(path, res.value, { arrayForm: true });
  } else if (op.kind === "rename") {
    const existing = staticListValues(listes[op.key]) ?? [];
    const res = prepareRenamedValue(op.value, op.index, existing);
    if (!res.ok) throw new ListEditRejectedError(res.reason);
    await carrier.updateField(path, res.value);
  } else if (op.kind === "remove") {
    const existing = staticListValues(listes[op.key]) ?? [];
    const next = removeValueAt(existing, op.index);
    // Même écueil que la création (cf. doc ci-dessus) : un `$set` à `[]` a de fortes chances d'être
    // traité comme une valeur vide par le backend et de ne RIEN persister — supprimer la dernière
    // valeur donnerait l'illusion d'avoir réussi alors que le serveur garde l'ancien tableau.
    if (next.length === 0) throw new ListEditRejectedError("wouldEmpty");
    await carrier.updateField(path, next);
  } else {
    const existing = staticListValues(listes[op.key]) ?? [];
    if (!isSamePermutation(existing, op.next)) throw new ListEditRejectedError("invalidIndex");
    await carrier.updateField(path, op.next);
  }
  await carrier.refresh();
}

/** Clé i18n de succès par nature d'opération — un toast par action explicite (même convention que
 *  `useDeleteEntity`/`useValidateGroup`/`useSetExclusiveFlag`), y compris le réordonnancement : la
 *  confirmation de persistance compte d'autant plus ici qu'on sait (cf. doc `runListOp`) que le
 *  backend peut no-opper silencieusement certaines écritures — pas de raison de s'en priver. */
const SUCCESS_KEY: Record<ListOp["kind"], string> = {
  add: "AdminLists.success.add",
  rename: "AdminLists.success.rename",
  remove: "AdminLists.success.remove",
  reorder: "AdminLists.success.reorder",
  createList: "AdminLists.success.createList",
};

/**
 * Mutations d'édition de `costum.lists` (section admin `AdminListsSection`) — enveloppe react-query
 * de `runListOp`, avec toast de succès (`AdminLists.success.*`) ou d'erreur par raison de rejet
 * (`AdminLists.reject.*`) ou générique (`AdminLists.error`). Pas de `useMutationWithToast` : les 5
 * natures d'opération ont chacune leur propre clé de succès ET plusieurs raisons de rejet distinctes
 * possibles côté erreur — hors de la forme `successKey`/`errorKey` fixes du wrapper générique (même
 * arbitrage que `useSetExclusiveFlag`, qui garde un `useMutation` brut pour la même raison). Pas
 * d'invalidation de query : `carrier.refresh()` (dans `runListOp`) suffit, la réactivité vient du
 * proxy SDK (`useCostumListsReactive`), pas de React Query côté lecture.
 */
export function useCostumListsMutations(carrier: CostumListsWritableCarrier | null) {
  const t = useT("modules/admin");

  const mutation = useMutation({
    mutationFn: (op: ListOp) => {
      if (!carrier) return Promise.reject(new Error("noContext"));
      return runListOp(carrier, op);
    },
    onSuccess: (_data, op) => {
      toast.success(t(SUCCESS_KEY[op.kind]));
    },
    onError: (error: unknown) => {
      const reason = error instanceof ListEditRejectedError ? error.reason : null;
      toast.error(reason ? t(`AdminLists.reject.${reason}`) : t("AdminLists.error"));
    },
  });

  return {
    addValue: (key: string, value: string) => mutation.mutateAsync({ kind: "add", key, value }),
    renameValue: (key: string, index: number, value: string) =>
      mutation.mutateAsync({ kind: "rename", key, index, value }),
    removeValue: (key: string, index: number) => mutation.mutateAsync({ kind: "remove", key, index }),
    reorderValues: (key: string, next: string[]) => mutation.mutateAsync({ kind: "reorder", key, next }),
    createList: (key: string, value: string) => mutation.mutateAsync({ kind: "createList", key, value }),
    isPending: mutation.isPending,
  };
}
