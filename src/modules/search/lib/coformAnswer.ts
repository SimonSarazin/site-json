import { groupSchedules, type DaySchedule } from "./schedules";

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

/** Mapping rôle → suffixe de champ CoForm (par défaut : formulaire activité SSBE). */
export const DEFAULT_COFORM_FIELDS: Record<string, string> = {
  title: "2172025_854_0mdegc9sgox76p87n27",
  description: "2172025_854_0mdeggo91owe8t9ovl4p",
  type: "2172025_854_0mdn1cs8on3yru1p80lq",
  state: "2172025_854_0mdn1jcq445i0mb9bap7",
  instructorFirstName: "2172025_854_0mdmz5fbxxtvelsircg9",
  instructorLastName: "2172025_854_0mdmz4qoaelvlcpten8w",
  typeActivity: "2172025_854_0mdegdo93f77wi3y186s",
  typeGender: "2172025_854_0mdmya4gmezjilnyjj5f",
  beneficiaries: "2172025_854_0mdmyf2gky9capf1vcfl",
  mobilityReduced: "2172025_854_0mdmy67hlexyn92fh98s",
  landmark: "2172025_854_0mdmxv88txy6f5z6svg",
  address: "2172025_854_0mdr0xcsmmpnr6ez17q",
  places: "2172025_854_0mdmxe3qhkjb9qu74wli",
  schedule: "2172025_854_0mdefmehl5baa207uud6",
  installationFinder: "2172025_854_0mocno9muqzznoo0gyx",
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
  slug?: string | null;
  /** Surcharge du mapping `DEFAULT_COFORM_FIELDS` (ex. `preview.fields`). */
  fields?: Record<string, string>;
}

/** Parse une réponse CoForm `serverData` en objet typé, consommé par la carte ET le détail. */
export function parseCoformAnswer(
  serverData: Record<string, unknown>,
  { slug, fields: override }: ParseCoformOptions = {},
): CoformAnswer {
  const fields = { ...DEFAULT_COFORM_FIELDS, ...(override ?? {}) };
  // "associationEkilibre" est le slug d'entité, mais les champs CoForm sont
  // préfixés "sportSanteBienetre" (form partagé) : remap nécessaire ici pour
  // que CardAnswer et PreviewCoformAnswer restent alignés.
  const keyPrefix = !slug || slug === "associationEkilibre" ? "sportSanteBienetre" : slug;
  const get = (role: string) => serverData[`${keyPrefix}${fields[role]}`];

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

  // Installations (clé préfixée `finder…`).
  const installationsRaw = serverData[`finder${keyPrefix}${fields.installationFinder}`];
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
