import type { EntityTypes, Organization, Project, Event, Poi } from "@communecter/cocolight-api-client";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { PROFIL_QUERY_KEYS } from "../constants";
import { useCocolight } from "@/hooks/useCocolight";
import type {
  AddOrganizationFormData,
  AddProjectFormData,
  AddEventFormData,
} from "../schemaForm";
import { useNavigate } from "react-router";
import {
  transformFormDataWithAddress,
  buildParentReference,
  buildOrganizerReference,
} from "./mutationUtils";
import { buildTiersLieuxPayload } from "../utils/tiersLieuxMapping";
import type { TiersLieuxSubmitPayload } from "../components/add/TiersLieuxForm";
import type { PoiEquipementSubmitPayload, PoiEquipementEditPayload } from "../components/add/PoiEquipementForm";
import { useSite } from "@/hooks/useSite";
import { getSlug } from "@/lib/constant/common";

/**
 * Log détaillé d'une erreur de la lib Cocolight. Les échecs de validation backend
 * remontent en `ApiValidationError` (→ `messages: string[]` AJV champ par champ +
 * `details`) ou `ApiResponseError` (→ `responseData`). `console.error(err)` masque
 * ces props custom : on les extrait explicitement, avec le payload envoyé pour
 * comparer aux champs rejetés (ex. `ADD_POI - Request validation failed`).
 */
function logCocolightError(context: string, err: unknown, payload?: unknown) {
  const e = err as {
    name?: string;
    message?: string;
    status?: number;
    messages?: unknown;
    details?: unknown;
    responseData?: unknown;
  };
  console.error(`[${context}] échec lib`, {
    name: e?.name,
    message: e?.message,
    status: e?.status,
    messages: e?.messages, // ApiValidationError → erreurs AJV champ par champ
    details: e?.details,
    responseData: e?.responseData, // ApiResponseError
    payloadSent: payload,
  });
}

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

      // Transformer les données avec l'objet address
      const transformedData = transformFormDataWithAddress(data);

      // Créer l'organisation via le SDK
      const organization = await targetEntity.organization(transformedData);
      await organization.save();

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

      // Transformer les données avec l'objet address
      const transformedData = transformFormDataWithAddress(data);

      // Ajouter le parent si on crée depuis une entité parente
      const parent = buildParentReference(entity);
      const projectData = {
        ...transformedData,
        ...(parent ? { parent } : {}),
      };

      // Créer le projet via le SDK
      const project = await targetEntity.project(projectData);
      await project.save();

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

      // Transformer les données avec l'objet address
      const transformedData = transformFormDataWithAddress(data);

      // Type avec les dates converties en objets Date
      type EventDataWithDates = Omit<typeof transformedData, 'startDate' | 'endDate'> & {
        startDate?: Date;
        endDate?: Date;
        organizer?: ReturnType<typeof buildOrganizerReference>;
      };

      // Construire les données de l'événement avec les dates converties
      const eventData: EventDataWithDates = {
        ...transformedData,
        startDate: transformedData.startDate ? new Date(transformedData.startDate) : undefined,
        endDate: transformedData.endDate ? new Date(transformedData.endDate) : undefined,
      };

      // L'organizer est obligatoire - utiliser l'entité fournie ou l'utilisateur
      if (!eventData.organizer || Object.keys(eventData.organizer).length === 0) {
        const organizer = buildOrganizerReference(entity, me);
        if (organizer) {
          eventData.organizer = organizer;
        }
      }

      // Créer l'événement via le SDK
      const event = await targetEntity.event(eventData);
      await event.save();

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
      const { _imageFile, ...formData } = data;

      // Transformer les données avec l'objet address
      const transformedData = transformFormDataWithAddress(formData);

      // Ajouter le parent si on crée depuis une entité parente. L'image est posée
      // dans le draft (`profil_avatar`) : `save()` la route vers le bloc PROFIL_IMAGE
      // (→ `updateImageProfil`) après création (`Poi.ADD_BLOCKS` : ADD_POI fixe l'id
      // avant le bloc image) — même idiome que l'avatar du header, un seul aller-retour.
      const parent = buildParentReference(entity);
      const poiData = {
        ...transformedData,
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
 * une valeur. `transformFormDataWithAddress` reconstruit l'objet `address`
 * à partir des champs aplatis du formulaire.
 *
 * @param poi - L'entité POI à mettre à jour
 */
export function useUpdatePoi(poi: EntityTypes | null) {
  return useMutationWithToast<{ poi: EntityTypes }, PoiEquipementEditPayload>({
    mutationFn: async (data) => {
      if (!poi) {
        throw new Error("No entity provided");
      }

      const { _imageFile, ...formData } = data;

      // `profil_avatar` est posé dans le draft : le `save()` (→ `_update`) route le
      // champ vers le bloc PROFIL_IMAGE (`updateImageProfil`) en un seul aller-retour,
      // comme l'avatar du header.
      // `buildEditPatch` (côté form) ne renvoie que les champs réellement modifiés :
      // on n'assigne donc que ceux-là (le baseline de diff de l'entité est réconcilié
      // à la revification depuis ≥ 1.0.145 — `fromServerData` → `forceInitialDraftReset`).
      const transformedData = transformFormDataWithAddress(formData);
      Object.assign(poi.data, transformedData, _imageFile ? { profil_avatar: _imageFile } : {});
      try {
        await poi.save();
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
