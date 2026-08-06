import type { EntityTypes } from "@communecter/cocolight-api-client";
import { normalizeGeoWrite, normalizeGeoPositionWrite } from "../forms/geoTransforms";

/**
 * Champs d'adresse aplatis utilisés dans les formulaires
 */
export interface AddressFormFields {
  addressCountry?: string;
  addressLocality?: string;
  localityId?: string;
  postalCode?: string;
  streetAddress?: string;
  codeInsee?: string;
  // Niveaux SIG 1..5 COMPLETS (parité legacy createLocalityObj/Element::updateField ;
  // contrat SDK ≥ 1.0.173) : level2 = niveau propre à certains pays (Wallonie/BE,
  // provinces/MG), level5 = EPCI. En France level3=région, level4=département.
  level1?: string;
  level1Name?: string;
  level2?: string;
  level2Name?: string;
  level3?: string;
  level3Name?: string;
  level4?: string;
  level4Name?: string;
  level5?: string;
  level5Name?: string;
}

/**
 * Liste des champs d'adresse pour extraction/exclusion
 */
const ADDRESS_FIELDS = [
  "addressCountry",
  "addressLocality",
  "localityId",
  "postalCode",
  "streetAddress",
  "codeInsee",
  "level1",
  "level1Name",
  "level2",
  "level2Name",
  "level3",
  "level3Name",
  "level4",
  "level4Name",
  "level5",
  "level5Name",
] as const;

/**
 * Construit un objet address à partir des champs aplatis du formulaire
 * Retourne undefined si aucune donnée d'adresse n'est présente
 */
export function buildAddressFromForm(
  data: AddressFormFields,
  opts: { gate?: "any" | "countryLocality" } = {},
) {
  // GATE de déclenchement (param unique des 2 ex-builders fusionnés) :
  //  - "any" (défaut : poi standard + costums) : un seul champ d'adresse suffit ;
  //  - "countryLocality" (profil org/project/event/citoyen) : pays ET ville requis (gate historique plus strict).
  const hasAddressData = opts.gate === "countryLocality"
    ? Boolean(data.addressCountry && data.addressLocality)
    : Boolean(data.addressCountry || data.addressLocality || data.postalCode || data.streetAddress);

  if (!hasAddressData) {
    return undefined;
  }

  // Un `localityId` (id de ville réel, sélectionné via l'autocomplete SIG) est OBLIGATOIRE : sans lui,
  // le backend rejette l'address (`addressValid` → "CityId missing in the address !" / "Invalid object ID"),
  // et comme la validation du save est ATOMIQUE, TOUTE la sauvegarde échoue (perte des autres champs édités).
  // On n'envoie donc pas d'adresse partielle tant qu'une ville n'a pas été réellement sélectionnée.
  // (Aligne le comportement sur EditProfileModal qui garde déjà `&& data.localityId`.)
  if (!data.localityId) {
    return undefined;
  }

  // Construire l'objet avec uniquement les champs non vides
  const addressEntries = ADDRESS_FIELDS.map((field) => [
    field,
    data[field] || undefined,
  ]).filter(([, value]) => value !== undefined);

  return {
    "@type": "PostalAddress" as const,
    addressCountry: data.addressCountry || "",
    addressLocality: data.addressLocality || "",
    localityId: data.localityId || "",
    codeInsee: data.codeInsee || "",
    level1: data.level1 || "",
    level1Name: data.level1Name || "",
    ...Object.fromEntries(addressEntries),
  };
}

/**
 * Extrait les champs d'adresse PLATS du formulaire (CRÉATION) et les remplace par l'objet `address`
 * imbriqué. Normalise AUSSI geo/geoPosition (posés par EditLocationTab AVEC l'adresse) : lat/lng coercés
 * en STRING (geoValid), coords en number (geoPositionValid), liés à `localityId` — uniforme avec l'édition
 * (cf. forms/geoTransforms). geo non lié à une adresse (pas de localityId) → omis au create.
 * ⚠ À n'utiliser que sur des données à champs PLATS (création) ; l'édition passe par les descripteurs.
 */
export function transformFormDataWithAddress<T extends Record<string, unknown>>(
  data: T
): Omit<T, (typeof ADDRESS_FIELDS)[number]> & {
  address?: ReturnType<typeof buildAddressFromForm>;
} {
  // Extraire les champs d'adresse
  const addressData: AddressFormFields = {};
  const rest: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (ADDRESS_FIELDS.includes(key as (typeof ADDRESS_FIELDS)[number])) {
      addressData[key as keyof AddressFormFields] = value as string | undefined;
    } else {
      rest[key] = value;
    }
  }

  const address = buildAddressFromForm(addressData);

  // geo/geoPosition : coercition uniforme (string lat/lng, coords number) liée à localityId. Au CREATE on
  // n'émet le geo que s'il accompagne une adresse valide (objet) ; sinon on l'omet (pas de "" inutile).
  const geo = normalizeGeoWrite(data);
  const geoPosition = normalizeGeoPositionWrite(data);
  if (geo && typeof geo === "object") rest.geo = geo; else delete rest.geo;
  if (geoPosition && typeof geoPosition === "object") rest.geoPosition = geoPosition; else delete rest.geoPosition;

  return {
    ...rest,
    ...(address ? { address } : {}),
  } as Omit<T, (typeof ADDRESS_FIELDS)[number]> & {
    address?: ReturnType<typeof buildAddressFromForm>;
  };
}

/**
 * Type pour les références parent/organizer
 */
export interface EntityReference {
  [id: string]: {
    type: string;
    name?: string;
  };
}

/**
 * Construit une référence parent à partir d'une entité
 * Utilisé pour lier un projet/event/poi à son parent
 */
export function buildParentReference(
  entity: EntityTypes | null | undefined
): EntityReference | undefined {
  if (!entity?.id) {
    return undefined;
  }

  return {
    [entity.id]: {
      type: entity.getEntityType?.() || "organizations",
      name: entity.serverData?.name,
    },
  };
}

/**
 * Construit une référence organizer à partir d'une entité
 * Utilisé pour définir l'organisateur d'un événement
 */
export function buildOrganizerReference(
  entity: EntityTypes | null | undefined,
  me: EntityTypes | null | undefined
): EntityReference | undefined {
  if (entity?.id) {
    return {
      [entity.id]: {
        type: entity.getEntityType?.() || "organizations",
        name: entity.serverData?.name,
      },
    };
  }

  if (me?.id) {
    return {
      [me.id]: {
        type: "citoyens",
        name: me.serverData?.name,
      },
    };
  }

  return undefined;
}

/**
 * Log détaillé d'une erreur de la lib Cocolight. Les échecs de validation backend remontent en
 * `ApiValidationError` (→ `messages: string[]` AJV champ par champ + `details`) ou `ApiResponseError`
 * (→ `responseData`). `console.error(err)` masque ces props custom : on les extrait explicitement, avec
 * le payload envoyé pour comparer aux champs rejetés (ex. `ADD_ORGANIZATION - Request validation failed`,
 * `UPDATE_BLOCK_INFO - parent must be an object`). Partagé par tous les hooks de mutation (add/edit).
 */
export function logCocolightError(context: string, err: unknown, payload?: unknown) {
  const e = err as {
    name?: string; message?: string; status?: number;
    messages?: unknown; details?: unknown; responseData?: unknown;
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
