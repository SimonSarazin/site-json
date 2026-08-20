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
import { COSTUM_QUERY_KEYS } from "@/constants/queryKeys";
import { costumSlugOf } from "@/lib/costumLists";
import { useNavigate } from "react-router";
import { buildParentReference, buildOrganizerReference, logCocolightError } from "./mutationUtils";
import { submitEntityEdit, type EditableEntity } from "./submitEntityEdit";
import { applyPayloadStamps, preparePathValueStamps, estVide } from "../forms/stamps";
import type { SpecStamp } from "../forms/entityModalSpec";

export type EntityKind = "organizations" | "projects" | "events" | "poi" | "citoyens";
type SdkMethod = "organization" | "project" | "event" | "poi";

/** entityType → méthode de création du SDK. (citoyens : pas de create par cette voie.) */
const SDK_METHOD: Record<EntityKind, SdkMethod> = {
  organizations: "organization", projects: "project", events: "event", poi: "poi", citoyens: "organization",
};

type Data = Record<string, unknown>;
/** Instance créée par le SDK : sauvegardable + slug pour la navigation + `updateField` (canal
 *  pathValue des stamps) et `serverData` (fillIfEmpty post-save). Typage structurel volontaire. */
type CreatedEntity = {
  save: () => Promise<unknown>;
  slug?: string;
  updateField?: (path: string, value: unknown) => Promise<unknown>;
  serverData?: Data | null;
};
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
  /**
   * ÉDITION costum : slug du costum qui DÉFINIT le formulaire (`FormDescriptor.costumSlug`) — épinglé
   * sur l'entité avant l'écriture du draft, pour que ses champs costum soient écrivables.
   *
   * Pendant du `costumSlug` de création. La lib ouvre par défaut les champs de la PROVENANCE de
   * l'élément (`source.key`), pas ceux du site : un costum ANNUAIRE liste des lieux importés
   * d'ailleurs (`franceTierslieux`), d'un costum hors registre, ou sans `source` du tout — et
   * chacun de ces cas rejetait l'édition (`[DraftProxy] Le champ "holderOrganization" n'est pas
   * autorisé.`) alors que la CRÉATION passait, elle, par `me.costum(slug)`.
   */
  schemaCostumSlug?: string;
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
  /** Stamps déclaratifs ($scope DÉJÀ résolus par buildSpec) — canal payload appliqué après
   *  buildPayload (add+edit), canal pathValue après le save (entité PROPRE, échec non bloquant). */
  stamps?: SpecStamp[];
  /** create : naviguer vers /profil/{slug} au succès (défaut true). */
  navigateOnSuccess?: boolean;
  successKey: string;
  errorKey: string;
  /** préfixe de log d'erreur (ex. "useAddOrganization · ADD_ORGANIZATION"). */
  errorContext: string;
  invalidateQueries?: QueryKey[];
}

/**
 * Épingle le costum du FORMULAIRE sur l'entité éditée (sens SCHÉMA), pour que ses champs costum
 * soient écrivables sur le draft — symétrique du `me.costum(slug)` de la création.
 *
 * `pinSchema: true` est l'opt-in de la lib : sans lui, `setCostumScope` ne pose que le scope
 * d'ADMINISTRATION et la provenance (`source.key`) continue de gouverner le schéma — comportement
 * voulu pour `ensureCostumScope` (import/export/validation), PAS ici.
 *
 * Échec NON bloquant : un costum hors registre lève (« fournissez costumId/costumType ») ; on laisse
 * alors le save échouer avec l'erreur de champ, plus parlante qu'une erreur d'identité costum.
 */
function pinSchemaCostumScope(target: unknown, slug: string | undefined): void {
  if (!slug || !target || typeof target !== "object") return;
  const holder = target as {
    setCostumScope?: (slug: string, opts?: { costumId?: string; costumType?: string; pinSchema?: boolean }) => void;
  };
  if (typeof holder.setCostumScope !== "function") return;
  try {
    holder.setCostumScope(slug, { pinSchema: true });
  } catch (err) {
    console.warn(`[costum] scope de schéma « ${slug} » non posé (non bloquant)`, err);
  }
}

/**
 * Cœur PUR (sans React) : exécute la mutation et renvoie `{ entity }` (créée ou éditée).
 * CREATE : payload métier + extras + image → `(scope).X(payload).save()`.
 * EDIT   : `submitEntityEdit(target, payload, {imageFile, imageDeleted})` (Object.assign + save + removeImage).
 */
/** Valeur d'un champ widget "gallery" (Option C) — reconnue structurellement (sans coupler le hook au widget). */
interface GalleryFieldValue {
  added?: File[]; removedDocIds?: string[]; contentKey: string; docType?: "image" | "file";
  /** Fichiers déjà présents (seed édition) : {docId, url} — sert à retirer l'entrée `medias[]` d'un fichier supprimé. */
  existing?: Array<{ docId: string; url?: string; name?: string }>;
  /** Matérialise l'upload dans un tableau structuré de l'entité (ex. audio Paroles → `medias:[{type,url}]`). */
  mediaTarget?: { field: string; type: string };
}
function isGalleryFieldValue(v: unknown): v is GalleryFieldValue {
  const g = v as GalleryFieldValue | null;
  return !!g && typeof g === "object" && Array.isArray(g.added) && Array.isArray(g.removedDocIds) && typeof g.contentKey === "string";
}
interface GalleryCapableEntity {
  uploadDocument: (file: File, opts: { contentKey: string; docType?: "image" | "file" }) => Promise<{ docId: string; docPath: string }>;
  deleteFile: (docId: string) => Promise<void>;
  data?: Record<string, unknown>;
  save?: () => Promise<unknown>;
}
/** Clé de correspondance médias↔document : nom de fichier (dernier segment, sans query) — robuste au base URL. */
function mediaKey(url: unknown): string {
  return typeof url === "string" ? (url.split("?")[0].split("/").pop() ?? "") : "";
}
/**
 * Traite les champs GALERIE APRÈS le save (l'entité a désormais un `id`) : supprime les documents retirés
 * puis uploade les nouveaux fichiers via `entity.uploadDocument(file, {contentKey})` (Option C). Best-effort
 * sur les suppressions ; les uploads propagent l'erreur (le save métier a réussi, on veut le signaler).
 *
 * Si un champ porte `mediaTarget`, le `docPath` de chaque upload est MATÉRIALISÉ dans un tableau structuré de
 * l'entité (ex. `medias:[{type:"audio",url:docPath}]`) — ET l'entrée correspondante est RETIRÉE de `medias[]`
 * quand le fichier est supprimé (matché par nom de fichier). Persisté par UN `save()` (poi costum → `element/save`,
 * qui porte le champ `medias` du contrat ADD_POI). Cf. Paroles de parents (audio).
 */
async function processGalleryFields(entity: unknown, values: Data): Promise<void> {
  const ent = entity as Partial<GalleryCapableEntity>;
  if (typeof ent.uploadDocument !== "function") return;
  const mediaAdds: Record<string, Array<{ type: string; url: string }>> = {};
  const mediaRemoveKeys: Record<string, Set<string>> = {};
  for (const key of Object.keys(values)) {
    const v = values[key];
    if (!isGalleryFieldValue(v)) continue;
    for (const docId of v.removedDocIds ?? []) {
      try { await ent.deleteFile?.(docId); } catch { /* best-effort : doc déjà supprimé / droit */ }
      // Retrait de l'entrée `medias[]` du fichier supprimé (via son url dans `existing`, matché par nom).
      if (v.mediaTarget?.field) {
        const ex = (v.existing ?? []).find((e) => e.docId === docId);
        const k = mediaKey(ex?.url);
        if (k) (mediaRemoveKeys[v.mediaTarget.field] ??= new Set()).add(k);
      }
    }
    for (const file of v.added ?? []) {
      const res = await ent.uploadDocument!(file, { contentKey: v.contentKey, docType: v.docType });
      if (v.mediaTarget?.field && res?.docPath) {
        (mediaAdds[v.mediaTarget.field] ??= []).push({ type: v.mediaTarget.type, url: res.docPath });
      }
    }
  }
  // Applique retraits + ajouts sur `medias[]` de l'entité + UN save (si un champ a bougé).
  const fields = new Set([...Object.keys(mediaAdds), ...Object.keys(mediaRemoveKeys)]);
  if (fields.size && ent.data && typeof ent.save === "function") {
    for (const f of fields) {
      const current = Array.isArray(ent.data[f]) ? (ent.data[f] as Array<Record<string, unknown>>) : [];
      const remove = mediaRemoveKeys[f];
      const kept = remove ? current.filter((m) => !(m && typeof m === "object" && remove.has(mediaKey(m.url)))) : current;
      ent.data[f] = [...kept, ...(mediaAdds[f] ?? [])];
    }
    await ent.save();
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

  // Stamps canal PAYLOAD — point commun add+edit, APRÈS le pipeline (un stamp écrase délibérément,
  // même sémantique qu'extraFields) et AVANT le branchement (en édition, soumis au diff de save()).
  const payload = applyPayloadStamps(spec.buildPayload(formData), spec.stamps, {
    mode: spec.mode,
    targetServerData: (spec.target as { serverData?: Data | null } | null)?.serverData ?? null,
  });

  /**
   * Stamps canal PATHVALUE — patron du afterSave legacy : écritures POST-SAVE sur l'entité PROPRE
   * (elle a un id, les droits sont ceux du créateur/éditeur), via `entity.updateField` (voie
   * haut-niveau BaseEntity — jamais endpointApi brut). `fillIfEmpty` est tranché CONTRE l'entité
   * retournée par le save : si le serveur a déjà posé la valeur (hook Node, ex. dateSign), on
   * s'abstient. Échec NON bloquant + warn — la fragilité de la 2e requête legacy est assumée
   * (une org legacy peut exister sans dateSign pour la même raison).
   */
  const runPathValueStamps = async (entity: CreatedEntity | EntityTypes) => {
    const writes = preparePathValueStamps(payload, spec.stamps, { mode: spec.mode });
    if (writes.length === 0) return;
    const e = entity as CreatedEntity;
    for (const w of writes) {
      try {
        if (w.fillIfEmpty) {
          // Lecture pointée dans le serverData post-save (dateSign est racine ; chemins pointés OK).
          const courant = w.field.split(".").reduce<unknown>(
            (acc, k) => (typeof acc === "object" && acc !== null ? (acc as Data)[k] : undefined),
            e.serverData ?? undefined,
          );
          if (!estVide(courant)) continue;
        }
        if (!e.updateField) {
          // Une entité SDK sans `updateField` n'existe pas (BaseEntity le porte pour toutes les
          // sous-classes) : si on arrive ici, c'est un faux SDK de test ou un contrat rompu. Le
          // `continue` muet d'avant faisait DISPARAÎTRE le stamp sans laisser de trace — c'est ainsi
          // que les 13 tests de ce cœur ont pu couvrir la création sans jamais exercer ce canal.
          console.warn(`[stamps] « ${w.field} » ignoré : l'entité créée n'expose pas updateField`);
          continue;
        }
        await e.updateField(w.field, w.value);
      } catch (err) {
        console.warn(`[stamps] échec pathValue « ${w.field} » (non bloquant)`, err);
      }
    }
  };

  // ── ÉDITION ─────────────────────────────────────────────────────────────────
  if (spec.mode === "edit") {
    if (!spec.target) throw new Error("No entity provided");
    pinSchemaCostumScope(spec.target, spec.schemaCostumSlug);
    try {
      await submitEntityEdit(spec.target as unknown as EditableEntity, payload, { imageFile, imageDeleted });
    } catch (err) {
      logCocolightError(spec.errorContext, err, (spec.target as unknown as { data?: Data }).data ?? payload);
      throw err;
    }
    await processGalleryFields(spec.target, values); // galerie : upload/suppression après le save (entité a un id)
    await runPathValueStamps(spec.target); // stamps post-save (jumeau du point création)
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
  await runPathValueStamps(entity); // stamps post-save (le save a réussi, l'entité a un id)
  return { entity: entity as unknown as EntityTypes };
}

/** Hook React : `runEntityMutation` + toasts/invalidation/navigation (useMutationWithToast). */
export function useEntityMutation(spec: EntityMutationSpec) {
  const { me, entity } = useCocolight();
  const navigate = useNavigate();
  const costumSlug = costumSlugOf(entity as { serverData?: Record<string, unknown> } | null);
  return useMutationWithToast<{ entity: EntityTypes }, Data>({
    mutationFn: (values) => runEntityMutation(spec, values, { me: me as MeLike, contextEntity: entity as EntityTypes | null }),
    namespace: "modules/profil",
    successKey: spec.successKey,
    errorKey: spec.errorKey,
    // Les listes DYNAMIQUES du costum sont des `distinct` sur les données : toute écriture d'entité
    // peut en faire naître une valeur, et c'est précisément le point du widget à saisie libre — ce
    // qu'un premier a saisi doit être proposé aux suivants. On invalide par PRÉFIXE (toutes les
    // listes du costum) : le muteur n'a pas les déclarations, il ne sait donc pas quel champ nourrit
    // quelle liste, et refetcher quelques kilooctets coûte moins que de lui faire porter ce savoir.
    // Sans effet sur les listes statiques : elles ne passent par aucune query.
    invalidateQueries: [
      ...(spec.invalidateQueries ?? []),
      ...(costumSlug ? [COSTUM_QUERY_KEYS.LIST_VALUES_PREFIX(costumSlug)] : []),
    ],
    onSuccessCallback: ({ entity }) => {
      if (spec.mode === "add" && (spec.navigateOnSuccess ?? true) && entity?.slug) {
        navigate(`/profil/${entity.slug}`);
      }
    },
  });
}
