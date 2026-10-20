/**
 * Guards d'entrée pour les handlers de mutations de `ActionsSection` (et autres
 * sections cagnotte). Centralise les deux gardes répétés dans 6+ handlers :
 *
 *  1. **`requireConnected(actionSuffix)`** — vérifie `isConnected`, affiche le toast
 *     `loginRequired.{actionSuffix}` si l'utilisateur n'est pas authentifié.
 *  2. **`requireApiContext(toastNamespace)`** — vérifie que `apiClient`, `projectId` et
 *     `answerId` sont tous présents avant d'invoquer une mutation.
 *  3. **`requireProjectEntity(toastNamespace)`** — vérifie que l'entité `Project`
 *     que portent les mutations d'action est en main dès qu'un projet est lié.
 *
 * Les deux fonctions retournent `true` si le guard passe (l'appelant continue),
 * `false` sinon (le toast a été affiché, l'appelant doit `return`).
 *
 * Avant ce hook, ce boilerplate occupait 8-10 lignes en début de chaque handler :
 *
 *   if (!isConnected) { showErrorToast(...); return; }
 *   if (!apiClient || !projectId || !answerId) { showErrorToast(...); return; }
 */
import type { ApiClient, Project } from "@communecter/cocolight-api-client";
import { showErrorToast } from "@/lib/toastUtils";
import { useT } from "@/hooks/useT";

export interface ActionGuardContext {
  isConnected: boolean;
  apiClient: ApiClient | null;
  projectId: string;
  answerId: string;
  /**
   * Entité `Project` du SDK, celle que portent les mutations d'action
   * (`ActionMutationContext.project`). Optionnelle : les appelants qui l'ont
   * toujours en main n'ont pas besoin de `requireProjectEntity`.
   */
  project?: Project | null;
}

export interface ActionGuards {
  /**
   * Vérifie que l'utilisateur est connecté.
   * @param actionSuffix — suffixe de la clé i18n `loginRequired.{actionSuffix}`
   *   (ex. `"candidate"`, `"editAction"`, `"delete"`).
   * @returns `true` si connecté, `false` sinon (toast affiché).
   */
  requireConnected: (actionSuffix: string) => boolean;
  /**
   * Vérifie que `apiClient`, `projectId`, `answerId` sont tous présents.
   * @param toastNamespace — namespace de la clé i18n `{toastNamespace}.title` et
   *   `{toastNamespace}.description` (ex. `"deleteImpossible"`, `"editImpossible"`).
   * @returns `true` si le contexte est complet, `false` sinon (toast affiché).
   */
  requireApiContext: (toastNamespace: string) => boolean;
  /**
   * Vérifie que `apiClient` et `answerId` sont tous présents.
   * @param toastNamespace — namespace de la clé i18n `{toastNamespace}.title` et
   *   `{toastNamespace}.description` (ex. `"deleteImpossible"`, `"editImpossible"`).
   * @returns `true` si le contexte est complet, `false` sinon (toast affiché).
    */
  requireApiAacContext: (toastNamespace: string) => boolean;
  /**
   * Vérifie que l'entité `Project` est en main dès qu'un projet est lié
   * (`projectId` non vide). Sans projet lié, rien à exiger : passe.
   *
   * Les mutations d'action (`useMarkActionDone`, `useDeleteAction`,
   * `useCandidateAction`) lèvent `milestone.errors.projectMissing` sans elle ; or
   * les droits d'action (auteur, contributeur) ne dépendent pas de l'entité — sur la
   * fiche commun elle est résolue de façon asynchrone et reste `null` quand la
   * résolution échoue. `requireApiAacContext` ne la voit pas : il ne teste que
   * `apiClient` et `answerId`. Ce garde dit le motif AVANT `mutate()`, au lieu
   * d'une mutation vouée à l'échec.
   *
   * @param toastNamespace — namespace de la clé i18n `ActionsSection.toasts.{toastNamespace}.title`
   *   (ex. `"actionCompleteFailed"`, `"actionDeleteFailed"`, `"candidateFailed"`) ;
   *   la description est `milestone.errors.projectMissing`.
   * @returns `true` si l'entité est disponible (ou sans projet lié), `false` sinon (toast affiché).
   */
  requireProjectEntity: (toastNamespace: string) => boolean;
}

export function useActionGuards(ctx: ActionGuardContext): ActionGuards {
  const t = useT("modules/cagnotte");

  const requireConnected: ActionGuards["requireConnected"] = (actionSuffix) => {
    if (ctx.isConnected) return true;
    showErrorToast(
      new Error(String(t(`ActionsSection.toasts.loginRequired.${actionSuffix}`))),
      "ActionsSection.toasts.loginRequired.title",
      t,
    );
    return false;
  };

  const requireApiContext: ActionGuards["requireApiContext"] = (toastNamespace) => {
    if (ctx.apiClient && ctx.projectId && ctx.answerId) return true;
    showErrorToast(
      new Error(String(t(`ActionsSection.toasts.${toastNamespace}.description`))),
      `ActionsSection.toasts.${toastNamespace}.title`,
      t,
    );
    return false;
  };

  const requireApiAacContext: ActionGuards["requireApiAacContext"] = (toastNamespace) => {
    if (ctx.apiClient && ctx.answerId) return true;
    showErrorToast(
      new Error(String(t(`ActionsSection.toasts.${toastNamespace}.description`))),
      `ActionsSection.toasts.${toastNamespace}.title`,
      t,
    );
    return false;
  };

  const requireProjectEntity: ActionGuards["requireProjectEntity"] = (toastNamespace) => {
    if (!ctx.projectId || ctx.project) return true;
    showErrorToast(
      new Error(String(t("milestone.errors.projectMissing"))),
      `ActionsSection.toasts.${toastNamespace}.title`,
      t,
    );
    return false;
  };

  return { requireConnected, requireApiContext, requireApiAacContext, requireProjectEntity };
}
