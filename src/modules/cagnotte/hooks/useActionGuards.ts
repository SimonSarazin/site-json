/**
 * Guards d'entrée pour les handlers de mutations de `ActionsSection` (et autres
 * sections cagnotte). Centralise les deux gardes répétés dans 6+ handlers :
 *
 *  1. **`requireConnected(actionSuffix)`** — vérifie `isConnected`, affiche le toast
 *     `loginRequired.{actionSuffix}` si l'utilisateur n'est pas authentifié.
 *  2. **`requireApiContext(toastNamespace)`** — vérifie que `apiClient`, `projectId` et
 *     `answerId` sont tous présents avant d'invoquer une mutation.
 *
 * Les deux fonctions retournent `true` si le guard passe (l'appelant continue),
 * `false` sinon (le toast a été affiché, l'appelant doit `return`).
 *
 * Avant ce hook, ce boilerplate occupait 8-10 lignes en début de chaque handler :
 *
 *   if (!isConnected) { showErrorToast(...); return; }
 *   if (!apiClient || !projectId || !answerId) { showErrorToast(...); return; }
 */
import type { ApiClient } from "@communecter/cocolight-api-client";
import { showErrorToast } from "@/lib/toastUtils";
import { useT } from "@/hooks/useT";

export interface ActionGuardContext {
  isConnected: boolean;
  apiClient: ApiClient | null;
  projectId: string;
  answerId: string;
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

  const requireApiAacContext: ActionGuards["requireApiContext"] = (toastNamespace) => {
    if (ctx.apiClient && ctx.answerId) return true;
    showErrorToast(
      new Error(String(t(`ActionsSection.toasts.${toastNamespace}.description`))),
      `ActionsSection.toasts.${toastNamespace}.title`,
      t,
    );
    return false;
  };

  return { requireConnected, requireApiContext, requireApiAacContext };
}
