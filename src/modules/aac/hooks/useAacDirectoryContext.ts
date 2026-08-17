/**
 * Le socle que partage TOUTE surface lisant les communs d'un AAC.
 *
 * Une carte, un décompte et une facette doivent porter sur exactement le même
 * ensemble : mêmes questions résolues, même restriction de visibilité. Deux
 * sections qui recâbleraient chacune leur `form` + `fields` + `visibility`
 * finiraient par diverger — et un médaillon « 12 communs » posé au-dessus d'une
 * grille qui en montre 9 se lit comme un bug, pas comme un filtre.
 *
 * Aucune requête supplémentaire : tout vient de l'entrée de cache d'
 * `aacConfigQuery`, lue par des `select` différents.
 */
import { useMemo } from "react";
import type { Form } from "@communecter/cocolight-api-client";
import { useSite } from "@/hooks/useSite";
import { useCocolight } from "@/hooks/useCocolight";
import { getBaseUrl } from "@/lib/constant/common";
import { useAacConfig } from "./useAacConfig";
import {
  useAacFormMeta,
  useAacContextId,
  useAacFormParams,
  useAacFormEntity,
} from "./useAacFormMeta";
import { useAacPermissions } from "./useAacPermissions";
import {
  resolveAacCardFields,
  EMPTY_AAC_CARD_FIELDS,
  type AacCardFields,
  type ResolvedAacCardFields,
} from "../lib/resolveAacCardFields";
import type { AacVisibility } from "../lib/aacQueryParams";
import type { AacResolvedConfig } from "../types";

export interface AacDirectoryContext {
  /** `config.aac.formId` — `null` si le site n'a pas déclaré d'AAC. */
  formId: string | null;
  /** Config résolue du formulaire (étapes, rôles, gates). */
  config: AacResolvedConfig | null;
  /**
   * L'instance `Form` RATTACHÉE à l'entité costum : son parent porte le slug qui
   * devient le pathParam `{source}` de l'endpoint. `null` tant qu'elle charge.
   */
  form: Form | null;
  /** Quelles questions portent titre / description / tags / maturité / dépense. */
  fields: AacCardFields;
  /** La résolution complète, avec sa `source` — pour diagnostiquer une carte vide. */
  resolved: ResolvedAacCardFields | null;
  contextId: string | null;
  /** `form.params` brut — les libellés exacts de l'arbre d'usage. */
  formParams: unknown;
  /** Qui regarde : entre dans les query keys, la population visible en dépend. */
  visibility: AacVisibility;
  baseUrl: string;
  /** Le formulaire n'est pas encore arrivé — les libellés de facettes manquent. */
  isFormLoading: boolean;
}

export function useAacDirectoryContext(): AacDirectoryContext {
  const { config: siteConfig } = useSite();
  const { entity } = useCocolight();

  const formId = siteConfig.aac?.formId ?? null;

  const { config } = useAacConfig(formId);
  const { meta, isLoading: isFormLoading } = useAacFormMeta(formId);
  const contextId = useAacContextId(formId);
  const formParams = useAacFormParams(formId);
  const form = useAacFormEntity(formId);

  // L'override de config prime, sinon heuristique — jamais d'id en dur ici.
  const resolved = useMemo(
    () =>
      meta && config
        ? resolveAacCardFields(meta, config.roles, siteConfig.aac?.directory?.fields)
        : null,
    [meta, config, siteConfig.aac?.directory?.fields]
  );

  // Un visiteur NON ADMINISTRATEUR ne voit que les communs sélectionnés, plus
  // les siens — parité avec le filtre `applyFor: "forUser"` du bloc legacy.
  const perms = useAacPermissions(entity);
  const visibility = useMemo<AacVisibility>(
    () => ({
      isAdmin: perms.isAdmin,
      currentUserId: perms.currentUserId,
      contextId,
    }),
    [perms.isAdmin, perms.currentUserId, contextId]
  );

  return {
    formId,
    config: config ?? null,
    form,
    fields: resolved?.fields ?? EMPTY_AAC_CARD_FIELDS,
    resolved,
    contextId,
    formParams,
    visibility,
    baseUrl: getBaseUrl(),
    isFormLoading,
  };
}
