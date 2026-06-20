import type { EntityTypes } from "@communecter/cocolight-api-client";

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
  level1?: string;
  level1Name?: string;
  level2?: string;
  level2Name?: string;
  level3?: string;
  level3Name?: string;
  level4?: string;
  level4Name?: string;
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
] as const;

/**
 * Construit un objet address à partir des champs aplatis du formulaire
 * Retourne undefined si aucune donnée d'adresse n'est présente
 */
export function buildAddressFromForm(data: AddressFormFields) {
  // Vérifier si au moins un champ d'adresse est rempli
  const hasAddressData =
    data.addressCountry ||
    data.addressLocality ||
    data.postalCode ||
    data.streetAddress;

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
 * Extrait les champs d'adresse des données du formulaire et les remplace par l'objet address
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
