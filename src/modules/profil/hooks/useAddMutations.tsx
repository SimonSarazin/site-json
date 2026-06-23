import type { EntityTypes, Organization, Project, Event, Poi } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { PROFIL_QUERY_KEYS } from "../constants";
import { useCocolight } from "@/hooks/useCocolight";
import type {
  AddOrganizationFormData,
  AddProjectFormData,
  AddEventFormData,
  AddPoiFormData,
} from "../schemaForm";
import { useNavigate } from "react-router";
import {
  buildParentReference,
  buildOrganizerReference,
  logCocolightError,
} from "./mutationUtils";
import { buildTiersLieuxPayload } from "../utils/tiersLieuxMapping";
import { buildProfileUpdateData } from "../forms/editProfilePayload";
import type { TiersLieuxSubmitPayload } from "../components/add/TiersLieuxForm";
import type { PoiEquipementSubmitPayload, PoiEquipementEditPayload } from "../components/add/poiEquipement";
import { buildAddPoiPayload } from "../components/add/poiEquipement";
import { submitEntityEdit } from "./submitEntityEdit";
import { useSite } from "@/hooks/useSite";
import { getSlug } from "@/lib/constant/common";

/**
 * Hook pour créer une nouvelle organisation
 *
 * @param entity - L'entité depuis laquelle créer (utilisateur connecté par défaut)
 *
 * @example
 * const { mutate, isPending } = useAddOrganization();
 * mutate({ name: "Mon orga", type: "NGO", role: "admin" });
 */
export function useAddOrganization(entity?: EntityTypes | null) {
  const { me } = useCocolight();
  const navigate = useNavigate();

  // Utiliser l'entité fournie ou me par défaut
  const targetEntity = entity || me;

  return useMutationWithToast<{ organization: Organization }, AddOrganizationFormData>({
    mutationFn: async (data) => {
      if (!targetEntity) {
        throw new Error("No entity provided");
      }

      // Payload via le PIPELINE unifié (buildProfileUpdateData = descripteur read+write : adresse imbriquée,
      // geo coercé, social plat, transforms édition). `role` (create-only, hors descripteur) ré-injecté.
      // Prouvé byte-égal au chemin transformFormDataWithAddress (create-pipeline-parity.test, 5080↔5099).
      const payload = buildProfileUpdateData("organizations", data as Record<string, unknown>);
      const role = (data as Record<string, unknown>).role;
      if (role) payload.role = role;
      // ADD_ORGANIZATION.email = `format:email` SANS branche "" (≠ events/projects/blocs d'édition qui la
      // tolèrent) → un email vide doit être OMIS à la création (sémantique create : champ optionnel vide = absent).
      if (payload.email === "") delete payload.email;

      // Créer l'organisation via le SDK
      const organization = await targetEntity.organization(payload);
      try {
        await organization.save();
      } catch (err) {
        logCocolightError("useAddOrganization · ADD_ORGANIZATION", err, payload);
        throw err;
      }

      return { organization };
    },
    namespace: "modules/profil",
    successKey: "toast.add.organizationSuccess",
    errorKey: "toast.add.organizationError",
    invalidateQueries: targetEntity ? [PROFIL_QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(targetEntity.slug)] : [],
    onSuccessCallback: (data) => {
      // Rediriger vers le profil de la nouvelle organisation
      if (data.organization.slug) {
        navigate(`/profil/${data.organization.slug}`);
      }
    },
  });
}

/**
 * Hook pour créer un nouveau projet
 *
 * @param entity - L'entité depuis laquelle créer (organization, user)
 *
 * @example
 * const { mutate, isPending } = useAddProject(organization);
 * mutate({ name: "Mon projet" });
 */
export function useAddProject(entity?: EntityTypes | null) {
  const { me } = useCocolight();
  const navigate = useNavigate();

  // Utiliser l'entité fournie ou me par défaut
  const targetEntity = entity || me;

  return useMutationWithToast<{ project: Project }, AddProjectFormData>({
    mutationFn: async (data) => {
      if (!targetEntity) {
        throw new Error("No entity provided");
      }

      // Payload via le PIPELINE unifié (buildProfileUpdateData). `role` ré-injecté ; `parent` de sous-création
      // (depuis l'entité créatrice) override celui du form. Byte-égal au brut (create-pipeline-parity).
      const payload = buildProfileUpdateData("projects", data as Record<string, unknown>);
      const role = (data as Record<string, unknown>).role;
      if (role) payload.role = role;
      const parent = buildParentReference(entity);
      if (parent) payload.parent = parent;

      // Créer le projet via le SDK
      const project = await targetEntity.project(payload);
      try {
        await project.save();
      } catch (err) {
        logCocolightError("useAddProject · ADD_PROJECT", err, payload);
        throw err;
      }

      return { project };
    },
    namespace: "modules/profil",
    successKey: "toast.add.projectSuccess",
    errorKey: "toast.add.projectError",
    invalidateQueries: [
      ...(targetEntity ? [PROFIL_QUERY_KEYS.USER_PROJECTS_PREFIX(targetEntity.slug)] : []),
      ...(entity ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : []),
    ],
    onSuccessCallback: (data) => {
      // Rediriger vers le profil du nouveau projet
      if (data.project.slug) {
        navigate(`/profil/${data.project.slug}`);
      }
    },
  });
}

/**
 * Hook pour créer un nouvel événement
 *
 * @param entity - L'entité depuis laquelle créer (organization, project, user)
 *
 * @example
 * const { mutate, isPending } = useAddEvent(organization);
 * mutate({ name: "Mon événement", type: "meeting", startDate: "...", endDate: "..." });
 */
export function useAddEvent(entity?: EntityTypes | null) {
  const { me } = useCocolight();
  const navigate = useNavigate();

  // Utiliser l'entité fournie ou me par défaut
  const targetEntity = entity || me;

  return useMutationWithToast<{ event: Event }, AddEventFormData>({
    mutationFn: async (data) => {
      if (!targetEntity) {
        throw new Error("No entity provided");
      }

      // Payload via le PIPELINE unifié (buildProfileUpdateData : dates ISO via pf:isoDate, organizer/parent
      // via pf:entityRef, recurrency/timeZone, adresse imbriquée, geo coercé). `role` ré-injecté.
      const payload = buildProfileUpdateData("events", data as Record<string, unknown>);
      const role = (data as Record<string, unknown>).role;
      if (role) payload.role = role;
      const parent = buildParentReference(entity);
      if (parent) payload.parent = parent;

      // L'organizer est obligatoire — fallback sur l'entité créatrice / l'utilisateur si le form n'en fournit pas.
      const org = payload.organizer;
      const organizerEmpty = !org || org === "" || (typeof org === "object" && Object.keys(org).length === 0);
      if (organizerEmpty) {
        const organizer = buildOrganizerReference(entity, me);
        if (organizer) payload.organizer = organizer;
      }

      // Créer l'événement via le SDK
      const event = await targetEntity.event(payload as Parameters<typeof targetEntity.event>[0]);
      try {
        await event.save();
      } catch (err) {
        logCocolightError("useAddEvent · ADD_EVENT", err, payload);
        throw err;
      }

      return { event };
    },
    namespace: "modules/profil",
    successKey: "toast.add.eventSuccess",
    errorKey: "toast.add.eventError",
    invalidateQueries: [
      ...(targetEntity ? [PROFIL_QUERY_KEYS.USER_EVENTS_PREFIX(targetEntity.slug)] : []),
      ...(entity ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : []),
    ],
    onSuccessCallback: (data) => {
      // Rediriger vers le profil du nouvel événement
      if (data.event.slug) {
        navigate(`/profil/${data.event.slug}`);
      }
    },
  });
}

/**
 * Hook pour créer un nouveau POI (Point d'Intérêt)
 *
 * @param entity - L'entité depuis laquelle créer (organization, project, event)
 *
 * @example
 * const { mutate, isPending } = useAddPoi(organization);
 * mutate({ name: "Mon POI", type: "place" });
 */
export function useAddPoi(
  entity?: EntityTypes | null,
  // Champs supplémentaires injectés dans le payload de création.
  extraFields?: Record<string, unknown>,
  // `navigateOnSuccess: false` → rester sur la page courante au lieu de rediriger
  // vers `/profil/{slug}` (ex. ajout depuis la liste des équipements).
  // `costumSlug` (OPT-IN) → crée le POI sous un scope costum via `me.costum(slug).poi()` :
  // la lib injecte costumSlug/costumId/costumType (+ presets) et le backend pose `source`.
  // ABSENT → création POI STANDARD inchangée (`targetEntity.poi`).
  options?: { navigateOnSuccess?: boolean; costumSlug?: string }
) {
  const { me } = useCocolight();
  const navigate = useNavigate();
  const navigateOnSuccess = options?.navigateOnSuccess ?? true;

  // Utiliser l'entité fournie ou me par défaut
  const targetEntity = entity || me;

  return useMutationWithToast<{ poi: Poi }, PoiEquipementSubmitPayload>({
    mutationFn: async (data) => {
      if (!targetEntity) {
        throw new Error("No entity provided");
      }

      // `_imageFile` n'est pas un champ du document : on l'extrait avant de
      // transformer/envoyer les données au SDK (cf. `_logoFile` côté tiers-lieux).
      // `_imageDeleted` est un drapeau UI d'édition (suppression d'image) → sans objet à la création :
      // on l'exclut du payload (sinon le DraftProxy costum le rejetterait comme champ inconnu).
      const { _imageFile, _imageDeleted: _ignoredImageDeleted, ...formData } = data;

      // Payload via le PIPELINE (buildAddPoiPayload = même descripteur que l'édition : adresse imbriquée,
      // geo coercé, champs équipement typés). L'image est posée dans le draft (`profil_avatar`) : `save()`
      // la route vers le bloc PROFIL_IMAGE après création. parent (sous-création) + extraFields costum ajoutés.
      const parent = buildParentReference(entity);
      const poiData = {
        ...buildAddPoiPayload(formData as unknown as AddPoiFormData),
        ...(parent ? { parent } : {}),
        ...(extraFields ?? {}),
        ...(_imageFile ? { profil_avatar: _imageFile } : {}),
      };

      // Créer le POI via le SDK. Si un costum est ciblé (opt-in), on passe par le CostumScope de la
      // lib (`me.costum(slug).poi`) : contexte costum (costumSlug/costumId/costumType + presets) injecté
      // par la lib, `source` posé par le backend. Sinon, création POI STANDARD inchangée.
      const poi =
        options?.costumSlug && me
          ? ((await (
              await me.costum(options.costumSlug as Parameters<typeof me.costum>[0])
            ).poi(poiData)) as Poi)
          : await targetEntity.poi(poiData);
      try {
        await poi.save();
      } catch (err) {
        logCocolightError("useAddPoi · ADD_POI", err, poiData);
        throw err;
      }

      return { poi };
    },
    namespace: "modules/profil",
    successKey: "toast.add.poiSuccess",
    errorKey: "toast.add.poiError",
    invalidateQueries: [
      ...(targetEntity ? [PROFIL_QUERY_KEYS.USER_POIS_PREFIX(targetEntity.slug)] : []),
      ...(entity ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug)] : []),
    ],
    onSuccessCallback: (data) => {
      // Rediriger vers le profil du nouveau POI (sauf si on veut rester sur place).
      if (navigateOnSuccess && data.poi.slug) {
        navigate(`/profil/${data.poi.slug}`);
      }
    },
  });
}

/**
 * Hook pour éditer un POI existant.
 *
 * Suit le pattern canonique d'édition du projet (cf. `useUpdateProfile`) :
 * on mute le draft réactif `poi.data` puis on appelle **un seul** `save()`
 * (atomique, un aller-retour). Contrairement à une boucle `updateField`,
 * assigner `""`/`[]` efface réellement le champ — l'édition peut donc vider
 * une valeur. Le `data` reçu est le payload COMPLET produit par `buildEditPoiPayload` (pattern unifié S6) :
 * adresse DÉJÀ imbriquée → `transformFormDataWithAddress` est un no-op (conservé par robustesse). Le SDK
 * `save()` diffe en interne (n'envoie que le réellement modifié) ; le backend efface les vides ($unset).
 *
 * @param poi - L'entité POI à mettre à jour
 */
export function useUpdatePoi(poi: EntityTypes | null) {
  return useMutationWithToast<{ poi: EntityTypes }, PoiEquipementEditPayload>({
    mutationFn: async (data) => {
      if (!poi) {
        throw new Error("No entity provided");
      }

      const { _imageFile, _imageDeleted, ...formData } = data;

      // `data` = payload COMPLET de `buildEditPoiPayload` : adresse DÉJÀ imbriquée + geo coercé (geo:write).
      // On l'assigne tel quel (PAS de transformFormDataWithAddress : réservé au CREATE, à champs PLATS).
      // Orchestrateur unifié : Object.assign(draft) + image + save() + suppression image. Le SDK diffe, backend $unset.
      try {
        await submitEntityEdit(poi as unknown as Parameters<typeof submitEntityEdit>[0], formData as Record<string, unknown>, {
          imageFile: _imageFile, imageDeleted: _imageDeleted,
        });
      } catch (err) {
        logCocolightError("useUpdatePoi · UPDATE_POI", err, poi.data);
        throw err;
      }

      return { poi };
    },
    namespace: "modules/profil",
    successKey: "toast.profile.updateSuccess",
    errorKey: "toast.profile.updateError",
    invalidateQueries: poi ? [PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(poi.slug)] : [],
  });
}

export type AddTiersLieuFormData = TiersLieuxSubmitPayload;

export function useAddTiersLieu(entity?: EntityTypes | null) {
  // `entity` (param) = parent éventuel ; `costumEntity` (useCocolight) = entité PORTEUSE du costum
  // (résolue depuis VITE_SLUG, constante pour le déploiement) → c'est son slug qui cible le costum.
  const { me, entity: costumEntity } = useCocolight();
  const navigate = useNavigate();
  const { config } = useSite();
  const targetEntity = entity || me;
  const costum = config.costum;

  return useMutationWithToast<{ organization: Organization }, AddTiersLieuFormData>({
    mutationFn: async (data) => {
      if (!me) {
        throw new Error("User not connected");
      }
      // Slug du costum = slug de l'entité porteuse (= VITE_SLUG) ; fallback getSlug(). Plus besoin de
      // config.costum.slug (redondant). config.costum ne sert plus qu'aux tags (mainTag/compagnon).
      const carrierSlug = costumEntity?.serverData?.slug;
      const slug = typeof carrierSlug === "string" && carrierSlug.trim() ? carrierSlug.trim() : getSlug();

      const payload = buildTiersLieuxPayload(data, costum ? { costum } : undefined);
      // Logo posé dans le payload : `save()` le route vers le bloc PROFIL_IMAGE
      // (`updateImageProfil`) après création — même idiome que l'avatar du header.
      if (data._logoFile) {
        payload.profil_avatar = data._logoFile;
      }

      // Scope costum géré par la lib : `me.costum(slug)` ouvre le CostumScope (injecte
      // costumSlug/costumId/costumType depuis le registry + presets) ; `.organization(payload)`
      // crée l'instance scopée et `.save()` persiste (le backend pose `source`). Plus de
      // bricolage manuel du contexte costum (source/costumSlug/costumId/costumType) côté site-json.
      const scope = await me.costum(slug as Parameters<typeof me.costum>[0]);
      const organization = await scope.organization(payload);
      await organization.save();

      return { organization };
    },
    namespace: "modules/profil",
    successKey: "AddTiersLieux.toast.success",
    errorKey: "AddTiersLieux.toast.error",
    invalidateQueries: targetEntity ? [PROFIL_QUERY_KEYS.USER_ORGANIZATIONS_PREFIX(targetEntity.slug)] : [],
    onSuccessCallback: (data) => {
      if (data.organization.slug) {
        navigate(`/profil/${data.organization.slug}`);
      }
    },
  });
}
