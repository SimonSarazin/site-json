/**
 * Orchestrateur d'ÉDITION d'entité (pattern unifié S6). UN seul chemin pour les 3 hooks d'édition
 * (tiers-lieu / POI / profil) : assigne le payload COMPLET (vides typés "") au draft réactif `entity.data`,
 * pose l'image éventuelle (`profil_avatar`, routée vers le bloc PROFIL_IMAGE par `save()`), puis `save()`.
 *
 * Le SDK `save()` diffe en interne (n'envoie que les champs réellement modifiés vs l'état chargé) et le
 * backend efface les vides ($unset) — d'où l'absence TOTALE de diff/clear côté site (plus de
 * reconcileClearedFields ni buildEditDelta). Prouvé byte-égal 5080↔5099 (costum & standard) par
 * tests/integration/advanced/unified-save-clear.test.ts (lib). cf. doc/refactor-field-treatment.md (S6).
 */

/** Entité éditable (structurel) : draft réactif + save ; suppression d'image optionnelle (POI/org/projet). */
export interface EditableEntity {
  data: Record<string, unknown>;
  save: () => Promise<unknown>;
  removeProfilImage?: () => Promise<unknown>;
}

export interface SubmitEntityEditOptions {
  /** Nouveau fichier image de profil (logo/avatar) — posé dans le draft, uploadé par `save()`. */
  imageFile?: File | null;
  /** Suppression de l'image existante (✕ sans nouveau fichier) — hors champ DATA, fait après `save()`. */
  imageDeleted?: boolean;
}

/**
 * Assigne le payload complet au draft (+ image) et persiste. À utiliser avec un payload produit par
 * `buildEditPayload` (vides typés) — JAMAIS un delta ni un payload omit-empty (sinon les champs vidés
 * ne seraient pas effacés).
 */
export async function submitEntityEdit(
  entity: EditableEntity,
  payload: Record<string, unknown>,
  options: SubmitEntityEditOptions = {},
): Promise<unknown> {
  Object.assign(entity.data, payload, options.imageFile ? { profil_avatar: options.imageFile } : {});
  const result = await entity.save();
  // Suppression de l'image existante : l'image n'est pas un champ DATA → hors `save()`.
  if (options.imageDeleted && !options.imageFile && entity.removeProfilImage) {
    await entity.removeProfilImage();
  }
  return result;
}
