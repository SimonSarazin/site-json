import { useCallback } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { getBaseUrl } from "@/lib/constant/common";
import { writtenImageAddress } from "../lib/inlineImages";

/** Ce dont le hook a besoin d'une entité : téléverser. */
interface UploaderEntity {
  id?: string | null;
  uploadDocument?: (
    file: File,
    opts: { contentKey: string; docType?: "image" | "file"; folder?: string; ownerId?: string },
  ) => Promise<{ docId: string; docPath: string }>;
}

/**
 * Importer une image pour l'écrire DANS le texte (`![…](/upload/…)`) — décision de l'user du 14/10/2026.
 *
 * Rend la fonction qui téléverse et rend l'adresse à écrire : le chemin RELATIF que sert le serveur
 * — le SDK le rend absolu, on lui retire l'origine (`writtenImageAddress`) —, lisible par le legacy
 * comme par le fil. `undefined` quand rien ne peut téléverser
 * (visiteur, SDK sans la méthode) : la coquille n'offre alors que l'onglet « Adresse ».
 *
 * Même téléversement que les pièces jointes (`useCommentImages`), à une différence près : le
 * document n'est PAS joint au message. Le serveur range les pièces jointes dans le dossier du message
 * à l'enregistrement (`Comment::insert` → `Document::moveDoc`), ce qui changerait leur adresse — et
 * casserait celle qu'on vient d'écrire dans le texte. L'image du texte reste donc rangée sous son
 * auteur, avec la clé du legacy (`markdown-editor.js`, `uploadImageFile` : `contentKey` `mdImage`) ;
 * seul le dossier diffère, `comments`, le SDK refusant celui du legacy (`communecter`).
 *
 * Le type et la taille se vérifient AVANT, chez qui choisit le fichier (`isAcceptedImage`,
 * `MAX_IMAGE_BYTES`) ; ici, une levée est un refus du serveur.
 */
export function useInlineImageUpload(): ((file: File) => Promise<string>) | undefined {
  const { me } = useCocolight();
  const uploader = me as unknown as UploaderEntity | null;
  const supported = !!uploader?.id && typeof uploader.uploadDocument === "function";

  const upload = useCallback(async (file: File): Promise<string> => {
    const { docPath } = await uploader!.uploadDocument!(file, {
      contentKey: "mdImage",
      docType: "image",
      folder: "comments",
      ownerId: uploader!.id as string,
    });
    if (!docPath) throw new Error("Le serveur n'a pas rendu l'adresse de l'image.");
    return writtenImageAddress(docPath, getBaseUrl());
  }, [uploader]);

  return supported ? upload : undefined;
}
