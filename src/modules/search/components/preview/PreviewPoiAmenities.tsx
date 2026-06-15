import { useState } from "react";
import { format } from "date-fns";
import type { Poi } from "@communecter/cocolight-api-client";
import getDateFnsLocale from "@/dateFns";
import ProfileMapLeaflet from "@/modules/profil/components/sections/ProfileMapLeaflet";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Button } from "@/components/ui/button";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import "@/modules/search/i18n";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import {
  Accessibility,
  Building2,
  Bus,
  Calendar,
  CheckCircle2,
  Droplet,
  Edit,
  Heart,
  History,
  Info,
  MapPin,
  Settings,
  Tag,
  Users,
  Lightbulb,
  Unlock,
} from "lucide-react";
import type { PreviewProps } from "../../schema";

// Édition déléguée au registry config-driven (`config.profiles.poi.editModal`),
// qui lazy-charge la bonne modale — la vue détail (lecture) n'embarque donc plus
// le formulaire d'édition (découplage + rupture du cycle search ↔ profil).
import { DynamicEditModal } from "@/modules/profil/components/profile-edit/EditModalRegistry";

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

interface PoiDetail {
  name: string;
  category?: string;
  categorie?: string;
  enqueteStatut?: string;
  installation?: string;
  sportPratiquer?: string;
  dateCreation: Date | null;
  dateEnquete: Date | null;
  lastUpdate: Date | null;
  familleEquipement?: string;
  nature?: string;
  sol?: string;
  surface?: string;
  longueur?: string;
  largeur?: string;
  eclairage?: string;
  libreAccess?: string;
  partenariat?: string;
  typePartenariat?: string;
  equipPropNom?: string;
  entrepriseFonciere?: string;
  equipGestType?: string;
  equipLocType?: string;
  equipUtilisateur?: string;
  equipDouche?: string;
  handicap?: string;
  transportCommun?: string;
  typeAccessiblHandicap?: string;
  typeTransportCommun?: string;
  equipPmrAcc?: string;
  equipPmrChem?: string;
  equipPmrDouche?: string;
  equipPmrSanit?: string;
  equipPmrTrib?: string;
  equipPmrVest?: string;
  equipPshsAire?: string;
  equipPshsChem?: string;
  equipPshsSanit?: string;
  equipPshsTrib?: string;
  equipPshsVest?: string;
  equipPshsSign?: string;
  address: PoiAddress;
  geo?: PoiGeo;
}

const isTrue = (value?: string) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "oui" || normalized === "yes";
};

/**
 * `serverData` expose les dates soit en `Date` (entités revifiées, normalisées
 * par la lib), soit en string ISO (après hydratation SSR où les `Date` JSON sont
 * sérialisées). On gère donc Date + string ISO — sans heuristique epoch.
 */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" && value.trim().length > 0) {
    const date = new Date(value.trim());
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

const formatDateFr = (date: Date | null) =>
  date ? format(date, "d MMMM yyyy", { locale: getDateFnsLocale() }) : "—";

const yearsAgo = (date: Date | null): number | null =>
  date ? new Date().getFullYear() - date.getFullYear() : null;

const toNum = (value?: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
};

function getPoiImage(category?: string, name?: string) {
  const text = (category || name || "POI").trim().slice(0, 2).toUpperCase();
  const colors = ["#60a5fa", "#34d399", "#f97316", "#ef4444", "#a78bfa", "#f59e0b"];
  const hash = (category || name || "").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const color = colors[Math.abs(hash) % colors.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><rect width='160' height='160' fill='${color}' rx='16'/><text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' font-size='56' font-family='Arial, Helvetica, sans-serif' fill='white'>${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Vue d'affichage du POI, lue depuis `serverData` **typé** (PoiItemNormalized) :
 * champs de base (name/address/geo/geoPosition) via les types SDK, champs costum
 * (equip_, inst_, pmr_, pshs_) via l'index signature. `str()` ne fait qu'une
 * coercion d'affichage minimale (string brut / nombre / tableau→join).
 */
function toPoi(item: Poi): PoiDetail {
  const sd = item.serverData;
  const str = (value: unknown): string | undefined => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    }
    if (Array.isArray(value)) {
      const parts = value
        .map((entry) => (typeof entry === "string" ? entry.trim() : entry == null ? "" : String(entry)))
        .filter((entry) => entry.length > 0);
      return parts.length ? parts.join(", ") : undefined;
    }
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return undefined;
  };

  const address = sd.address;
  const coordinates = sd.geoPosition?.coordinates;
  const latitude = Array.isArray(coordinates) ? Number(coordinates[1]) : Number(sd.geo?.latitude);
  const longitude = Array.isArray(coordinates) ? Number(coordinates[0]) : Number(sd.geo?.longitude);
  const familleEquipement = str(sd.equip_type_famille);

  return {
    name: str(sd.name) ?? "",
    category: str(sd.equip_type_name) ?? familleEquipement,
    categorie: str(sd.categorie),
    enqueteStatut: str(sd.enqueteStatut),
    installation: str(sd.inst_nom),
    sportPratiquer: str(sd.aps_name),
    dateCreation: toDate(sd.inst_date_creation),
    dateEnquete: toDate(sd.inst_enqu_date),
    lastUpdate: toDate(sd.equip_maj_date),
    familleEquipement,
    nature: str(sd.equip_nature),
    sol: str(sd.equip_sol),
    surface: str(sd.equip_surf),
    longueur: str(sd.equip_long),
    largeur: str(sd.equip_larg),
    eclairage: str(sd.equip_eclair),
    libreAccess: str(sd.equip_acc_libre),
    partenariat: str(sd.inst_part_bool),
    typePartenariat: str(sd.inst_part_type),
    equipPropNom: str(sd.equip_prop_nom),
    entrepriseFonciere: str(sd.equip_prop_type),
    equipGestType: str(sd.equip_gest_type),
    equipLocType: str(sd.equip_loc_type),
    equipUtilisateur: str(sd.equip_utilisateur),
    equipDouche: str(sd.equip_douche),
    handicap: str(sd.inst_acc_handi_bool),
    transportCommun: str(sd.inst_trans_bool),
    typeAccessiblHandicap: str(sd.inst_acc_handi_type),
    typeTransportCommun: str(sd.inst_trans_type),
    equipPmrAcc: str(sd.equip_pmr_acc),
    equipPmrChem: str(sd.equip_pmr_chem),
    equipPmrDouche: str(sd.equip_pmr_douche),
    equipPmrSanit: str(sd.equip_pmr_sanit),
    equipPmrTrib: str(sd.equip_pmr_trib),
    equipPmrVest: str(sd.equip_pmr_vest),
    equipPshsAire: str(sd.equip_pshs_aire),
    equipPshsChem: str(sd.equip_pshs_chem),
    equipPshsSanit: str(sd.equip_pshs_sanit),
    equipPshsTrib: str(sd.equip_pshs_trib),
    equipPshsVest: str(sd.equip_pshs_vest),
    equipPshsSign: str(sd.equip_pshs_sign),
    address: {
      streetAddress: str(address?.streetAddress),
      postalCode: str(address?.postalCode),
      addressLocality: str(address?.addressLocality),
      level1Name: str(address?.level1Name),
      addressCountry: str(address?.addressCountry),
    },
    geo:
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { latitude, longitude }
        : undefined,
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
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted/40 text-muted-foreground/60 line-through decoration-muted-foreground/40"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

/**
 * Contenu de détail « équipements / accessibilité » d'un POI (ex-`PoiDetailSSBE`).
 * Variante de contenu (`preview.type === "poi-amenities"`) rendue DANS le conteneur
 * de détail (`detailsMode` drawer/dialog) — découplée de la carte et du site.
 * Le composant borne sa propre hauteur (en-tête figé + corps scrollable).
 */
export default function PreviewPoiAmenities({ item, onClose }: PreviewProps) {
  useLoadNamespace("modules/search");
  const t = useT("modules/search");
  const { canEditProfile } = useProfilPermissions(item ?? null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const yesNo = (value?: string) =>
    value == null || value.trim() === ""
      ? "—"
      : isTrue(value)
        ? t("PreviewPoiAmenities.yes")
        : t("PreviewPoiAmenities.no");

  const poiEntity = item as Poi;
  const sd = poiEntity.serverData;
  const poi = toPoi(poiEntity);

  const imageUrl =
    sd.profilMediumImageUrl ||
    sd.profilThumbImageUrl ||
    sd.profilImageUrl ||
    (sd.profileImageUrl as string | undefined) ||
    (sd.image as string | undefined);
  const hasImage = Boolean(imageUrl);
  const imageSrc = imageUrl || getPoiImage(poi.category, poi.name);

  const years = yearsAgo(poi.dateCreation);
  const cityLine = [poi.address.postalCode, poi.address.addressLocality].filter(Boolean).join(" ");
  const surfaceValue = toNum(poi.surface);
  const surfaceLabel = surfaceValue !== undefined ? `${surfaceValue} m²` : poi.surface || "—";
  const longueurValue = toNum(poi.longueur);
  const longueurLabel = longueurValue !== undefined ? `${longueurValue} m` : poi.longueur || "—";
  const largeurValue = toNum(poi.largeur);
  const largeurLabel = largeurValue !== undefined ? `${largeurValue} m` : poi.largeur || "—";
  const hasGeo = Boolean(
    poi.geo && Number.isFinite(poi.geo.latitude) && Number.isFinite(poi.geo.longitude)
  );

  const handleEdit = () => {
    setEditModalOpen(true);
    onClose?.();
  };

  return (
    <>
      <div className="flex max-h-[90vh] flex-col">
        <div className="relative shrink-0 px-6 py-5" style={{ background: "var(--card-header-gradient)" }}>
          {canEditProfile && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleEdit}
              className="absolute right-14 top-3 text-primary-foreground hover:bg-white/15"
            >
              <Edit className="h-4 w-4" />
              {t("PreviewPoiAmenities.edit")}
            </Button>
          )}
          <div className="space-y-3 text-left">
            <div className="flex flex-wrap items-center gap-2">
              {poi.category && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-primary-foreground">
                  <Tag className="h-3.5 w-3.5" />
                  {poi.category}
                </span>
              )}
              {poi.enqueteStatut === "Validé" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-primary-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("PreviewPoiAmenities.validated")}
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold text-primary-foreground">
              {poi.name || t("PreviewPoiAmenities.fallbackTitle")}
            </h2>

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
                  {t("PreviewPoiAmenities.createdOn", undefined, { date: formatDateFr(poi.dateCreation) })}
                  {typeof years === "number" && years > 0 ? (
                    <span className="ml-1 opacity-80">
                      {" "}
                      {t("PreviewPoiAmenities.yearsAgo", undefined, { count: years })}
                    </span>
                  ) : null}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-6 p-6 pb-12 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-primary">
                  <Info className="h-5 w-5" />
                  <h2 className="text-base font-semibold">{t("PreviewPoiAmenities.sections.general")}</h2>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <InfoRow label={t("PreviewPoiAmenities.fields.category")} value={poi.category || "—"} />
                  <InfoRow label={t("PreviewPoiAmenities.fields.family")} value={poi.familleEquipement || "—"} />
                  <InfoRow label={t("PreviewPoiAmenities.fields.installation")} value={poi.installation || "—"} />
                  <div className="sm:col-span-2">
                    <InfoRow label={t("PreviewPoiAmenities.fields.sport")} value={poi.sportPratiquer || "—"} />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-primary">
                  <Users className="h-5 w-5" />
                  <h2 className="text-base font-semibold">{t("PreviewPoiAmenities.sections.management")}</h2>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <InfoRow label={t("PreviewPoiAmenities.fields.ownerName")} value={poi.equipPropNom || "—"} />
                  <InfoRow label={t("PreviewPoiAmenities.fields.ownerType")} value={poi.entrepriseFonciere || "—"} />
                  <InfoRow label={t("PreviewPoiAmenities.fields.managementType")} value={poi.equipGestType || "—"} />
                  <InfoRow label={t("PreviewPoiAmenities.fields.premises")} value={poi.equipLocType || "—"} />
                  <InfoRow label={t("PreviewPoiAmenities.fields.users")} value={poi.equipUtilisateur || "—"} />
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-primary">
                  <Accessibility className="h-5 w-5" />
                  <h2 className="text-base font-semibold">{t("PreviewPoiAmenities.sections.accessibility")}</h2>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Feature label={t("PreviewPoiAmenities.features.pmr")} active={isTrue(poi.handicap)} Icon={Accessibility} />
                  <Feature
                    label={t("PreviewPoiAmenities.features.transport")}
                    active={isTrue(poi.transportCommun)}
                    Icon={Bus}
                  />
                  <Feature label={t("PreviewPoiAmenities.features.lighting")} active={isTrue(poi.eclairage)} Icon={Lightbulb} />
                  <Feature label={t("PreviewPoiAmenities.features.freeAccess")} active={isTrue(poi.libreAccess)} Icon={Unlock} />
                  <Feature label={t("PreviewPoiAmenities.features.showers")} active={isTrue(poi.equipDouche)} Icon={Droplet} />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <InfoRow
                    label={t("PreviewPoiAmenities.fields.pmrType")}
                    value={poi.typeAccessiblHandicap || "—"}
                    muted
                  />
                  <InfoRow
                    label={t("PreviewPoiAmenities.fields.transportType")}
                    value={poi.typeTransportCommun || "—"}
                    muted
                  />
                </div>
                <div className="mt-6 space-y-4">
                  <div className="h-px bg-border/60" />
                  <div className="font-semibold text-base">
                    {t("PreviewPoiAmenities.sections.pmrDetails")}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoRow label={t("PreviewPoiAmenities.pmr.access")} value={yesNo(poi.equipPmrAcc)} muted />
                    <InfoRow label={t("PreviewPoiAmenities.pmr.path")} value={yesNo(poi.equipPmrChem)} muted />
                    <InfoRow label={t("PreviewPoiAmenities.pmr.showers")} value={yesNo(poi.equipPmrDouche)} muted />
                    <InfoRow label={t("PreviewPoiAmenities.pmr.toilets")} value={yesNo(poi.equipPmrSanit)} muted />
                    <InfoRow label={t("PreviewPoiAmenities.pmr.stands")} value={yesNo(poi.equipPmrTrib)} muted />
                    <InfoRow label={t("PreviewPoiAmenities.pmr.changing")} value={yesNo(poi.equipPmrVest)} muted />
                  </div>
                  <div className="h-px bg-border/60" />
                  <div className="font-semibold text-base">
                    {t("PreviewPoiAmenities.sections.pshsDetails")}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoRow label={t("PreviewPoiAmenities.pshs.playArea")} value={yesNo(poi.equipPshsAire)} muted />
                    <InfoRow label={t("PreviewPoiAmenities.pshs.path")} value={yesNo(poi.equipPshsChem)} muted />
                    <InfoRow label={t("PreviewPoiAmenities.pshs.toilets")} value={yesNo(poi.equipPshsSanit)} muted />
                    <InfoRow label={t("PreviewPoiAmenities.pshs.stands")} value={yesNo(poi.equipPshsTrib)} muted />
                    <InfoRow label={t("PreviewPoiAmenities.pshs.changing")} value={yesNo(poi.equipPshsVest)} muted />
                    <InfoRow label={t("PreviewPoiAmenities.pshs.signage")} value={yesNo(poi.equipPshsSign)} muted />
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              {hasImage && (
                <section className="overflow-hidden rounded-2xl">
                  <OptimizedImage
                    src={imageSrc}
                    alt={poi.name || t("PreviewPoiAmenities.fallbackTitle")}
                    width={320}
                    height={224}
                    className="h-56 w-full object-cover"
                  />
                </section>
              )}
              <section className="rounded-2xl border border-border bg-card/70 shadow-sm overflow-hidden">
                {hasGeo && poi.geo ? (
                  <ProfileMapLeaflet
                    lat={poi.geo.latitude}
                    lng={poi.geo.longitude}
                    height="200px"
                    zoom={15}
                    showMarker
                  />
                ) : (
                  <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                    {t("PreviewPoiAmenities.map.unavailable")}
                  </div>
                )}
              </section>
              <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-primary">
                  <MapPin className="h-5 w-5" />
                  <h2 className="text-base font-semibold">{t("PreviewPoiAmenities.sections.location")}</h2>
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
                  <Settings className="h-5 w-5" />
                  <h2 className="text-base font-semibold">{t("PreviewPoiAmenities.sections.technical")}</h2>
                </div>
                <div className="mt-4 divide-y divide-border/60 text-sm">
                  <div className="flex items-center justify-between gap-4 py-2">
                    <span className="text-muted-foreground">{t("PreviewPoiAmenities.fields.nature")}</span>
                    <span className="font-medium text-foreground">{poi.nature || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2">
                    <span className="text-muted-foreground">{t("PreviewPoiAmenities.fields.floor")}</span>
                    <span className="font-medium text-foreground">{poi.sol || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2">
                    <span className="text-muted-foreground">{t("PreviewPoiAmenities.fields.surface")}</span>
                    <span className="font-medium text-foreground">{surfaceLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2">
                    <span className="text-muted-foreground">{t("PreviewPoiAmenities.fields.length")}</span>
                    <span className="font-medium text-foreground">{longueurLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2">
                    <span className="text-muted-foreground">{t("PreviewPoiAmenities.fields.width")}</span>
                    <span className="font-medium text-foreground">{largeurLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2">
                    <span className="text-muted-foreground">{t("PreviewPoiAmenities.fields.partnership")}</span>
                    <span className="font-medium text-foreground">
                      {isTrue(poi.partenariat) ? poi.typePartenariat || t("PreviewPoiAmenities.yes") : t("PreviewPoiAmenities.no")}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-primary">
                  <History className="h-5 w-5" />
                  <h2 className="text-base font-semibold">{t("PreviewPoiAmenities.sections.tracking")}</h2>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <div className="text-xs text-muted-foreground">{t("PreviewPoiAmenities.tracking.created")}</div>
                      <div className="font-semibold text-foreground">
                        {formatDateFr(poi.dateCreation)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <div className="text-xs text-muted-foreground">{t("PreviewPoiAmenities.tracking.lastSurvey")}</div>
                      <div className="font-semibold text-foreground">
                        {formatDateFr(poi.dateEnquete)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <div className="text-xs text-muted-foreground">{t("PreviewPoiAmenities.tracking.lastUpdate")}</div>
                      <div className="font-semibold text-foreground">
                        {formatDateFr(poi.lastUpdate)}
                      </div>
                    </div>
                  </div>
                  {poi.enqueteStatut && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {poi.enqueteStatut}
                    </div>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>

      {canEditProfile && item && (
        <DynamicEditModal open={editModalOpen} onOpenChange={setEditModalOpen} entity={item} />
      )}
    </>
  );
}
