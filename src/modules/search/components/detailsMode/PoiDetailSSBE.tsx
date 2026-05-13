import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import type { GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";
import {
  Accessibility,
  BedDouble,
  Building2,
  Bus,
  Calendar,
  CheckCircle2,
  Heart,
  History,
  Info,
  MapPin,
  Settings,
  Shield,
  Star,
  Tag,
  UtensilsCrossed,
  Users,
  Lightbulb,
  Unlock,
} from "lucide-react";
import type { DetailsModeProps } from "../../schema";

interface PoiAddress {
  streetAddress?: string;
  postalCode?: string;
  addressLocality?: string;
  level1Name?: string;
  addressCountry?: string;
}

interface PoiGeo {
  latitude: number;
  longitude: number;
}

interface PoiParent {
  name?: string;
  type?: string;
}

interface PoiDetail {
  name: string;
  category?: string;
  subCategory?: string;
  enqueteStatut?: string;
  installation?: string;
  sportPratiquer?: string;
  dateCreation?: string;
  dateEnquete?: string;
  lastUpdate?: string;
  familleEquipement?: string;
  type?: string;
  nature?: string;
  sole?: string;
  surface?: string;
  eclairage?: string;
  libreAccess?: string;
  partenariat?: string;
  typePartenariat?: string;
  handicap?: string;
  transportCommun?: string;
  restaurant?: string;
  hebergement?: string;
  gardiennage?: string;
  typeAccessiblHandicap?: string;
  typeTransportCommun?: string;
  address: PoiAddress;
  geo?: PoiGeo;
  parent?: PoiParent;
}

interface PoiActivityParent {
  id: string;
  name?: string;
  type?: string;
}

interface PoiActivity {
  id: string;
  name: string;
  parents: PoiActivityParent[];
}

const ACTIVITY_FORM_SUFFIX = "2172025_854_0";
const ACTIVITY_NAME_SUFFIX = "mdegc9sgox76p87n27";
const ACTIVITY_PARENT_SUFFIX = "mdn1fzoewyjg66n85p";
const ACTIVITY_POI_FINDER_SUFFIX = "mocno9muqzznoo0gyx";

const isTrue = (value?: string) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "oui" || normalized === "yes";
};

const formatDateFr = (iso?: string) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const yearsAgo = (iso?: string) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Date().getFullYear() - date.getFullYear();
};

function toStringValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => toStringValue(entry))
      .filter((entry): entry is string => Boolean(entry));
    return parts.length > 0 ? parts.join(", ") : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    const localized = value as Record<string, unknown>;
    const preferred = localized.fr ?? localized.en;
    if (typeof preferred === "string") {
      const trimmed = preferred.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
  }
  return undefined;
}

function resolveEntityId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const directId = record.id;
  if (typeof directId === "string" || typeof directId === "number") return String(directId);

  const rawId = record._id;
  if (typeof rawId === "string" || typeof rawId === "number") return String(rawId);
  if (rawId && typeof rawId === "object") {
    const rawRecord = rawId as Record<string, unknown>;
    const nestedId = rawRecord.$oid ?? rawRecord.$id ?? rawRecord._str ?? rawRecord.$numberLong;
    if (typeof nestedId === "string" || typeof nestedId === "number") return String(nestedId);
  }

  return undefined;
}

function resolveItemId(item: DetailsModeProps["item"] | undefined): string | undefined {
  if (!item) return undefined;
  const itemRecord = item as unknown as Record<string, unknown>;
  const direct = resolveEntityId(itemRecord);
  if (direct) return direct;
  const serverData = itemRecord.serverData as Record<string, unknown> | undefined;
  const serverId = resolveEntityId(serverData);
  if (serverId) return serverId;
  return undefined;
}

function getServerRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as { _serverData?: Record<string, unknown>; serverData?: Record<string, unknown> };
  return record._serverData ?? record.serverData ?? (value as Record<string, unknown>);
}

function extractParents(raw: unknown): PoiActivityParent[] {
  if (!raw || typeof raw !== "object") return [];

  const entries = Array.isArray(raw)
    ? raw.map((entry, index) => [String(index), entry] as const)
    : Object.entries(raw as Record<string, unknown>);

  return entries
    .map(([id, entry]) => {
      if (!entry || typeof entry !== "object") return undefined;
      const record = entry as Record<string, unknown>;
      const name = toStringValue(record.name);
      const type = toStringValue(record.type);
      const parentId = toStringValue(record.id) ?? id;
      if (!name && !type) return undefined;
      return { id: parentId, name, type } as PoiActivityParent;
    })
    .filter((parent): parent is PoiActivityParent => Boolean(parent));
}

function toNumberValue(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeDateValue(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      const ms = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? trimmed : date.toISOString();
    }
    return trimmed;
  }
  return undefined;
}

function resolveParentData(parentData: Record<string, unknown> | undefined): PoiParent | undefined {
  if (!parentData) return undefined;
  const directName = toStringValue(parentData.name);
  const directType = toStringValue(parentData.type);
  if (directName || directType) {
    return {
      name: directName,
      type: directType,
    };
  }

  const candidate = Array.isArray(parentData)
    ? parentData[0]
    : Object.values(parentData).find((entry) => entry && typeof entry === "object");

  if (!candidate || typeof candidate !== "object") return undefined;

  const nested = candidate as Record<string, unknown>;
  const nestedName = toStringValue(nested.name);
  const nestedType = toStringValue(nested.type);

  if (!nestedName && !nestedType) return undefined;

  return {
    name: nestedName,
    type: nestedType,
  };
}

const COSTUM_FIELD_KEYS = new Set([
  "name",
  "category",
  "subCategory",
  "sportPratiquer",
  "nature",
  "surface",
  "sole",
  "partenariat",
  "typePartenariat",
  "typeAccessiblHandicap",
  "typeTransportCommun",
  "familleEquipement",
  "installation",
  "type",
  "handicap",
  "transportCommun",
  "restaurant",
  "hebergement",
  "gardiennage",
  "eclairage",
  "libreAccess",
  "dateCreation",
  "dateEnquete",
  "lastUpdate",
  "created",
  "updated",
  "address",
  "geo",
  "geoPosition",
  "parent",
]);

function findCostumCandidate(
  value: unknown,
  visited: Set<object>,
): { record: Record<string, unknown>; score: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (visited.has(value)) return undefined;
  visited.add(value);

  if (Array.isArray(value)) {
    return value.reduce<{ record: Record<string, unknown>; score: number } | undefined>(
      (best, entry) => {
        const candidate = findCostumCandidate(entry, visited);
        if (!candidate) return best;
        if (!best || candidate.score > best.score) return candidate;
        return best;
      },
      undefined,
    );
  }

  const record = value as Record<string, unknown>;
  const score = Array.from(COSTUM_FIELD_KEYS).reduce(
    (count, key) => (key in record ? count + 1 : count),
    0,
  );
  let best: { record: Record<string, unknown>; score: number } | undefined =
    score > 0 ? { record, score } : undefined;

  for (const entry of Object.values(record)) {
    const candidate = findCostumCandidate(entry, visited);
    if (!candidate) continue;
    if (!best || candidate.score > best.score) best = candidate;
  }

  return best;
}

function unwrapCostumData(raw: unknown, sourceKey?: string): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  const visited = new Set<object>();

  if (sourceKey && typeof raw === "object" && raw !== null) {
    const record = raw as Record<string, unknown>;
    const sourceValue = record[sourceKey];
    const fromSource = findCostumCandidate(sourceValue, visited);
    if (fromSource) return fromSource.record;
  }

  const candidate = findCostumCandidate(raw, visited);
  return candidate?.record;
}

function getPoiImage(category?: string, name?: string) {
  const text = (category || name || "POI").trim().slice(0, 2).toUpperCase();
  const colors = ["#60a5fa", "#34d399", "#f97316", "#ef4444", "#a78bfa", "#f59e0b"];
  const hash = (category || name || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const color = colors[Math.abs(hash) % colors.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><rect width='160' height='160' fill='${color}' rx='16'/><text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' font-size='56' font-family='Arial, Helvetica, sans-serif' fill='white'>${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function toPoi(item: DetailsModeProps["item"]): PoiDetail {
  const entityData = (item ?? {}) as unknown as Record<string, unknown>;
  const serverData = (item?.serverData ?? {}) as unknown as Record<string, unknown>;
  const sourceData = (serverData.source ?? entityData.source) as Record<string, unknown> | undefined;
  const sourceKeyFromList = Array.isArray(sourceData?.keys)
    ? toStringValue(sourceData.keys.find((value) => typeof value === "string"))
    : undefined;
  const sourceKey =
    toStringValue(sourceData?.key ?? serverData.sourceKey ?? entityData.sourceKey) ??
    sourceKeyFromList;
  const costumData = unwrapCostumData(serverData.costum ?? entityData.costum, sourceKey);
  const address =
    (serverData.address ?? entityData.address ?? costumData?.address) as
      | Record<string, unknown>
      | undefined;
  const geoData =
    (serverData.geo ?? entityData.geo ?? costumData?.geo) as Record<string, unknown> | undefined;
  const geoPosition =
    (serverData.geoPosition ?? entityData.geoPosition ?? costumData?.geoPosition) as
      | Record<string, unknown>
      | undefined;
  const parentData =
    (serverData.parent ?? entityData.parent ?? costumData?.parent) as
      | Record<string, unknown>
      | undefined;

  const resolveText = (...values: unknown[]) => {
    for (const value of values) {
      const resolved = toStringValue(value);
      if (resolved !== undefined) return resolved;
    }
    return undefined;
  };

  const resolveDate = (...values: unknown[]) => {
    const candidate = values.find((value) => value !== undefined && value !== null);
    return normalizeDateValue(candidate);
  };

  const coordinateSource =
    (geoPosition?.coordinates as unknown) ??
    (geoData?.coordinates as unknown) ??
    ((geoData?.geometry as Record<string, unknown> | undefined)?.coordinates as unknown);
  const coordinateArray = Array.isArray(coordinateSource) ? coordinateSource : undefined;
  const longitudeFromArray = coordinateArray ? toNumberValue(coordinateArray[0]) : undefined;
  const latitudeFromArray = coordinateArray ? toNumberValue(coordinateArray[1]) : undefined;

  const latitude = latitudeFromArray ?? toNumberValue(geoData?.latitude ?? geoData?.lat);
  const longitude =
    longitudeFromArray ?? toNumberValue(geoData?.longitude ?? geoData?.lng ?? geoData?.lon);

  const familleEquipement = resolveText(
    serverData.familleEquipement,
    entityData.familleEquipement,
    costumData?.familleEquipement,
  );
  const category =
    resolveText(serverData.category, entityData.category, costumData?.category) ??
    familleEquipement;
  const resolvedParent = resolveParentData(parentData);
  const parentName = resolvedParent?.name ?? "Sport Santé Bien-être";
  const parentType = resolvedParent?.type ?? "organizations";

  return {
    name: resolveText(serverData.name, entityData.name, costumData?.name) ?? "",
    category,
    subCategory: resolveText(
      serverData.subCategory,
      entityData.subCategory,
      costumData?.subCategory,
    ),
    enqueteStatut: resolveText(
      serverData.enqueteStatut,
      entityData.enqueteStatut,
      costumData?.enqueteStatut,
    ),
    installation: resolveText(
      serverData.installation,
      entityData.installation,
      costumData?.installation,
    ),
    sportPratiquer: resolveText(
      serverData.sportPratiquer,
      entityData.sportPratiquer,
      costumData?.sportPratiquer,
    ),
    dateCreation: resolveDate(
      serverData.dateCreation,
      entityData.dateCreation,
      costumData?.dateCreation,
      serverData.created,
      entityData.created,
      costumData?.created,
    ),
    dateEnquete: resolveDate(
      serverData.dateEnquete,
      entityData.dateEnquete,
      costumData?.dateEnquete,
    ),
    lastUpdate: resolveDate(
      serverData.lastUpdate,
      entityData.lastUpdate,
      costumData?.lastUpdate,
      serverData.updated,
      entityData.updated,
      costumData?.updated,
    ),
    familleEquipement,
    type: resolveText(serverData.type, entityData.type, costumData?.type),
    nature: resolveText(serverData.nature, entityData.nature, costumData?.nature),
    sole: resolveText(serverData.sole, entityData.sole, costumData?.sole),
    surface: resolveText(serverData.surface, entityData.surface, costumData?.surface),
    eclairage: resolveText(serverData.eclairage, entityData.eclairage, costumData?.eclairage),
    libreAccess: resolveText(serverData.libreAccess, entityData.libreAccess, costumData?.libreAccess),
    partenariat: resolveText(serverData.partenariat, entityData.partenariat, costumData?.partenariat),
    typePartenariat: resolveText(
      serverData.typePartenariat,
      entityData.typePartenariat,
      costumData?.typePartenariat,
    ),
    handicap: resolveText(serverData.handicap, entityData.handicap, costumData?.handicap),
    transportCommun: resolveText(
      serverData.transportCommun,
      entityData.transportCommun,
      costumData?.transportCommun,
    ),
    restaurant: resolveText(
      serverData.restaurant,
      entityData.restaurant,
      costumData?.restaurant,
    ),
    hebergement: resolveText(
      serverData.hebergement,
      entityData.hebergement,
      costumData?.hebergement,
    ),
    gardiennage: resolveText(
      serverData.gardiennage,
      entityData.gardiennage,
      costumData?.gardiennage,
    ),
    typeAccessiblHandicap: resolveText(
      serverData.typeAccessiblHandicap,
      entityData.typeAccessiblHandicap,
      costumData?.typeAccessiblHandicap,
    ),
    typeTransportCommun: resolveText(
      serverData.typeTransportCommun,
      entityData.typeTransportCommun,
      costumData?.typeTransportCommun,
    ),
    address: {
      streetAddress: toStringValue(address?.streetAddress),
      postalCode: toStringValue(address?.postalCode),
      addressLocality: toStringValue(address?.addressLocality),
      level1Name: toStringValue(address?.level1Name),
      addressCountry: toStringValue(address?.addressCountry),
    },
    geo: latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined,
    parent: {
      name: parentName,
      type: parentType,
    },
  };
}

function InfoRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={muted ? "text-sm text-muted-foreground" : "text-sm text-foreground"}>
        {value}
      </div>
    </div>
  );
}

function Feature({
  label,
  active,
  Icon,
}: {
  label: string;
  active: boolean;
  Icon: typeof Accessibility;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "border-primary/30 bg-teal-light text-primary"
          : "border-border bg-muted/40 text-muted-foreground/60 line-through decoration-muted-foreground/40"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

export default function PoiDetailSSBE({ openDetails, setOpenDetails, item }: DetailsModeProps) {
  const { entity } = useCocolight();
  const poi = toPoi(item);
  const entityData = (item ?? {}) as unknown as Record<string, unknown>;
  const serverData = (item?.serverData ?? {}) as unknown as Record<string, unknown>;
  const serverImage = toStringValue(
    serverData.profilImageUrl ??
      serverData.profileImageUrl ??
      serverData.profilMediumImageUrl ??
      serverData.profilThumbImageUrl ??
      serverData.image ??
      entityData.profilImageUrl ??
      entityData.profileImageUrl ??
      entityData.profilMediumImageUrl ??
      entityData.profilThumbImageUrl ??
      entityData.image,
  );
  const hasImage = Boolean(serverImage);
  const imageSrc = serverImage ?? getPoiImage(poi.category, poi.name);
  const years = yearsAgo(poi.dateCreation);
  const cityLine = [poi.address.postalCode, poi.address.addressLocality]
    .filter(Boolean)
    .join(" ");
  const parent = poi.parent ?? { name: "Sport Santé Bien-être", type: "organizations" };
  const surfaceValue = toNumberValue(poi.surface);
  const surfaceLabel = surfaceValue !== undefined ? `${surfaceValue} m²` : poi.surface || "—";
  const poiId = resolveItemId(item);
  const [activities, setActivities] = useState<PoiActivity[]>([]);
  const [isActivitiesLoading, setIsActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<Error | null>(null);

  useEffect(() => {
    if (!openDetails) return;
    if (!entity || !poiId) {
      setActivities([]);
      setIsActivitiesLoading(false);
      setActivitiesError(null);
      return;
    }

    const endpointApi = (entity as unknown as {
      endpointApi?: {
        globalAutocompleteCostum?: (data: GlobalAutocompleteCostumData) => Promise<{ results?: unknown }>;
      };
    }).endpointApi;

    const globalAutocompleteCostum = endpointApi?.globalAutocompleteCostum?.bind(endpointApi);
    if (typeof globalAutocompleteCostum !== "function") {
      setActivities([]);
      setIsActivitiesLoading(false);
      setActivitiesError(null);
      return;
    }

    let isActive = true;

    const fetchActivities = async () => {
      setIsActivitiesLoading(true);
      setActivitiesError(null);
      setActivities([]);

      try {
        const entityServerData = (entity as unknown as Record<string, unknown>)?.serverData as
          | Record<string, unknown>
          | undefined;
        const keyPrefix = toStringValue(entityServerData?.slug) ?? "sportSanteBienetre";
        const formKey = `${keyPrefix}${ACTIVITY_FORM_SUFFIX}`;
        const activityNameKey = `${formKey}${ACTIVITY_NAME_SUFFIX}`;
        const parentFinderKey = `finder${formKey}${ACTIVITY_PARENT_SUFFIX}`;
        const poiFinderKey = `finder${formKey}${ACTIVITY_POI_FINDER_SUFFIX}`;
        const filterKey = `answers.${formKey}.${poiFinderKey}.${poiId}`;

        const contextId = toStringValue(entityServerData?.id) ??
          toStringValue((entity as unknown as Record<string, unknown>)?.id);
        const contextType = typeof (entity as { getEntityType?: () => string }).getEntityType === "function"
          ? (entity as { getEntityType: () => string }).getEntityType()
          : undefined;

        const payload: GlobalAutocompleteCostumData = {
          name: "",
          searchType: ["answers"],
          countType: ["answers"],
          indexMin: 0,
          indexStep: 50,
          initType: "",
          count: true,
          fediverse: false,
          costumSlug: keyPrefix,
          costumEditMode: false,
          sourceKey: [keyPrefix],
          filters: {
            [filterKey]: { $exists: true },
          },
          fields: ["id", "_id", "collection", "name", "answers"],
          ...(contextId ? { contextId } : {}),
          ...(contextType ? { contextType: contextType as GlobalAutocompleteCostumData["contextType"] } : {}),
        };

        const result = await globalAutocompleteCostum(payload);
        console.log("Résultat de la recherche d'activités:", result);
        const rawResults = result?.results;
        const resultsList = Array.isArray(rawResults)
          ? rawResults
          : rawResults && typeof rawResults === "object"
            ? Object.values(rawResults as Record<string, unknown>)
            : [];

        const mapped = resultsList
          .map((entry, index) => {
            const serverEntry = getServerRecord(entry) ?? {};
            const answersRoot = serverEntry.answers as Record<string, unknown> | undefined;
            const answersBlock = answersRoot?.[formKey] as Record<string, unknown> | undefined;
            const activityName =
              toStringValue(answersBlock?.[activityNameKey]) ??
              toStringValue(serverEntry.name) ??
              "—";
            const parents = extractParents(answersBlock?.[parentFinderKey]);
            const activityId =
              resolveEntityId(serverEntry) ?? resolveEntityId(entry) ?? `${activityName}-${index}`;

            return {
              id: activityId,
              name: activityName,
              parents,
            } as PoiActivity;
          })
          .filter((activity) => activity.name !== "—" || activity.parents.length > 0);

        if (isActive) {
          setActivities(mapped);
        }
      } catch (error) {
        if (isActive) {
          console.error("Erreur lors du chargement des activites:", error);
          setActivitiesError(error instanceof Error ? error : new Error("Unknown error"));
        }
      } finally {
        if (isActive) {
          setIsActivitiesLoading(false);
        }
      }
    };

    void fetchActivities();

    return () => {
      isActive = false;
    };
  }, [entity, openDetails, poiId]);

  return (
    <Dialog open={openDetails} onOpenChange={setOpenDetails}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] p-0 overflow-hidden gap-0">
        <div className="px-6 py-5" style={{ background: "var(--card-header-gradient)" }}>
          <DialogHeader className="text-left space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {poi.category && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-primary-foreground">
                  <Tag className="h-3.5 w-3.5" />
                  {poi.category}
                </span>
              )}
              {poi.subCategory && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-primary-foreground">
                  <Star className="h-3.5 w-3.5" />
                  {poi.subCategory}
                </span>
              )}
              {poi.enqueteStatut === "Validé" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-primary-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Validé
                </span>
              )}
            </div>

            <DialogTitle className="text-2xl font-bold text-primary-foreground">
              {poi.name || "Point d'intérêt"}
            </DialogTitle>

            <div className="flex flex-wrap items-center gap-4 text-sm text-primary-foreground/85">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>{poi.installation || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{poi.address.addressLocality || "—"}</span>
              </div>
              {poi.sportPratiquer && (
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  <span>{poi.sportPratiquer}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  Créé le {formatDateFr(poi.dateCreation)}
                  {typeof years === "number" && years > 0 ? (
                    <span className="ml-1 opacity-80">(il y a {years} ans)</span>
                  ) : null}
                </span>
              </div>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="grid gap-6 p-6 pb-12 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-primary">
                  <Info className="h-5 w-5" />
                  <h2 className="text-base font-semibold">Informations générales</h2>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <InfoRow label="Catégorie" value={poi.category || "—"} />
                  <InfoRow label="Famille d'équipement" value={poi.familleEquipement || "—"} />
                  <InfoRow label="Sous-catégorie" value={poi.subCategory || "—"} />
                  <InfoRow label="Type" value={poi.type || "—"} />
                  <InfoRow label="Sport pratiqué" value={poi.sportPratiquer || "—"} />
                  <InfoRow label="Installation" value={poi.installation || "—"} />
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-primary">
                  <Heart className="h-5 w-5" />
                  <h2 className="text-base font-semibold">Activités qui utilisent cette installation</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {isActivitiesLoading && (
                    <div className="text-sm text-muted-foreground">Chargement des activités...</div>
                  )}
                  {!isActivitiesLoading && activitiesError && (
                    <div className="text-sm text-destructive">
                      Impossible de charger les activités.
                    </div>
                  )}
                  {!isActivitiesLoading && !activitiesError && activities.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      Aucune activité associée à cette installation.
                    </div>
                  )}
                  {!isActivitiesLoading && activities.length > 0 && (
                    <div className="space-y-3">
                      {activities.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 p-3"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Heart className="h-4 w-4" />
                          </div>
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-foreground">{activity.name}</div>
                            {activity.parents.length > 0 ? (
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {activity.parents.map((parent) => {
                                  const label =
                                    parent.name && parent.type
                                      ? `${parent.name} (${parent.type})`
                                      : parent.name ?? parent.type ?? "—";
                                  return (
                                    <span
                                      key={`${activity.id}-${parent.id}`}
                                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5"
                                    >
                                      <Building2 className="h-3.5 w-3.5" />
                                      <span>{label}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                Organisation non renseignée
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-primary">
                  <Settings className="h-5 w-5" />
                  <h2 className="text-base font-semibold">Caractéristiques techniques</h2>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <InfoRow label="Nature" value={poi.nature || "—"} />
                  <InfoRow label="Revêtement" value={poi.sole || "—"} />
                  <InfoRow label="Surface" value={surfaceLabel} />
                  <InfoRow label="Éclairage" value={isTrue(poi.eclairage) ? "Oui" : "Non"} />
                  <InfoRow label="Libre accès" value={isTrue(poi.libreAccess) ? "Oui" : "Non"} />
                  <InfoRow
                    label="Partenariat"
                    value={isTrue(poi.partenariat) ? poi.typePartenariat || "Oui" : "Non"}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-primary">
                  <Accessibility className="h-5 w-5" />
                  <h2 className="text-base font-semibold">Accessibilité & services</h2>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Feature label="Accès PMR" active={isTrue(poi.handicap)} Icon={Accessibility} />
                  <Feature
                    label="Transports en commun"
                    active={isTrue(poi.transportCommun)}
                    Icon={Bus}
                  />
                   <Feature label="Éclairage" active={isTrue(poi.eclairage)} Icon={Lightbulb} />
                   <Feature label="Libre accès" active={isTrue(poi.libreAccess)} Icon={Unlock} />
                  <Feature label="Restaurant" active={isTrue(poi.restaurant)} Icon={UtensilsCrossed} />
                  <Feature label="Hébergement" active={isTrue(poi.hebergement)} Icon={BedDouble} />
                  <Feature label="Gardiennage" active={isTrue(poi.gardiennage)} Icon={Shield} />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <InfoRow
                    label="Type d'accessibilité PMR"
                    value={poi.typeAccessiblHandicap || "—"}
                    muted
                  />
                  <InfoRow
                    label="Type de transport"
                    value={poi.typeTransportCommun || "—"}
                    muted
                  />
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="overflow-hidden rounded-2xl">
                <img
                  src={imageSrc}
                  alt={poi.name || "Point d'intérêt"}
                  loading="lazy"
                  className={
                    hasImage
                      ? "h-56 w-full object-cover"
                      : "h-40 w-full bg-muted/40 object-contain"
                  }
                />
              </section>
              <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-primary">
                  <MapPin className="h-5 w-5" />
                  <h2 className="text-base font-semibold">Localisation</h2>
                </div>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">{poi.address.streetAddress || "—"}</p>
                  <p>{cityLine || "—"}</p>
                  {poi.address.level1Name && (
                    <p>
                      {poi.address.level1Name}
                      {poi.address.addressCountry ? ` (${poi.address.addressCountry})` : ""}
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-primary">
                  <Users className="h-5 w-5" />
                  <h2 className="text-base font-semibold">Organisation</h2>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Heart className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{parent.name}</div>
                    <div className="text-xs text-muted-foreground">{parent.type}</div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-primary">
                  <History className="h-5 w-5" />
                  <h2 className="text-base font-semibold">Suivi</h2>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <div className="text-xs text-muted-foreground">Création</div>
                      <div className="font-semibold text-foreground">
                        {formatDateFr(poi.dateCreation)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <div className="text-xs text-muted-foreground">Dernière enquête</div>
                      <div className="font-semibold text-foreground">
                        {formatDateFr(poi.dateEnquete)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <div className="text-xs text-muted-foreground">Dernière mise à jour</div>
                      <div className="font-semibold text-foreground">
                        {formatDateFr(poi.lastUpdate)}
                      </div>
                    </div>
                  </div>
                  {poi.enqueteStatut && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-success-light px-3 py-1 text-xs font-semibold text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {poi.enqueteStatut}
                    </div>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
