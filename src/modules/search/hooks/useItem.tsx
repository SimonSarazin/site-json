import { useMemo } from "react";
import { format } from "date-fns";
import type { Organization, Poi, Project, User, Event as EventType} from "@communecter/cocolight-api-client";
import getDateFnsLocale from "@/dateFns";
import { toValidDate } from "@/helpers/formatDate";

const useItem = (item: User | Organization | Project | Poi | EventType) => {
  /**
   * Fusionne les données provenant du serveur avec des valeurs par défaut.
   * Cet objet est mémoïsé pour éviter les recalculs inutiles.
   */
  const data = useMemo(() => {
    /** Valeurs par défaut */
    const defaults = {
      name: "Nom inconnu",
      type: null as string | null,
      address: {
        streetAddress: "",
        postalCode: "",
        addressLocality: "",
      } as Record<string, string>,
      description: "",
      shortDescription: "",
      tags: [] as string[],
      image: "",
      profilImageUrl: "",
      profilMediumImageUrl: "",
      profilThumbImageUrl: "",
      created: null as Date | null,
      updated: null as Date | null,
      links: {} as Record<string, unknown>,
      collection: null as string | null,
      slug: null as string | null,
      // Champs spécifiques Event
      startDate: null as Date | null,
      endDate: null as Date | null,
      eventDate: null as string | null,
      organizerName: null as string | null,
      // Champs calculés
      addressString: "",
      countProjects: 0,
      countMembers: 0,
      countContributors: 0,
      // Champs contact
      phone: "" as string | undefined,
      email: "" as string | undefined,
    };

    /** Données brutes sécurisées */
    const raw = item?.serverData ?? {};

    /** Priorité : raw -> defaults */
    const merged = { ...defaults, ...raw } as typeof defaults & { [k: string]: unknown };

    // Normalisation des dates
    merged.created = toValidDate(raw.created);
    merged.updated = toValidDate(raw.updated);

    // Normalisation tags : le backend peut renvoyer un objet ({tag: true})
    // ou autre chose qu'un array de strings → on garde uniquement les strings.
    merged.tags = Array.isArray(raw.tags)
      ? raw.tags.filter((t): t is string => typeof t === "string")
      : raw.tags && typeof raw.tags === "object"
        ? Object.keys(raw.tags)
        : [];

    // Composition de l'adresse sous forme de chaîne unique
    const { streetAddress = "", postalCode = "", addressLocality = "" } =
      merged.address ?? {};
    merged.addressString = `${streetAddress} ${postalCode} ${addressLocality}`.trim();

   
    if (!merged.shortDescription && merged.description) {
      // todo: en fonction de la taille faire une version courte
      merged.shortDescription = merged.description;
    }

    if (!merged.description && merged.shortDescription) {
      // todo: en fonction de la taille faire une version courte
      merged.description = merged.shortDescription;
    }

    // Comptages dynamiques
    const countLinks = (section: string) =>
      merged.links?.[section] && typeof merged.links[section] === "object"
        ? Object.keys(merged.links[section]).length
        : 0;

    merged.countProjects = countLinks("projects");
    merged.countMembers = countLinks("members");
    merged.countContributors = countLinks("contributors");

    // Sélection de l'image : on préfère les déclinaisons dérivées (plus légères),
    // et à défaut l'originale.
    //
    // `profilImageUrl` en dernier recours n'est pas décoratif : `searchEventsCostum`
    // ne projette QUE ce champ-là (ni `…Medium…` ni `…Thumb…`), si bien que tout
    // événement était rendu sans image alors qu'il en avait une. Le reste du code
    // (news, cagnotte) retombait déjà sur `profilImageUrl` ; `useItem` était le
    // seul à l'ignorer.
    if (merged.profilMediumImageUrl) {
      merged.image = merged.profilMediumImageUrl;
    } else if (merged.profilThumbImageUrl) {
      merged.image = merged.profilThumbImageUrl;
    } else if (merged.profilImageUrl) {
      merged.image = merged.profilImageUrl;
    }

    // Champs spécifiques Event
    if (raw.startDate) {
      merged.startDate = toValidDate(raw.startDate);
      if (merged.startDate) {
        merged.eventDate = format(merged.startDate, 'P', { locale: getDateFnsLocale() });
      }
    }

    if (raw.endDate) {
      merged.endDate = toValidDate(raw.endDate);
    }

    // Extraire le nom de l'organisateur
    if (raw.organizer && typeof raw.organizer === 'object') {
      const firstOrg = Object.values(raw.organizer)[0] as { name?: string } | undefined;
      merged.organizerName = firstOrg?.name || null;
    }

    return merged;
  }, [item]);

  return data;
};

export default useItem;
