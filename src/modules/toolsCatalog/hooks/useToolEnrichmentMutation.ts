import { useRef } from "react";
import type { ToolEnrichmentInput } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { TOOLS_CATALOG_QUERY_KEYS } from "../constants/queryKeys";
import { readEnrichmentVerdict } from "../utils/enrichmentResult";

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
  // Upload en 2 temps sans rollback possible côté backend : si `saveToolEnrichment`
  // échoue APRÈS l'upload, on retient le résultat pour le réutiliser au retry du
  // MÊME fichier — sinon chaque tentative uploaderait une copie orpheline de plus
  // sur l'élément porteur.
  const uploadedRef = useRef<{ file: File; docId: string; docPath: string } | null>(null);

  // `unknown` et PAS `ToolEnrichmentResult` : selon la version de lib installée, la
  // valeur rendue est soit l'enveloppe, soit le document `navigatorcriteria` déballé
  // (cf. `readEnrichmentVerdict`). La typer en enveloppe serait une affirmation fausse
  // sur la lib en place. Aucun appelant ne lit `mutation.data` — seul le verdict compte.
  return useMutationWithToast<unknown, ToolEnrichmentSubmit>({
    mutationFn: async ({ imageFile, ...input }: ToolEnrichmentSubmit) => {
      if (!carrier) throw new Error("Contexte costum indisponible");

      let payload: ToolEnrichmentInput = input;
      if (imageFile) {
        let uploaded = uploadedRef.current;
        if (!uploaded || uploaded.file !== imageFile) {
          const { docId, docPath } = await carrier.uploadDocument(imageFile, {
            contentKey: "icons",
            docType: "image",
          });
          uploaded = { file: imageFile, docId, docPath };
          uploadedRef.current = uploaded;
        }
        payload = { ...payload, imageTool: uploaded.docPath, imageToolId: uploaded.docId };
      }

      const res = await carrier.saveToolEnrichment(payload);
      // ⚠️ PAS `res.results` : la lib déballe la clé métier `data` et perd le verdict,
      // si bien qu'un enregistrement réussi remontait en échec (HTTP 200, base à jour,
      // toast rouge). `readEnrichmentVerdict` reconstitue l'enveloppe — cf. sa doc.
      const { ok, msg } = readEnrichmentVerdict(res);
      if (!ok) {
        // Le `msg` serveur est du FR PHP hors i18n → NE PAS le mettre dans `Error.message`
        // (`showErrorToast` le rendrait en description du toast). Message vide → description
        // vide, l'utilisateur ne voit que le titre i18n `edit.error` ; le `msg` reste en
        // `cause` pour le diagnostic (console / error tracking).
        throw Object.assign(new Error(""), { cause: msg });
      }
      return res;
    },
    successKey: "edit.success",
    errorKey: "edit.error",
    invalidateQueries: [TOOLS_CATALOG_QUERY_KEYS.LIST_PREFIX],
    namespace: "modules/toolsCatalog",
  });
}
