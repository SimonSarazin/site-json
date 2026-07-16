/**
 * `useEntityMutation(spec)` — hook de mutation GÉNÉRIQUE (create + edit) pour TOUTES les entités profil
 * (citoyen/org/projet/event/poi) ET costums (poi-équipement/tiers-lieu). Unifie les ex-hooks bespoke
 * (useAddOrganization/Project/Event/Poi, useUpdatePoi, useAddTiersLieu, useEditTiersLieu, useUpdateProfile)
 * en UN seul, piloté par un `spec` déclaratif. But : supprimer les modales/hook spécifiques par entité.
 *
 * Le cœur `runEntityMutation` est PUR (sans React) → testable avec un faux SDK (parité byte des payloads/
 * méthodes/scope, cf. useEntityMutation.test). Le hook ajoute juste le wiring React (useCocolight/navigate/
 * useMutationWithToast). Les SPÉCIFICITÉS d'entité passent par le spec :
 *  - `buildPayload` : closure (capture le runtime : tags/costum) → le cœur reste générique ;
 *  - `costumSlug` : create scopé costum EXPLICITE (`me.costum(slug).X()`) ; à défaut, tout create hérite du
 *    costum AMBIANT du déploiement (`me.costum(useCocolight().entity)` via `deps.contextEntity`), MÊME sous un
 *    parent (le lien parent est replié dans `payload.parent`) ;
 *  - `imageField` : champ form portant le File image (→ `profil_avatar`, routé bloc PROFIL_IMAGE par save) ;
 *  - `inject` : extras create (role / parent / organizer fallback / email vide / extraFields) ;
 *  - create = `target.X(payload).save()` ; edit = `submitEntityEdit` (Object.assign + save + removeImage).
 */
import type { EntityTypes } from "@communecter/cocolight-api-client";
import type { QueryKey } from "@tanstack/react-query";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { useCocolight } from "@/hooks/useCocolight";
import { useNavigate } from "react-router";
import { buildParentReference, buildOrganizerReference, logCocolightError } from "./mutationUtils";
import { submitEntityEdit, type EditableEntity } from "./submitEntityEdit";

export type EntityKind = "organizations" | "projects" | "events" | "poi" | "citoyens";
type SdkMethod = "organization" | "project" | "event" | "poi";

/** entityType → méthode de création du SDK. (citoyens : pas de create par cette voie.) */
const SDK_METHOD: Record<EntityKind, SdkMethod> = {
  organizations: "organization", projects: "project", events: "event", poi: "poi", citoyens: "organization",
};

type Data = Record<string, unknown>;
/** Instance créée par le SDK : sauvegardable + slug pour la navigation. */
type CreatedEntity = { save: () => Promise<unknown>; slug?: string };
/** Cible SDK de création : `me`, parent, ou scope costum (`me.costum(slug)`). */
type SdkTarget = Record<SdkMethod, (payload: Data) => Promise<CreatedEntity>>;
/** `me` (utilisateur connecté). Le slug costum réel est typé `KnownCostumSlug` côté lib → cast au call. */
type MeLike = EntityTypes | null;

export interface EntityMutationSpec {
  mode: "add" | "edit";
  entityType: EntityKind;
  /** create : entité cible (parent ; défaut = me). edit : l'entité à éditer (draft réactif). */
  target?: EntityTypes | null;
  /** Construit le payload métier depuis les valeurs de form (closure capturant le runtime tags/costum).
   *  Pour les chemins où la modale a DÉJÀ construit le payload (poi-edit, profil-edit) : identité. */
  buildPayload: (formData: Data) => Data;
  /** create costum : `me.costum(slug).X()` au lieu de `(target??me).X()`. */
  costumSlug?: string;
  /** Champ form portant le File image (→ `profil_avatar`). */
  imageField?: string;
  /** Champ form drapeau de suppression d'image (edit). Défaut `_imageDeleted`. */
  imageDeletedField?: string;
  /** Extras de CRÉATION injectés dans le payload (hors descripteur). */
  inject?: {
    /** payload.role = formValues.role si présent (org/projet/event). */
    role?: boolean;
    /** buildParentReference(parent) → payload.parent (projet/event/poi sous-création). */
    parent?: EntityTypes | null;
    /** si payload.organizer vide → buildOrganizerReference(parent, me) (event). */
    organizerFallback?: EntityTypes | null;
    /** supprime payload.email === "" (ADD_ORGANIZATION : email sans branche ""). */
    dropEmptyEmail?: boolean;
    /** valeurs fixes ajoutées au payload (preset costum). */
    extraFields?: Data;
  };
  /** create : naviguer vers /profil/{slug} au succès (défaut true). */
  navigateOnSuccess?: boolean;
  successKey: string;
  errorKey: string;
  /** préfixe de log d'erreur (ex. "useAddOrganization · ADD_ORGANIZATION"). */
  errorContext: string;
  invalidateQueries?: QueryKey[];
}

/**
 * Cœur PUR (sans React) : exécute la mutation et renvoie `{ entity }` (créée ou éditée).
 * CREATE : payload métier + extras + image → `(scope).X(payload).save()`.
 * EDIT   : `submitEntityEdit(target, payload, {imageFile, imageDeleted})` (Object.assign + save + removeImage).
 */
/** Valeur d'un champ widget "gallery" (Option C) — reconnue structurellement (sans coupler le hook au widget). */
interface GalleryFieldValue { added?: File[]; removedDocIds?: string[]; contentKey: string; docType?: "image" | "file" }
function isGalleryFieldValue(v: unknown): v is GalleryFieldValue {
  const g = v as GalleryFieldValue | null;
  return !!g && typeof g === "object" && Array.isArray(g.added) && Array.isArray(g.removedDocIds) && typeof g.contentKey === "string";
}
interface GalleryCapableEntity {
  uploadDocument: (file: File, opts: { contentKey: string; docType?: "image" | "file" }) => Promise<{ docId: string; docPath: string }>;
  deleteFile: (docId: string) => Promise<void>;
}
/**
 * Traite les champs GALERIE APRÈS le save (l'entité a désormais un `id`) : supprime les documents retirés
 * puis uploade les nouveaux fichiers via `entity.uploadDocument(file, {contentKey})` (Option C). Best-effort
 * sur les suppressions ; les uploads propagent l'erreur (le save métier a réussi, on veut le signaler).
 */
async function processGalleryFields(entity: unknown, values: Data): Promise<void> {
  const ent = entity as Partial<GalleryCapableEntity>;
  if (typeof ent.uploadDocument !== "function") return;
  for (const key of Object.keys(values)) {
    const v = values[key];
    if (!isGalleryFieldValue(v)) continue;
    for (const docId of v.removedDocIds ?? []) {
      try { await ent.deleteFile?.(docId); } catch { /* best-effort : doc déjà supprimé / droit */ }
    }
    for (const file of v.added ?? []) {
      await ent.uploadDocument!(file, { contentKey: v.contentKey, docType: v.docType });
    }
  }
}

export async function runEntityMutation(
  spec: EntityMutationSpec,
  values: Data,
  deps: { me: MeLike; contextEntity?: EntityTypes | null },
): Promise<{ entity: EntityTypes }> {
  const { me } = deps;
  const imageFile = spec.imageField ? (values[spec.imageField] as File | null | undefined) ?? undefined : undefined;
  const imageDeleted = Boolean(values[spec.imageDeletedField ?? "_imageDeleted"]);
  // Champs UI image retirés du payload métier (le descripteur les marque renderOnly de toute façon).
  const formData: Data = { ...values };
  if (spec.imageField) delete formData[spec.imageField];
  delete formData[spec.imageDeletedField ?? "_imageDeleted"];
  // Champs GALERIE (widget "gallery") : hors payload `element/save` → uploadés APRÈS via processGalleryFields.
  for (const k of Object.keys(formData)) if (isGalleryFieldValue(formData[k])) delete formData[k];

  const payload = spec.buildPayload(formData);

  // ── ÉDITION ─────────────────────────────────────────────────────────────────
  if (spec.mode === "edit") {
    if (!spec.target) throw new Error("No entity provided");
    try {
      await submitEntityEdit(spec.target as unknown as EditableEntity, payload, { imageFile, imageDeleted });
    } catch (err) {
      logCocolightError(spec.errorContext, err, (spec.target as unknown as { data?: Data }).data ?? payload);
      throw err;
    }
    await processGalleryFields(spec.target, values); // galerie : upload/suppression après le save (entité a un id)
    return { entity: spec.target };
  }

  // ── CRÉATION ──────────────────────────────────────────────────────────────────
  const target = (spec.target ?? me) as EntityTypes | null;
  if (!target) throw new Error("No entity provided");

  if (spec.inject?.role && values.role) payload.role = values.role;
  if (spec.inject?.parent) {
    const parent = buildParentReference(spec.inject.parent);
    if (parent) payload.parent = parent;
  }
  if (spec.inject?.organizerFallback !== undefined) {
    const org = payload.organizer;
    const empty = !org || org === "" || (typeof org === "object" && Object.keys(org as object).length === 0);
    if (empty) {
      const organizer = buildOrganizerReference(spec.inject.organizerFallback, me as EntityTypes | null);
      if (organizer) payload.organizer = organizer;
    }
  }
  if (spec.inject?.dropEmptyEmail && payload.email === "") delete payload.email;
  if (spec.inject?.extraFields) Object.assign(payload, spec.inject.extraFields);
  if (imageFile) payload.profil_avatar = imageFile;

  const method = SDK_METHOD[spec.entityType];
  // Scope de création, par priorité :
  //  (1) costum EXPLICITE de la modale → `me.costum(slug)` (registry + champs costum) ;
  //  (2) costum AMBIANT du déploiement → `me.costum(contextEntity)` (overload ENTITÉ, zéro fetch), appliqué
  //      MÊME sous un parent (legacy : tout contenu créé sous un costum actif est estampillé `source.key`).
  //      ⚠ En basculant la cible vers le costum, `this.parent` devient `me` (id === userId) → l'AUTO-INJECTION
  //      parent/organizer des sous-classes (Poi/Project → `data.parent`, Event → `data.organizer` ; gated
  //      `this.parent.id !== userId && !data.x`) ne se déclenche plus. On la RÉPLIQUE dans le payload depuis
  //      `spec.target`, au MÊME format (`buildParentReference`/`buildOrganizerReference`). Le backend `found`
  //      gate l'estampillage → SANS effet sur un déploiement standard ;
  //  (3) sinon cible directe (parent explicite, ou `me`).
  const costumOf = me as unknown as { costum?: (arg: unknown) => Promise<SdkTarget> } | null;
  let scope: SdkTarget;
  if (spec.costumSlug && costumOf?.costum) {
    scope = await costumOf.costum(spec.costumSlug);
  } else if (deps.contextEntity && costumOf?.costum) {
    scope = await costumOf.costum(deps.contextEntity);
    if (spec.target) { // réplique l'auto-injection parent/organizer perdue (this.parent = me)
      if (spec.entityType === "events") {
        if (!payload.organizer) {
          const org = buildOrganizerReference(spec.target, me as EntityTypes | null);
          if (org) payload.organizer = org;
        }
      } else if (spec.entityType === "projects" || spec.entityType === "poi") {
        if (!payload.parent) {
          const ref = buildParentReference(spec.target);
          if (ref) payload.parent = ref;
        }
      }
    }
  } else {
    scope = target as unknown as SdkTarget;
  }
  const entity = await scope[method](payload);
  try {
    await entity.save();
  } catch (err) {
    logCocolightError(spec.errorContext, err, payload);
    throw err;
  }
  await processGalleryFields(entity, values); // galerie : upload après création (l'entité a désormais un id)
  return { entity: entity as unknown as EntityTypes };
}

/** Hook React : `runEntityMutation` + toasts/invalidation/navigation (useMutationWithToast). */
export function useEntityMutation(spec: EntityMutationSpec) {
  const { me, entity } = useCocolight();
  const navigate = useNavigate();
  return useMutationWithToast<{ entity: EntityTypes }, Data>({
    mutationFn: (values) => runEntityMutation(spec, values, { me: me as MeLike, contextEntity: entity as EntityTypes | null }),
    namespace: "modules/profil",
    successKey: spec.successKey,
    errorKey: spec.errorKey,
    invalidateQueries: spec.invalidateQueries ?? [],
    onSuccessCallback: ({ entity }) => {
      if (spec.mode === "add" && (spec.navigateOnSuccess ?? true) && entity?.slug) {
        navigate(`/profil/${entity.slug}`);
      }
    },
  });
}
