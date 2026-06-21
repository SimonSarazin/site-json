/**
 * Mapping form → payload d'édition de profil, par type d'entité. EXTRAIT VERBATIM du switch de
 * l'ancien EditProfileModal (byte-compat) pour être réutilisé par EditProfileGenericModal et testé
 * isolément. Le résultat est `Object.assign`é sur `entity.data` puis `entity.save()` (useUpdateProfile).
 */
import { DAYS } from "@/constants/DAYS";
import { formatISO } from "date-fns";

type Data = Record<string, unknown>;

export function buildProfileUpdateData(entityType: string, data: Data): Record<string, unknown> {
  const updateData: Record<string, unknown> = {
    name: data.name,
    slug: data.slug,
  };

  // Adresse : émise UNIQUEMENT si pays + ville + localityId présents (sinon "" — abandon silencieux, legacy).
  const buildAddress = (): Record<string, unknown> | "" => {
    if (data.addressCountry && data.addressLocality && data.localityId) {
      const address: Record<string, unknown> = {
        "@type": "PostalAddress",
        addressCountry: data.addressCountry,
        addressLocality: data.addressLocality,
        localityId: data.localityId,
        level1: data.level1 || "",
        level1Name: data.level1Name || "",
        codeInsee: data.codeInsee || "",
      };
      if (data.level2) address.level2 = data.level2;
      if (data.level2Name) address.level2Name = data.level2Name;
      if (data.level3) address.level3 = data.level3;
      if (data.level3Name) address.level3Name = data.level3Name;
      if (data.level4) address.level4 = data.level4;
      if (data.level4Name) address.level4Name = data.level4Name;
      if (data.postalCode) address.postalCode = data.postalCode;
      if (data.streetAddress) address.streetAddress = data.streetAddress;
      return address;
    }
    return "";
  };

  const buildTags = () =>
    Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : "";

  const buildSocial = () => ({
    github: data.github || "",
    gitlab: data.gitlab || "",
    facebook: data.facebook || "",
    twitter: data.twitter || "",
    instagram: data.instagram || "",
    diaspora: data.diaspora || "",
    mastodon: data.mastodon || "",
    telegram: data.telegram || "",
    signal: data.signal || "",
  });

  // 7 entrées par jour (Mo..Su) ; "" pour les jours non renseignés.
  const buildOpeningHours = () => {
    const arr = Array.isArray(data.openingHours) ? data.openingHours : [];
    return DAYS.map((day) => {
      const match = arr.find(
        (o): o is { dayOfWeek: string; hours: { opens: string; closes: string }[] } =>
          typeof o === "object" && o !== null && o.dayOfWeek === day
      );
      return match || "";
    });
  };

  // Référence d'entité (parent/organizer) : ne garde que name + type par entrée.
  const buildEntityReference = (ref: unknown) => {
    if (!ref || typeof ref !== "object") return "";
    const entries = Object.entries(ref as Record<string, unknown>);
    if (entries.length === 0) return "";
    return Object.fromEntries(
      entries.map(([id, ent]) => [
        id,
        { name: (ent as { name?: string }).name, type: (ent as { type?: string }).type },
      ])
    );
  };

  switch (entityType) {
    case "citoyens":
      Object.assign(updateData, {
        shortDescription: data.shortDescription || "",
        description: data.description || "",
        url: data.url || "",
        email: data.email || "",
        mobile: data.mobile || "",
        fixe: data.fixe || "",
        birthDate: data.birthDate || "",
        tags: buildTags(),
        address: buildAddress(),
        ...buildSocial(),
      });
      break;

    case "organizations":
      Object.assign(updateData, {
        shortDescription: data.shortDescription || "",
        description: data.description || "",
        url: data.url || "",
        email: data.email || "",
        tags: buildTags(),
        address: buildAddress(),
        openingHours: buildOpeningHours(),
      });
      Object.assign(updateData, buildSocial());
      if (data.type) updateData.type = data.type;
      break;

    case "projects":
      Object.assign(updateData, {
        shortDescription: data.shortDescription || "",
        description: data.description || "",
        url: data.url || "",
        email: data.email || "",
        tags: buildTags(),
        address: buildAddress(),
      });
      Object.assign(updateData, buildSocial());
      if (data.avancement) updateData.avancement = data.avancement;
      updateData.parent = buildEntityReference(data.parent);
      break;

    case "events":
      Object.assign(updateData, {
        shortDescription: data.shortDescription || "",
        url: data.url || "",
        email: data.email || "",
        recurrency: data.recurrency || false,
        tags: buildTags(),
        address: buildAddress(),
        openingHours: buildOpeningHours(),
      });
      if (data.type) updateData.type = data.type;
      if (typeof data.startDate === "string") {
        updateData.startDate = formatISO(new Date(data.startDate));
      }
      if (typeof data.endDate === "string") {
        updateData.endDate = formatISO(new Date(data.endDate));
      }
      updateData.timeZone = data.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      updateData.parent = buildEntityReference(data.parent);
      updateData.organizer = buildEntityReference(data.organizer);
      break;

    case "poi":
      Object.assign(updateData, {
        // PAS de shortDescription pour POI
        description: data.description || "",
        tags: buildTags(),
        address: buildAddress(),
        // PAS de social pour POI
      });
      if (data.type) updateData.type = data.type;
      break;
  }

  return updateData;
}
