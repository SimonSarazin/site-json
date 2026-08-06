import type { ToolEnrichmentInput, ToolEnrichmentResult } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { TOOLS_CATALOG_QUERY_KEYS } from "../constants/queryKeys";

/** Fichier image à uploader avant enregistrement (optionnel). */
export interface ToolEnrichmentSubmit extends ToolEnrichmentInput {
  imageFile?: File | null;
}

/**
 * Enregistre l'enrichissement d'un outil (`navigatorcriteria`).
 *
 * Deux temps quand une image est jointe : l'upload passe par le flux document
 * générique (`uploadDocument`, `contentKey: "icons"` — même clé que le legacy),
 * puis le `docPath` retourné est enregistré en `imageTool`. L'upload est porté par
 * l'élément du costum, comme dans le legacy (`ownerId = costum.contextId`) — une
 * organisation ou un projet selon le costum.
 *
 * Invalide `LIST_PREFIX` : la liste porte l'image, le lien, la description et le
 * drapeau open source de chaque outil.
 *
 * Les messages d'échec du serveur ne sont PAS affichés : ils viennent du PHP en
 * français et ne passent par aucun canal i18n. Ils restent dans l'`Error` pour le
 * diagnostic ; l'utilisateur voit `edit.error`.
 */
export function useToolEnrichmentMutation() {
  const { entity: carrier } = useCocolight();

  return useMutationWithToast<ToolEnrichmentResult, ToolEnrichmentSubmit>({
    mutationFn: async ({ imageFile, ...input }: ToolEnrichmentSubmit) => {
      if (!carrier) throw new Error("Contexte costum indisponible");

      let payload: ToolEnrichmentInput = input;
      if (imageFile) {
        const { docId, docPath } = await carrier.uploadDocument(imageFile, {
          contentKey: "icons",
          docType: "image",
        });
        payload = { ...payload, imageTool: docPath, imageToolId: docId };
      }

      const res = await carrier.saveToolEnrichment(payload);
      if (!res.results) {
        throw new Error(res.msg || "Enregistrement refusé");
      }
      return res;
    },
    successKey: "edit.success",
    errorKey: "edit.error",
    invalidateQueries: [TOOLS_CATALOG_QUERY_KEYS.LIST_PREFIX],
    namespace: "modules/toolsCatalog",
  });
}
