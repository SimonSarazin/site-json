import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCocolightOptional } from "@/hooks/useCocolight";
import { COFORM_QUERY_KEYS } from "../constants/queryKeys";
import { buildCategorizedOptions, parseQuestionPath, usesRemoteSource } from "../utils/categorizedCheckbox";
import type {
  CategorizedCheckboxConfig,
  CategorizedCheckboxOption,
  CommonTableCatalog,
} from "../types";

/** Type de l'input commonTable côté legacy — les seules questions éligibles comme source. */
const COMMON_TABLE_TYPE = "tpls.forms.evaluation.commonTableV2";

/** Structure minimale renvoyée par `Form.get()` : `inputs` = les STEPS, chacun avec ses inputs. */
interface FormStructure {
  inputs?: Record<string, { inputs?: Record<string, { type?: string; label?: string }> }>;
  params?: Record<string, unknown>;
}

interface UseCategorizedCheckboxOptionsReturn {
  options: CategorizedCheckboxOption[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Construit l'arbre d'options d'un `categorizedCheckbox`.
 *
 * C'est ici que vit la RELATION AU COMMONTABLE, la raison d'être de cet input : les catégories de
 * niveau 1 sont des questions `commonTableV2` d'un ou plusieurs formulaires TIERS, et leurs
 * sous-options sont les criterias saisies par les répondants de ces formulaires (le champ `usage`).
 *
 * Deux appels SDK, tous deux `auth: none`, qui remplacent les deux actions ajax du legacy
 * (`getquestionsbytypes` et `getcriterias`) sans rien ajouter au SDK ni au backend :
 *
 *  1. `Form.get()` sur chaque formulaire source → ses steps et leurs inputs → on retient les
 *     questions de type commonTable, dans l'ordre de `questionsParamsSource` (cet ordre EST
 *     l'indexation des clés persistées, cf. `utils/categorizedCheckbox.ts`) ;
 *  2. `Form.getCatalogs({ inputKeys })` → les criterias de ces questions, agrégées sur toutes les
 *     réponses, avec leur `count` de répondants.
 *
 * ⚠️ `getformcatalogs` ne lit QUE les réponses ; le legacy `Coform::getCriterias` lisait aussi
 * `form.params.criterias{inputKey}`. Comme `Form.get()` rapporte déjà les `params` du formulaire
 * source, cette seconde source est fusionnée ici — sinon les 26 formulaires du parc dont le
 * catalogue vit dans `params` (mesuré) rendraient des catégories sans aucune sous-option.
 */
export function useCategorizedCheckboxOptions(
  config: CategorizedCheckboxConfig | undefined,
): UseCategorizedCheckboxOptionsReturn {
  // Variante TOLÉRANTE : `CoFormReadOnly` se rend délibérément hors `CocolightProvider` (il lit
  // `me` avec la même variante). Avec `useCocolight`, afficher une réponse dans ce contexte
  // planterait. Sans API, la requête est simplement désactivée : les options ne sont pas
  // résolues, et les valeurs enregistrées retombent sur l'affichage « orphelin » du composant —
  // dégradé, mais la réponse de l'utilisateur reste visible.
  const cocolight = useCocolightOptional();
  const api = cocolight?.api ?? null;
  const loading = cocolight?.loading ?? false;

  // Chemins retenus : ceux dont le formulaire est bien déclaré en source. Un `questionsParamsSource`
  // peut survivre au retrait de son formulaire du finder — le legacy le laissait alors sans options.
  const questionPaths = useMemo(() => {
    if (!config || !usesRemoteSource(config)) return [];
    const allowed = new Set(config.formParamsSource);
    return config.questionsParamsSource.filter((p) => {
      const parsed = parseQuestionPath(p);
      return !!parsed && (allowed.size === 0 || allowed.has(parsed.formId));
    });
  }, [config]);

  const isReady = !loading && !!api;

  const { data, isLoading, error } = useQuery({
    queryKey: COFORM_QUERY_KEYS.CATEGORIZED_OPTIONS(questionPaths),
    queryFn: async () => {
      if (!api) throw new Error("API non initialisée");

      // Grouper par formulaire source : une structure + un batch de catalogues par formulaire.
      const byForm = new Map<string, string[]>();
      for (const path of questionPaths) {
        const parsed = parseQuestionPath(path);
        if (!parsed) continue;
        const keys = byForm.get(parsed.formId) ?? [];
        keys.push(parsed.inputKey);
        byForm.set(parsed.formId, keys);
      }

      const perForm = await Promise.all(
        [...byForm.entries()].map(async ([formId, inputKeys]) => {
          const form = await api.form({ id: formId });
          const structure = (await form.get()) as FormStructure;

          // Aplatir les inputs de tous les steps : le chemin porte un stepId, mais il n'est pas
          // fiable (steps renommés/déplacés) — l'inputKey, lui, est unique dans le formulaire.
          const inputsByKey: Record<string, { type?: string; label?: string }> = {};
          for (const step of Object.values(structure.inputs ?? {})) {
            for (const [k, v] of Object.entries(step?.inputs ?? {})) inputsByKey[k] = v;
          }

          const catalogs = await form.getCatalogs({ inputKeys });
          return { formId, inputsByKey, catalogs, params: structure.params ?? {} };
        }),
      );

      const resolved = new Map(perForm.map((f) => [f.formId, f]));

      // Ordre = celui de `questionsParamsSource`. C'est l'indexation des clés persistées.
      const remote: Array<{ label: string; catalog: CommonTableCatalog }> = [];
      for (const path of questionPaths) {
        const parsed = parseQuestionPath(path);
        if (!parsed) continue;
        const source = resolved.get(parsed.formId);
        if (!source) continue;
        const def = source.inputsByKey[parsed.inputKey];
        // Une question qui n'est plus un commonTable est ignorée : elle n'a pas de criterias, et la
        // garder décalerait l'index de toutes les suivantes.
        if (!def || def.type !== COMMON_TABLE_TYPE) continue;

        const fromAnswers = (source.catalogs?.[parsed.inputKey] ?? {}) as CommonTableCatalog;
        const fromParams = (source.params[`criterias${parsed.inputKey}`] ?? {}) as CommonTableCatalog;
        // Les réponses priment : elles portent `count` et les usages réellement employés.
        remote.push({
          label: def.label ?? "",
          catalog: { ...fromParams, ...fromAnswers },
        });
      }
      return remote;
    },
    enabled: isReady && questionPaths.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const options = useMemo(
    () => (config ? buildCategorizedOptions(config, data ?? []) : []),
    [config, data],
  );

  return {
    options,
    // Pas de requête (mode manuel, ou aucune source) → jamais "en chargement".
    isLoading: questionPaths.length > 0 && isLoading,
    error: (error as Error | null) ?? null,
  };
}
