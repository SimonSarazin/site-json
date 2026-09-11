import { groupSchedules, type DaySchedule } from "./schedules";
import { resolveAdminAccessLevel } from "@/modules/admin/lib/adminEntry";

/**
 * Lecture/normalisation d'une réponse CoForm « activité » — factorisé depuis
 * `CardAnswer` (carte) et `PreviewCoformAnswer` (détail), qui dupliquaient les
 * types, le statut, les IDs de champs et l'extraction.
 *
 * Découplage (niveau 2) : le mapping rôle→champ est `DEFAULT_COFORM_FIELDS`,
 * surchargeable par appelant (`fields`) ; le repli de slug est centralisé ici.
 */

export type ActivityStatus = "Valide" | "En attente" | "En cours" | "Refuse";

export function normalizeStatus(rawStatus: string): ActivityStatus {
  if (rawStatus === "En attente" || rawStatus === "En cours") return rawStatus;
  if (rawStatus === "Refuse" || rawStatus === "Réfusé") return "Refuse";
  return "Valide";
}

/** Classes du badge de statut (tokens custom `bg-badge-*`). */
export function getStatusStyle(status: ActivityStatus): string {
  switch (status) {
    case "En attente":
      return "bg-badge-waiting text-primary-foreground";
    case "En cours":
      return "bg-badge-in-progress text-primary-foreground";
    case "Refuse":
      return "bg-badge-refused text-primary-foreground";
    case "Valide":
    default:
      return "bg-badge-valid text-primary-foreground";
  }
}

/** Abrège les libellés de type d'activité (sinon renvoie la valeur brute). */
export function normalizeTypeLabel(rawType: string): string {
  switch (rawType) {
    case "Sport santé sur ordonnance - SSsO":
      return "SSsO";
    case "Sport santé pour tous - SSpT":
      return "SSpT";
    default:
      return rawType;
  }
}

/**
 * Mapping rôle → identifiant STABLE d'input CoForm (la queue aléatoire de la clé).
 *
 * Une clé réelle = `<section><id>` (ex. `sportSanteBienetre2172025_854_0` +
 * `mdegc9sgox76p87n27`). La section change à CHAQUE duplication du formulaire
 * (migration créneaux : SSBE partagé → form dédié Ekilib.re
 * `associationEkilibre19082026_1327_0`, form 6a85af345d898a57cb49f029), mais les
 * ids d'inputs SURVIVENT à la duplication (vérifié en base sur les deux forms) :
 * résoudre par suffixe rend cartes/détail indépendants du form actif — plus aucun
 * préfixe de slug à remapper côté code.
 */
export const DEFAULT_COFORM_FIELDS: Record<string, string> = {
  title: "mdegc9sgox76p87n27",
  description: "mdeggo91owe8t9ovl4p",
  type: "mdn1cs8on3yru1p80lq",
  state: "mdn1jcq445i0mb9bap7",
  instructorFirstName: "mdmz5fbxxtvelsircg9",
  instructorLastName: "mdmz4qoaelvlcpten8w",
  typeActivity: "mdegdo93f77wi3y186s",
  typeGender: "mdmya4gmezjilnyjj5f",
  beneficiaries: "mdmyf2gky9capf1vcfl",
  mobilityReduced: "mdmy67hlexyn92fh98s",
  landmark: "mdmxv88txy6f5z6svg",
  address: "mdr0xcsmmpnr6ez17q",
  places: "mdmxe3qhkjb9qu74wli",
  schedule: "mdefmehl5baa207uud6",
  installationFinder: "mocno9muqzznoo0gyx",
};

export interface CoformStructure {
  name?: string;
  email: string;
  phone: string;
  imageUrl?: string;
  slug?: string;
}

export interface CoformAnswer {
  title?: string;
  description?: string;
  typeRaw: string;
  /** Type abrégé (SSsO/SSpT…) pour la carte. */
  typeLabel: string;
  typeActivity?: string;
  typeGender: string;
  stateRaw: string;
  status: ActivityStatus;
  instructorFirstName: string;
  instructorLastName: string;
  beneficiaries: string[];
  mobilityReduced: string;
  /** Adresse reconstruite depuis le formulaire (landmark / places). */
  addressParts: string[];
  /** Adresse de l'entité (`serverData.address`). */
  entityAddress: string;
  structure: CoformStructure;
  installations: { id: string; name: string }[];
  schedules: DaySchedule[];
}

function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

export interface ParseCoformOptions {
  /** Surcharge du mapping `DEFAULT_COFORM_FIELDS` (ex. `preview.fields`). Les valeurs
   *  sont matchées par SUFFIXE : un override historique portant la clé complète
   *  (`sportSanteBienetre2172025_854_0…`) reste donc valide tel quel. */
  fields?: Record<string, string>;
}

/** Référence d'édition d'une answer issue des résultats de recherche. */
export interface AnswerRef {
  answerId: string;
  formId: string;
}

/**
 * Extrait (answerId, formId) d'un item « answer » des résultats de recherche —
 * le minimum pour ouvrir l'édition CoForm. `id` vient du getter de l'instance
 * SDK avec repli sur l'EJSON brut (`serverData._id.$oid`) : les résultats
 * revivifiés sont des instances, ceux issus du cache SSR peuvent rester du
 * JSON. Renvoie `null` si l'un des deux manque → le bouton « Modifier » est
 * masqué (pas d'édition à l'aveugle).
 */
export function getAnswerRef(
  item: { id?: string | null; serverData?: unknown } | null | undefined,
): AnswerRef | null {
  const serverData = item?.serverData as Record<string, unknown> | undefined;
  if (!serverData) return null;
  const rawId = (serverData._id as { $oid?: string } | undefined)?.$oid;
  const answerId = item?.id ?? rawId ?? null;
  const formId = typeof serverData.form === "string" && serverData.form ? serverData.form : null;
  return answerId && formId ? { answerId, formId } : null;
}

/** Lien `memberOf` d'un utilisateur vers une organisation (sous-ensemble consommé ici). */
interface MemberOfLink {
  isAdmin?: boolean;
  isAdminPending?: boolean;
  toBeValidated?: boolean;
  isInviting?: boolean;
}

/** `me` vu par la règle de gestion — structurel : le `User` du SDK y est assignable. */
export interface AnswerManagerMe {
  isSuperAdmin?: () => boolean;
  isAdminPlatform?: () => boolean;
  serverData?: { links?: { memberOf?: Record<string, MemberOfLink> } };
}

/**
 * Id (24 hex) de la structure porteuse d'une answer. L'organisation est jointe
 * sous `structure._id`, dont l'encodage dépend du chemin de sérialisation
 * (EJSON `$oid`, dump `_str`/`$id`, ou string déjà aplatie côté SDK) : on accepte
 * les quatre plutôt que de parier sur celui d'un endpoint donné.
 *
 * ⚠️ UNE seule structure : le hook costum backend écrase `structure` à chaque tour
 * de sa boucle de jointure (`AssociationEkilibre`/`SportSanteBienetre::searchAnswers`),
 * donc un créneau co-porté n'expose que la DERNIÈRE. Un admin d'une co-structure
 * non retenue n'est pas reconnu — élargir demanderait que le backend renvoie la
 * liste (fiche `ENDPOINT.md`), pas un contournement côté front.
 */
export function getAnswerStructureId(serverData: Record<string, unknown> | undefined): string | null {
  const structure = serverData?.structure as Record<string, unknown> | undefined;
  const rawId = structure?._id;
  if (typeof rawId === "string") return rawId || null;
  const id = rawId as { $oid?: string; _str?: string; $id?: string } | undefined;
  return id?.$oid ?? id?._str ?? id?.$id ?? null;
}

/**
 * Admin VALIDÉ de cette organisation ? Mêmes exclusions que
 * `useUserAdminOrganizations` : une invitation ou une demande d'admin en attente
 * n'est pas un droit.
 */
function isValidatedAdminOf(me: AnswerManagerMe | null | undefined, organizationId: string): boolean {
  const link = me?.serverData?.links?.memberOf?.[organizationId];
  return Boolean(link?.isAdmin && !link.isAdminPending && !link.toBeValidated && !link.isInviting);
}

/**
 * Qui **a la charge** d'une answer (= un créneau) : **super-admin plateforme**,
 * **admin du costum** porteur du site, ou **admin validé de la structure organisatrice**.
 *
 * UN seul prédicat pour DEUX points d'appel, à dessein :
 *  - le bouton « Modifier » du détail (`PreviewCoformAnswer`) — droit d'écriture ;
 *  - le bouton « Fiche structure » de la carte (`CardAnswer`, opt-in
 *    `card.structureAction.audience`) — la fiche est un outil de GESTION
 *    (affiliation, représentant légal, documents), pas une information utile à qui
 *    compare des créneaux.
 * Les deux répondent à la même question — « cette personne gère-t-elle ce créneau ? ».
 * D'où le nom : `canEdit…` aurait laissé croire qu'il ne gouverne qu'une écriture, et
 * un futur resserrement du droit d'édition aurait resserré l'affichage en silence.
 *
 * ⚠️ Volontairement plus large que le `canEdit` renvoyé par le backend, calculé
 * sur la seule PROPRIÉTÉ de la réponse (`editDeniedReason: "not_owner"`) : un
 * admin de costum n'est pas l'auteur du créneau et serait refusé à tort. Le
 * backend reste la source de vérité au moment du save.
 * ⚠️ Côté AFFICHAGE, ce n'est PAS une frontière de sécurité : `/profil/:slug` et
 * `/structure` restent des routes publiques, et le slug de la structure part déjà
 * dans l'état React Query sérialisé servi à tout visiteur.
 * ⚠️ Lien DIRECT uniquement : pas de remontée parent/organizer, contrairement au
 * `Authorisation::isElementAdmin` du backend — un admin qui ne l'est que par
 * hiérarchie ne sera pas reconnu ici.
 */
export function isCoformAnswerManager(
  serverData: Record<string, unknown> | undefined,
  actor: { me?: AnswerManagerMe | null; entity?: { isAdmin?: () => boolean } | null },
): boolean {
  // super-admin plateforme (`isSuperAdmin`/`isAdminPlatform`) OU admin de
  // l'entité porteuse du costum — même résolution que le gate de la page /admin.
  if (resolveAdminAccessLevel(actor.me, actor.entity)) return true;
  const structureId = getAnswerStructureId(serverData);
  return structureId ? isValidatedAdminOf(actor.me, structureId) : false;
}

/** Parse une réponse CoForm `serverData` en objet typé, consommé par la carte ET le détail. */
export function parseCoformAnswer(
  serverData: Record<string, unknown>,
  { fields: override }: ParseCoformOptions = {},
): CoformAnswer {
  const fields = { ...DEFAULT_COFORM_FIELDS, ...(override ?? {}) };
  // Résolution par SUFFIXE sur les lignes APLATIES par le hook costum : la clé complète est
  // `<section><id>` et seul l'id est stable inter-forms (cf. DEFAULT_COFORM_FIELDS). Les ids
  // (~18 car. aléatoires) ne peuvent pas se terminer l'un par l'autre → premier match fiable.
  const keys = Object.keys(serverData);
  const get = (role: string) => {
    const suffix = fields[role];
    if (!suffix) return undefined;
    const key = keys.find((k) => k.endsWith(suffix));
    return key ? serverData[key] : undefined;
  };

  const typeRaw = (get("type") as string | undefined) ?? "";
  const stateRaw = (get("state") as string | undefined) ?? "";

  // Adresse depuis le formulaire (landmark + premier lieu).
  // str() garantit une string (sinon undefined) : le backend peut renvoyer un
  // non-string pour ces champs (nombre/objet), le cast `as string` mentait et
  // faisait planter le .trim() plus bas ("part.trim is not a function").
  const landmark = str(get("landmark")) ?? "";
  const addressObj = get("address") as Record<string, unknown> | undefined;
  const addressLine = str(addressObj?.address) ?? "";
  const placesRaw = (get("places") as unknown[]) ?? [];
  const firstPlace = placesRaw[0] as Record<string, unknown> | undefined;
  const placeName = (str(firstPlace?.placeName) ?? "")
    .replace(/la r[ée]union/gi, "")
    .trim();
  const postalCode = (firstPlace?.postalCode as string | undefined) ?? "";
  const addressParts = [landmark, addressLine, placeName, postalCode ? `${postalCode}, La Réunion` : ""]
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  // Adresse de l'entité.
  const addr = serverData.address as Record<string, unknown> | undefined;
  const entityAddress = [addr?.streetAddress, addr?.postalCode, addr?.addressLocality]
    .filter(Boolean)
    .join(" ");

  // Structure organisatrice.
  const structureRaw = serverData.structure as Record<string, unknown> | undefined;
  const telephone = structureRaw?.telephone as Record<string, unknown> | undefined;
  const structure: CoformStructure = {
    name: str(structureRaw?.name),
    email: (structureRaw?.email as string | undefined) ?? "",
    phone:
      (telephone?.mobile as string | undefined)
      ?? (telephone?.fixe as string | undefined)
      ?? (structureRaw?.phone as string | undefined)
      ?? "",
    imageUrl: structureRaw?.profilImageUrl as string | undefined,
    slug: structureRaw?.slug as string | undefined,
  };

  // Installations : la clé stockée est préfixée `finder<section>` — le match par
  // suffixe la retrouve sans connaître la section.
  const installationsRaw = get("installationFinder");
  const installations = (
    Array.isArray(installationsRaw)
      ? installationsRaw
      : installationsRaw && typeof installationsRaw === "object"
        ? Object.values(installationsRaw as Record<string, unknown>)
        : []
  )
    .map((entry, index) => {
      const record = entry as Record<string, unknown> | undefined;
      const name = record ? normalizeText(record.name) : undefined;
      const id = record ? normalizeText(record.id) : undefined;
      return { id: id || name || String(index), name: name || id || "" };
    })
    .filter((entry) => entry.name.trim().length > 0);

  const beneficiariesRaw = (get("beneficiaries") as unknown[]) ?? [];

  return {
    title: str(serverData.name) ?? str(get("title")),
    description: str(get("description")),
    typeRaw,
    typeLabel: normalizeTypeLabel(typeRaw),
    typeActivity: str(get("typeActivity")),
    typeGender: (get("typeGender") as string | undefined) ?? "",
    stateRaw,
    status: normalizeStatus(stateRaw),
    instructorFirstName: (get("instructorFirstName") as string | undefined) ?? "",
    instructorLastName: (get("instructorLastName") as string | undefined) ?? "",
    beneficiaries: beneficiariesRaw
      .map((value) => (typeof value === "string" ? value : String(value)))
      .filter(Boolean),
    mobilityReduced: (get("mobilityReduced") as string | undefined) ?? "",
    addressParts,
    entityAddress,
    structure,
    installations,
    schedules: groupSchedules(get("schedule")),
  };
}
