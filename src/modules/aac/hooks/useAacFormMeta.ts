/**
 * Métadonnées de questions du formulaire AAC — libellés et listes d'options.
 *
 * Ce sont elles qui peuplent les filtres de l'annuaire : les options des
 * facettes « thème » et « maturité » viennent du VRAI formulaire, pas des
 * fixtures. Seuls les communs sont mockés.
 *
 * Aucun appel réseau supplémentaire : même entrée de cache que `useAacConfig`,
 * autre `select` (cf. `aacConfigQuery`).
 */
import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import {
  aacConfigQueryOptions,
  selectAacFormMeta,
  selectAacContextId,
  selectAacFormParams,
  selectAacFormEntity,
} from "./aacConfigQuery";
import type { Form } from "@communecter/cocolight-api-client";
import type { AacFormMeta } from "../lib/formMeta";

interface UseAacFormMetaResult {
  meta: AacFormMeta | null;
  isLoading: boolean;
  error: Error | null;
}

export function useAacFormMeta(formId: string | null): UseAacFormMetaResult {
  const { api, entity, loading } = useCocolight();

  const { data, isLoading, error } = useQuery({
    ...aacConfigQueryOptions(loading ? null : api, entity, formId),
    select: selectAacFormMeta,
  });

  return { meta: data ?? null, isLoading, error: (error as Error) ?? null };
}

/**
 * Id du contexte porteur de l'AAC — 1re clé de `form.parent`.
 * C'est la valeur qu'emploie le backend AAP pour lire `choose[contextId]`.
 */
export function useAacContextId(formId: string | null): string | null {
  const { api, entity, loading } = useCocolight();

  const { data } = useQuery({
    ...aacConfigQueryOptions(loading ? null : api, entity, formId),
    select: selectAacContextId,
  });

  return data ?? null;
}

/**
 * `form.params` brut — les entrées `categorizedCheckbox*` dont l'arbre d'usage
 * tire ses libellés exacts. Même entrée de cache, autre `select`.
 */
export function useAacFormParams(formId: string | null): unknown {
  const { api, entity, loading } = useCocolight();

  const { data } = useQuery({
    ...aacConfigQueryOptions(loading ? null : api, entity, formId),
    select: selectAacFormParams,
  });

  return data;
}

/**
 * L'instance `Form` rattachée à l'entité costum — le point d'entrée de
 * l'annuaire (`form.getProposals`).
 *
 * Même entrée de cache que la config : aucun aller-retour supplémentaire, et
 * une seule instance partagée par le listing et le comptage des facettes.
 * `null` tant que la config n'est pas chargée, ou si le site n'a pas d'entité
 * costum (sans slug, pas de `{source}`).
 */
export function useAacFormEntity(formId: string | null): Form | null {
  const { api, entity, loading } = useCocolight();

  const { data } = useQuery({
    ...aacConfigQueryOptions(loading ? null : api, entity, formId),
    select: selectAacFormEntity,
  });

  return data ?? null;
}
