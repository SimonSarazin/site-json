/**
 * Options de requête PARTAGÉES pour la config d'un AAC.
 *
 * `useAacConfig` et `useAacFormMeta` ont besoin de deux vues du MÊME document :
 * les règles résolues (étapes, rôles, gates) d'un côté, les métadonnées de
 * questions (libellés, listes d'options) de l'autre. Un second `useQuery` avec
 * sa propre clé referait l'appel réseau.
 *
 * D'où ce `queryOptions` unique : une entrée de cache, deux `select`.
 * React Query déduplique par `queryKey`, donc les deux hooks montés dans la même
 * section ne déclenchent qu'une requête.
 *
 * ## Pourquoi le `Form` vient de l'ENTITÉ, pas de l'`Api`
 *
 * `api.form({id})` construit un `Form` dont le parent est l'`ApiClient`
 * (`Api.form()` → `new Form(this._client, …)`). Or `Form.getProposals` exige un
 * parent qui porte un **slug de costum** — c'est lui qui devient le pathParam
 * `{source}` de `directoryproposal` — et lève un 400 explicite sinon.
 *
 * `entity.form({id})` (`BaseEntity.form()` → `this.entity("forms", …)`) pose au
 * contraire l'entité courante en parent. On garde donc l'INSTANCE dans le
 * bundle : c'est elle que le transport appellera, et la mettre en cache évite un
 * `form.get()` par page.
 */
import { queryOptions } from "@tanstack/react-query";
import type { Api, Form, Organization, Project } from "@communecter/cocolight-api-client";
import { AAC_QUERY_KEYS } from "../constants/queryKeys";
import { resolveAacConfig } from "../lib/resolveAacConfig";
import { buildAacFormMeta, type AacFormMeta } from "../lib/formMeta";
import type { AacResolvedConfig } from "../types";

/** L'entité costum porteuse de l'AAC — celle dont le slug fait le `{source}`. */
export type AacHostEntity = Organization | Project;

/** Ce qui est réellement mis en cache sous `AAC_QUERY_KEYS.CONFIG(formId)`. */
export interface AacConfigBundle {
  config: AacResolvedConfig;
  meta: AacFormMeta;
  /**
   * Id du contexte porteur (1re clé de `form.parent`). C'est la valeur que le
   * backend AAP emploie pour lire `choose[contextId]` — à préférer au
   * `contextId` du costum, qui peut diverger.
   */
  contextId: string | null;
  /**
   * `form.params` BRUT.
   *
   * `AacFormMeta` n'en garde que les listes d'options des questions ; l'arbre
   * d'usage a besoin des entrées `categorizedCheckbox*`, avec leurs `list` et
   * `sublist`, que la normalisation écarte. On garde donc l'original.
   */
  params: unknown;
  /**
   * L'INSTANCE `Form`, rattachée à l'entité costum.
   *
   * C'est le point d'entrée de l'annuaire (`form.getProposals`). On la garde
   * plutôt que de la reconstruire : `entity.form({id})` déclenche un `get()`, et
   * le refaire à chaque page serait un aller-retour de trop.
   */
  form: Form;
}

/** Sélecteurs définis au niveau module : une référence stable par `select`. */
export const selectAacConfig = (b: AacConfigBundle): AacResolvedConfig => b.config;
export const selectAacFormMeta = (b: AacConfigBundle): AacFormMeta => b.meta;
export const selectAacContextId = (b: AacConfigBundle): string | null => b.contextId;
export const selectAacFormParams = (b: AacConfigBundle): unknown => b.params;
export const selectAacFormEntity = (b: AacConfigBundle): Form => b.form;

function firstParentId(formData: unknown): string | null {
  const parent = (formData as { parent?: unknown } | null)?.parent;
  if (!parent || typeof parent !== "object" || Array.isArray(parent)) return null;
  return Object.keys(parent as Record<string, unknown>)[0] ?? null;
}

export function aacConfigQueryOptions(
  api: Api | null,
  entity: AacHostEntity | null,
  formId: string | null
) {
  return queryOptions({
    queryKey: AAC_QUERY_KEYS.CONFIG(formId),
    // `entity` est requise : sans elle, pas de slug costum, donc pas de
    // `{source}` — l'annuaire ne peut pas être interrogé.
    enabled: !!api && !!entity && !!formId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AacConfigBundle> => {
      if (!api || !entity || !formId) throw new Error("API non initialisée");

      const form = await entity.form({ id: formId });
      const formData = form.serverData as unknown;

      // aapConfig (`form.config`) — best-effort : son absence ne doit pas
      // empêcher de résoudre les règles portées par le form parent.
      const configId = (formData as { config?: unknown } | null)?.config;
      let configData: unknown;
      if (typeof configId === "string" && configId) {
        try {
          const cfg = await api.form({ id: configId });
          configData = cfg.serverData as unknown;
        } catch {
          configData = undefined;
        }
      }

      return {
        config: resolveAacConfig(formId, formData, configData),
        meta: buildAacFormMeta(formId, formData),
        contextId: firstParentId(formData),
        params: (formData as { params?: unknown } | null)?.params,
        form,
      };
    },
  });
}
