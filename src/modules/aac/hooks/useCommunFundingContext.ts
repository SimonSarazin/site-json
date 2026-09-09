/**
 * Où vit un commun : l'appel sur lequel il a été DÉPOSÉ, et le contexte qui le porte.
 *
 * Un commun listé ici n'y a pas forcément été déposé — il suffit qu'un admin d'ici
 * l'ait sélectionné. Sa fiche est alors rendue avec le formulaire de l'appel COURANT
 * (cf. `AacCommunDetailPage`), mais son **financement** reste celui de son appel
 * d'origine : c'est l'entité de CE contexte qui détient son enveloppe.
 *
 * Une seule entrée de cache (`AAC_QUERY_KEYS.ORIGIN_FORM`) pour la page et pour les
 * sections : React Query déduplique, aucune requête n'est faite deux fois, et personne
 * n'a besoin de faire descendre le contexte en props.
 */
import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { AAC_QUERY_KEYS } from "../constants/queryKeys";
import { useAacDirectoryContext } from "./useAacDirectoryContext";
import { firstParent, type AacContext } from "../lib/formParent";

export interface UseCommunFundingContextResult {
  /**
   * Le contexte porteur de l'appel d'ORIGINE — et **`null` pour un commun déposé
   * ici**, où l'entité du site fait déjà l'hôte.
   */
  context: AacContext | null;
  /** Nom de l'appel d'origine — renseigné seulement s'il diffère de celui d'ici. */
  originFormName: string | null;
  /** Le commun a été déposé sur un AUTRE appel que celui de ce site. */
  isCommunEtranger: boolean;
}

/**
 * @param answerLike - la réponse (son champ `form` porte l'appel d'origine).
 */
export function useCommunFundingContext(
  answerLike: { form?: string } | null | undefined,
): UseCommunFundingContextResult {
  const { api, loading } = useCocolight();
  const directory = useAacDirectoryContext();

  const originFormId = answerLike?.form;
  const isCommunEtranger = Boolean(
    originFormId && directory.formId && originFormId !== directory.formId,
  );

  const { data } = useQuery({
    queryKey: AAC_QUERY_KEYS.ORIGIN_FORM(originFormId ?? null),
    enabled: !loading && !!api && isCommunEtranger && !!originFormId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{ name: string | null; context: AacContext | null }> => {
      if (!api || !originFormId) return { name: null, context: null };
      const form = await api.form({ id: originFormId });
      const formData = form.serverData as { name?: string } | undefined;
      return { name: formData?.name ?? null, context: firstParent(formData) };
    },
  });

  return {
    context: isCommunEtranger ? (data?.context ?? null) : null,
    originFormName: isCommunEtranger ? (data?.name ?? null) : null,
    isCommunEtranger,
  };
}
