import type { CommentImage } from "../types";

/**
 * Règles pures des images d'un message : ce qu'on accepte, ce qu'on refuse, et comment on lit
 * ce que le backend renvoie.
 *
 * Tout est ici, hors de tout composant, pour une raison précise : le composer sera remplacé par
 * un vrai éditeur (Tiptap ou Lexical, blocage B11). La saisie changera ; ces règles, non.
 */

/**
 * Plafond d'images par message.
 *
 * Ce n'est pas un choix d'ergonomie : `Comment::convertParamsForComments` n'hydrate que les
 * cinq premières et **sort de la boucle** au-delà. En accepter six en afficherait cinq et
 * perdrait la sixième en silence.
 */
export const MAX_IMAGES = 5;

/**
 * Types acceptés — la liste du **SDK**, pas celle du backend.
 *
 * Mesuré : `BaseEntity._validateImage` n'admet que `image/jpeg`, `image/jpg` et `image/png`,
 * là où le backend accepte aussi gif et webp. C'est donc le client qui est le plus étroit, et
 * c'est lui qui refuserait. Autant le dire tout de suite, avec un message clair, plutôt que de
 * laisser partir un envoi voué à échouer.
 */
export const ACCEPTED_IMAGE_TYPES: readonly string[] = ["image/jpeg", "image/jpg", "image/png"];

/**
 * Taille maximale d'une image, alignée sur le `post_max_size` usuel de l'instance PHP.
 * Au-delà, le serveur répond une page d'erreur et non un JSON : mieux vaut refuser ici.
 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Pourquoi un fichier a été écarté — sert à choisir le message affiché. */
export type ImageRejection = "type" | "size" | "count";

/** Le fichier est-il d'un type que le SDK laissera passer ? */
export function isAcceptedImage(file: { type?: string } | null | undefined): boolean {
  const type = typeof file?.type === "string" ? file.type.toLowerCase() : "";
  return ACCEPTED_IMAGE_TYPES.includes(type);
}

/**
 * Extrait les fichiers **image** d'un presse-papiers ou d'un glisser-déposer.
 *
 * Un collage porte presque toujours plusieurs représentations de la même chose (une image ET
 * son `text/html`) : ne garder que les entrées `kind === "file"` de type image évite de coller
 * un `<img src=…>` en texte à côté de la pièce jointe.
 */
export function imageFilesFrom(transfer: DataTransfer | null | undefined): File[] {
  if (!transfer) return [];
  const items = transfer.items;
  if (items && items.length > 0) {
    const out: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file && file.type.startsWith("image/")) out.push(file);
    }
    if (out.length > 0) return out;
  }
  // Repli : certains navigateurs ne peuplent `items` que pour le glisser-déposer.
  return Array.from(transfer.files ?? []).filter(f => f.type.startsWith("image/"));
}

export interface ScreenResult {
  readonly accepted: readonly File[];
  /** Les motifs de refus rencontrés, sans doublon, dans l'ordre où ils se présentent. */
  readonly rejected: readonly ImageRejection[];
}

/**
 * Trie une fournée de fichiers en « acceptés » et « motifs de refus ».
 *
 * `alreadyHeld` compte les images déjà en attente : le plafond porte sur le message, pas sur
 * la fournée. Refuser la fournée entière parce que la dernière image dépasse serait injuste —
 * on prend ce qui rentre et on dit ce qui n'est pas passé.
 */
export function screenImageFiles(files: readonly File[], alreadyHeld = 0): ScreenResult {
  const accepted: File[] = [];
  const rejected: ImageRejection[] = [];
  const note = (motif: ImageRejection) => {
    if (!rejected.includes(motif)) rejected.push(motif);
  };

  for (const file of files) {
    if (!isAcceptedImage(file)) { note("type"); continue; }
    if (file.size > MAX_IMAGE_BYTES) { note("size"); continue; }
    if (alreadyHeld + accepted.length >= MAX_IMAGES) { note("count"); continue; }
    accepted.push(file);
  }

  return { accepted, rejected };
}

/** Lit l'identifiant d'un document, qu'il arrive en `id`, `_id.$id` ou `_id._str`. */
function documentId(raw: Record<string, unknown>): string {
  if (typeof raw.id === "string" && raw.id) return raw.id;
  const underscore = raw._id;
  if (typeof underscore === "string") return underscore;
  if (underscore && typeof underscore === "object") {
    const objet = underscore as Record<string, unknown>;
    for (const clef of ["$id", "_str", "oid"]) {
      const valeur = objet[clef];
      if (typeof valeur === "string" && valeur) return valeur;
    }
  }
  return "";
}

function chemin(raw: Record<string, unknown>, clef: string): string | null {
  const valeur = raw[clef];
  return typeof valeur === "string" && valeur.trim() !== "" ? valeur : null;
}

/**
 * Normalise `mediaImg.images` tel que le backend le rend.
 *
 * Deux formes circulent et il faut les distinguer : après hydratation, chaque entrée est un
 * **document** (`{_id, imagePath, imageThumbPath, name}`) ; avant, c'est une simple chaîne
 * d'identifiant. Une chaîne ne porte aucune URL — l'afficher donnerait une image cassée, on
 * l'ignore donc. C'est le cas d'un message qu'on vient d'écrire et dont on n'a pas encore relu
 * la version serveur ; l'affichage optimiste couvre cet instant avec ses propres aperçus.
 */
export function normalizeImages(raw: unknown): readonly CommentImage[] {
  const liste = (raw as { images?: unknown } | null | undefined)?.images;
  if (!Array.isArray(liste)) return [];

  const out: CommentImage[] = [];
  for (const entree of liste) {
    if (!entree || typeof entree !== "object") continue;
    const doc = entree as Record<string, unknown>;
    const url = chemin(doc, "imagePath");
    const thumbUrl = chemin(doc, "imageThumbPath");
    if (!url && !thumbUrl) continue;
    out.push({
      id: documentId(doc),
      url,
      thumbUrl,
      name: typeof doc.name === "string" ? doc.name : "",
    });
    if (out.length >= MAX_IMAGES) break;
  }
  return out;
}

/**
 * Charge utile d'écriture, ou `null` quand il n'y a rien à joindre.
 *
 * `countImages` part en **entier** alors que le legacy y écrit parfois une chaîne : le schéma
 * accepte les deux, et `convertParamsForComments` le relit par `intval`. On écrit donc la forme
 * la plus juste des deux.
 */
export function toMediaImgPayload(
  docIds: readonly string[],
): { countImages: number; images: string[] } | null {
  const images = docIds.filter(id => typeof id === "string" && id !== "").slice(0, MAX_IMAGES);
  if (images.length === 0) return null;
  return { countImages: images.length, images };
}
