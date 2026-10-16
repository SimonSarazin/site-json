import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import {
  MAX_IMAGES,
  screenImageFiles,
  type ImageRejection,
} from "../lib/commentImages";
import type { CommentImage } from "../types";

/** Une image en cours de préparation, avant que le message ne parte. */
export interface PendingImage {
  readonly localId: string;
  readonly name: string;
  /** Aperçu local (`blob:`), jamais transmis au serveur. `null` si le navigateur ne sait pas en faire. */
  readonly previewUrl: string | null;
  readonly status: "uploading" | "ready" | "error";
  /** L'identifiant du document créé, seul élément qui parte réellement dans le message. */
  readonly docId: string | null;
}

/** Ce dont le hook a besoin d'une entité : téléverser. */
interface UploaderEntity {
  id?: string | null;
  uploadDocument?: (
    file: File,
    opts: { contentKey: string; docType?: "image" | "file"; folder?: string; ownerId?: string },
  ) => Promise<{ docId: string; docPath: string }>;
}

let sequence = 0;
function nextLocalId(): string {
  sequence += 1;
  return `img-${sequence}`;
}

/** `URL.createObjectURL` manque à jsdom — et un appel direct emporterait tout le composant. */
function makePreview(file: File): string | null {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return null;
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

/** Une image DÉJÀ téléversée, remise dans la liste : prête d'emblée, son document existe. */
function remise(image: CommentImage): PendingImage {
  return { localId: nextLocalId(), name: image.name, previewUrl: image.url, status: "ready", docId: image.id };
}

function revoke(url: string | null): void {
  if (!url) return;
  if (typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Une URL déjà révoquée n'est pas une erreur à remonter.
  }
}

export interface UseCommentImagesResult {
  readonly items: readonly PendingImage[];
  /** Ajoute une fournée ; ce qui ne passe pas alimente `rejected`. */
  readonly add: (files: readonly File[]) => void;
  readonly remove: (localId: string) => void;
  readonly reset: () => void;
  /** Remet des images DÉJÀ téléversées — celles d'un envoi refusé. */
  readonly restore: (images: readonly CommentImage[]) => void;
  /** Motifs du dernier refus, à afficher tels quels puis oubliés au prochain ajout. */
  readonly rejected: readonly ImageRejection[];
  /** Un téléversement au moins est en cours : l'envoi doit attendre. */
  readonly busy: boolean;
  readonly full: boolean;
  /** Les identifiants prêts à être joints au message. */
  readonly docIds: readonly string[];
  /** Ces mêmes images, sous la forme d'affichage, pour le message optimiste. */
  readonly optimisticImages: readonly CommentImage[];
  /** `false` quand rien ne peut téléverser (visiteur non connecté, SDK sans la méthode). */
  readonly supported: boolean;
}

/**
 * Téléversement des images d'un message.
 *
 * **Hors du composer, et c'est délibéré** : celui-ci sera remplacé par un vrai éditeur (Tiptap
 * ou Lexical, blocage B11), alors que cette mécanique-là ne changera pas. Le composer ne reçoit
 * que des aperçus à afficher et deux rappels ; il ne sait rien du téléversement.
 *
 * **L'ordre d'écriture est imposé par le backend**, et il surprend : on téléverse AVANT de
 * poster, alors que le dossier de destination porte l'identifiant du message. Les documents
 * sont donc d'abord orphelins, rangés sous l'utilisateur courant, puis `Comment::insert`
 * appelle `updateDocumentsData` → `Document::moveDoc`, qui déplace le fichier ET met à jour son
 * enregistrement. C'est ce qu'a toujours fait le legacy — la base porte ses documents orphelins.
 *
 * Le téléversement démarre dès l'ajout, pas à l'envoi : au moment de poster, les identifiants
 * sont déjà là et le message part sans attente perceptible.
 */
export function useCommentImages(
  /**
   * Les images d'un brouillon gardé pendant que le fil était fermé (`CommentThread`) : leurs
   * aperçus sont morts avec le fil, seuls leurs documents reviennent — rien que ce hook ait à révoquer.
   */
  initial?: readonly CommentImage[],
): UseCommentImagesResult {
  const { me } = useCocolight();
  const [items, setItems] = useState<readonly PendingImage[]>(() => (initial ?? []).map(remise));
  const [rejected, setRejected] = useState<readonly ImageRejection[]>([]);

  // Les aperçus à révoquer au démontage. Un `Map` plutôt que l'état : le nettoyage doit voir la
  // dernière valeur connue, pas celle capturée à la création de l'effet.
  const previews = useRef(new Map<string, string>());

  const uploader = me as unknown as UploaderEntity | null;
  const supported = !!uploader?.id && typeof uploader.uploadDocument === "function";

  useEffect(() => {
    const encours = previews.current;
    return () => {
      for (const url of encours.values()) revoke(url);
      encours.clear();
    };
  }, []);

  const add = useCallback((files: readonly File[]) => {
    if (!supported || files.length === 0) return;

    // Le tri et les téléversements se font ICI, jamais dans l'updater de `setItems` : React
    // peut rejouer un updater (mode strict, rendu concurrent), ce qui téléverserait deux fois
    // la même image. Un updater doit rester une fonction pure de l'état précédent.
    const { accepted, rejected: motifs } = screenImageFiles(files, items.length);
    setRejected(motifs);
    if (accepted.length === 0) return;

    const nouveaux = accepted.map<PendingImage>(file => {
      const localId = nextLocalId();
      const previewUrl = makePreview(file);
      if (previewUrl) previews.current.set(localId, previewUrl);

      // `setItems` n'est appelé qu'à l'arrivée de la réponse, sur la forme fonctionnelle :
      // l'image peut avoir été retirée entre-temps, auquel cas la mise à jour ne trouve rien.
      void uploader!.uploadDocument!(file, {
        contentKey: "slider",
        docType: "image",
        // `folder` fixe le `type` du document en base — c'est lui qui en fait un document de
        // commentaire. `ownerId` n'est qu'un point de chute provisoire : `moveDoc` le réécrit.
        folder: "comments",
        ownerId: uploader!.id as string,
      })
        .then(({ docId }) => {
          setItems(liste => liste.map(item => item.localId === localId
            ? { ...item, status: docId ? "ready" : "error", docId: docId || null }
            : item));
        })
        .catch(() => {
          setItems(liste => liste.map(item => item.localId === localId
            ? { ...item, status: "error", docId: null }
            : item));
        });

      return { localId, name: file.name ?? "", previewUrl, status: "uploading", docId: null };
    });

    setItems(courant => [...courant, ...nouveaux]);
  }, [supported, uploader, items.length]);

  const remove = useCallback((localId: string) => {
    revoke(previews.current.get(localId) ?? null);
    previews.current.delete(localId);
    setItems(liste => liste.filter(item => item.localId !== localId));
    // Retirer une image libère de la place : le refus « trop d'images » n'a plus lieu d'être.
    setRejected(motifs => (motifs.includes("count") ? motifs.filter(m => m !== "count") : motifs));
  }, []);

  /**
   * Vide la liste après l'envoi — **sans révoquer les aperçus**.
   *
   * C'est délibéré : le message optimiste affiché pendant l'envoi pointe sur ces mêmes URL
   * `blob:`, et les révoquer ici ferait disparaître les images à l'instant précis où le message
   * apparaît, pour ne les voir revenir qu'à la relecture du fil. Les URL restent donc dans
   * `previews` et sont libérées au démontage ; `remove`, lui, révoque sur-le-champ, puisque
   * l'image retirée n'est affichée nulle part ailleurs.
   */
  const reset = useCallback(() => {
    setItems([]);
    setRejected([]);
  }, []);

  /**
   * Remet les images d'un envoi REFUSÉ (revue du 16/10) : le brouillon revenait sans elles, et
   * leurs documents, déjà téléversés, restaient orphelins au serveur. Prêtes d'emblée — leur
   * document existe, il repartira tel quel. L'aperçu est celui que l'envoi affichait (`reset` ne
   * l'a pas révoqué) ; `null` pour un brouillon gardé pendant que le fil était fermé.
   */
  const restore = useCallback((images: readonly CommentImage[]) => {
    if (images.length === 0) return;
    // Les identifiants locaux se tirent ICI, hors de l'updater (cf. `add`).
    const remises = images.map(remise);
    for (const item of remises) if (item.previewUrl) previews.current.set(item.localId, item.previewUrl);
    setItems(courant => {
      const deja = new Set(courant.map(item => item.docId));
      return [...courant, ...remises.filter(item => !deja.has(item.docId))].slice(0, MAX_IMAGES);
    });
    setRejected([]);
  }, []);

  const prets = useMemo(
    () => items.filter(item => item.status === "ready" && item.docId),
    [items],
  );

  const docIds = useMemo(() => prets.map(item => item.docId as string), [prets]);

  /**
   * Les images telles que le message optimiste doit les montrer : les aperçus locaux, sous la
   * forme que rend le serveur. Le fil affiche donc les mêmes images avant et après l'envoi.
   */
  const optimisticImages = useMemo<readonly CommentImage[]>(
    () => prets.map(item => ({
      id: item.docId as string,
      url: item.previewUrl,
      thumbUrl: item.previewUrl,
      name: item.name,
    })),
    [prets],
  );

  return {
    items,
    add,
    remove,
    reset,
    restore,
    rejected,
    busy: items.some(item => item.status === "uploading"),
    full: items.length >= MAX_IMAGES,
    docIds,
    optimisticImages,
    supported,
  };
}
