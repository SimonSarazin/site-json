import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { Accessibility, Calendar, Clock, Heart, Mail, MapPin, Phone, User, Users } from "lucide-react";
import type { PreviewProps } from "../../schema";

type ActivityStatus = "Valide" | "En attente" | "En cours" | "Refuse";

type Schedule = {
  day: string;
  times: string[];
};

/**
 * Mapping rôle → suffixe de champ CoForm (par défaut : formulaire activité SSBE).
 * Surchargeable par config via `preview.fields` → le composant n'est plus
 * hardwiré à un formulaire précis (niveau 2 : découplage des IDs de champs).
 */
const DEFAULT_FIELDS: Record<string, string> = {
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

function getStatusStyle(status: ActivityStatus) {
  switch (status) {
    case "Valide":
      return "bg-badge-valid text-primary-foreground";
    case "En attente":
      return "bg-badge-waiting text-primary-foreground";
    case "En cours":
      return "bg-badge-in-progress text-primary-foreground";
    case "Refuse":
      return "bg-badge-refused text-primary-foreground";
    default:
      return "bg-badge-valid text-primary-foreground";
  }
}

function normalizeStatus(rawStatus: string): ActivityStatus {
  if (rawStatus === "En attente" || rawStatus === "En cours") {
    return rawStatus;
  }
  if (rawStatus === "Refuse" || rawStatus === "Réfusé") {
    return "Refuse";
  }
  return "Valide";
}

function translateDayToFrench(day: string): string {
  const dayMap: Record<string, string> = {
    monday: "Lundi",
    tuesday: "Mardi",
    wednesday: "Mercredi",
    thursday: "Jeudi",
    friday: "Vendredi",
    saturday: "Samedi",
    sunday: "Dimanche",
  };

  return dayMap[day.trim().toLowerCase()] ?? day;
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wide">
        <Icon className="w-4 h-4 shrink-0" />
        {title}
      </div>
      {children}
    </div>
  );
}

/**
 * Contenu de détail « réponse CoForm » (activité avec horaires / structure)
 * — ex-`AnswerDetailModeDialog`. Variante de contenu (`preview.type ===
 * "coform-answer"`) rendue DANS le conteneur de détail (`detailsMode`).
 *
 * Découplage : libellés via i18n, IDs de champs via `DEFAULT_FIELDS`
 * (surchargeables par `preview.fields`). Le repli de slug (entité sans slug)
 * reste un défaut générique.
 */
export default function PreviewCoformAnswer({ item, preview }: PreviewProps) {
  useLoadNamespace("modules/search");
  const t = useT("modules/search");
  const { entity } = useCocolight();
  const serverData = item?.serverData as Record<string, unknown> | undefined;

  if (!serverData) {
    return null;
  }

  const fields: Record<string, string> = { ...DEFAULT_FIELDS, ...(preview?.fields ?? {}) };
  const slug = entity?.serverData?.slug;
  const keyPrefix = slug ?? "sportSanteBienetre";
  const fieldKey = (suffix: string) => `${keyPrefix}${suffix}`;

  const title = (serverData.name as string | undefined)
    ?? (serverData[fieldKey(fields.title)] as string | undefined)
    ?? t("PreviewCoformAnswer.noTitle");

  const description = (serverData[fieldKey(fields.description)] as string | undefined)
    ?? t("PreviewCoformAnswer.noDescription");

  const typeRaw = (serverData[fieldKey(fields.type)] as string | undefined) ?? "";

  const stateRaw = (serverData[fieldKey(fields.state)] as string | undefined) ?? "";
  const status = normalizeStatus(stateRaw);

  const instructorFirstName =
    (serverData[fieldKey(fields.instructorFirstName)] as string | undefined) ?? "";
  const instructorLastName =
    (serverData[fieldKey(fields.instructorLastName)] as string | undefined) ?? "";

  const typeActivity =
    (serverData[fieldKey(fields.typeActivity)] as string | undefined) ?? title;
  const typeGender =
    (serverData[fieldKey(fields.typeGender)] as string | undefined) ?? "";

  const beneficiariesRaw =
    (serverData[fieldKey(fields.beneficiaries)] as unknown[]) ?? [];
  const beneficiaries = beneficiariesRaw
    .map((value) => (typeof value === "string" ? value : String(value)))
    .filter(Boolean);

  const mobilityReduced =
    (serverData[fieldKey(fields.mobilityReduced)] as string | undefined) ?? "";

  const landmark = (serverData[fieldKey(fields.landmark)] as string | undefined) ?? "";
  const addressObj = serverData[fieldKey(fields.address)] as Record<string, unknown> | undefined;
  const addressLine = (addressObj?.address as string | undefined) ?? "";

  const placesRaw = (serverData[fieldKey(fields.places)] as unknown[]) ?? [];
  const firstPlace = placesRaw[0] as Record<string, unknown> | undefined;
  const placeName = (firstPlace?.placeName as string | undefined) ?? "";
  const postalCode = (firstPlace?.postalCode as string | undefined) ?? "";

  const cleanPlaceName = placeName
    .replace(/la reunion/gi, "")
    .replace(/la réunion/gi, "")
    .trim();

  const addressParts = [landmark, addressLine, cleanPlaceName, postalCode ? `${postalCode}, La Réunion` : ""]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());

  const structureRaw = serverData.structure as Record<string, unknown> | undefined;
  const structureEmail = (structureRaw?.email as string | undefined) ?? "";
  const telephoneObj = structureRaw?.telephone as Record<string, unknown> | undefined;
  const structurePhone =
    (telephoneObj?.mobile as string | undefined)
    ?? (telephoneObj?.fixe as string | undefined)
    ?? (structureRaw?.phone as string | undefined)
    ?? "";

  const installationFinderKey = `finder${fieldKey(fields.installationFinder)}`;
  const installationsRaw = serverData[installationFinderKey] as unknown;
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
      return {
        id: id || name || String(index),
        name: name || id || "",
      };
    })
    .filter((entry) => entry.name.trim().length > 0);

  const scheduleRaw = (serverData[fieldKey(fields.schedule)] as unknown[]) ?? [];
  const groupedSchedules: Record<string, string[]> = {};

  scheduleRaw.forEach((entry) => {
    const slot = entry as Record<string, unknown>;
    const day = typeof slot.day === "string" ? translateDayToFrench(slot.day) : "";
    if (!day) return;

    const startHour = String(slot.startHour ?? "");
    const startMinute = String(slot.startMinute ?? "");
    const endHour = String(slot.endHour ?? "");
    const endMinute = String(slot.endMinute ?? "");
    const timeRange = `${startHour}H${startMinute} - ${endHour}H${endMinute}`;

    if (!groupedSchedules[day]) {
      groupedSchedules[day] = [];
    }
    groupedSchedules[day].push(timeRange);
  });

  const schedules: Schedule[] = Object.entries(groupedSchedules).map(([day, times]) => ({ day, times }));

  return (
    <div className="flex max-h-[90vh] flex-col">
      <div className="shrink-0 px-6 py-5" style={{ background: "var(--card-header-gradient)" }}>
        <div className="space-y-2 text-left">
          <div className="flex items-center gap-2">
            {typeRaw && (
              <span className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                {typeRaw}
              </span>
            )}
            <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${getStatusStyle(status)}`}>
              {stateRaw || t("PreviewCoformAnswer.validated")}
            </span>
          </div>
          <h2 className="text-2xl font-bold uppercase text-primary-foreground tracking-wide">
            {title}
          </h2>
        </div>
        <p className="mt-3 text-sm text-primary-foreground/85 leading-relaxed">{description}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoCard icon={MapPin} title={t("PreviewCoformAnswer.address")}>
              {addressParts.length > 0 ? (
                <div className="text-sm text-muted-foreground space-y-1">
                  {addressParts.map((line, index) => (
                    <p key={`${line}-${index}`}>{line}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("PreviewCoformAnswer.addressEmpty")}</p>
              )}
            </InfoCard>

            <InfoCard icon={Phone} title={t("PreviewCoformAnswer.contact")}>
              {structureEmail && (
                <p className="text-sm text-foreground font-semibold break-all flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  {structureEmail}
                </p>
              )}
              {structurePhone && (
                <p className="text-sm text-foreground font-semibold">{structurePhone}</p>
              )}
              {(instructorFirstName || instructorLastName) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3 shrink-0" />
                  {instructorFirstName} {instructorLastName}
                </p>
              )}
            </InfoCard>
          </div>

          <InfoCard icon={Calendar} title={t("PreviewCoformAnswer.schedule")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1">
              {schedules.length > 0 ? (
                schedules.map((schedule) => (
                  <div
                    key={schedule.day}
                    className="flex items-start gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs border border-border"
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0 text-primary mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">{schedule.day}</span>
                      <p className="text-muted-foreground mt-0.5 leading-relaxed">
                        {schedule.times.join(" / ")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">{t("PreviewCoformAnswer.scheduleEmpty")}</p>
              )}
            </div>
          </InfoCard>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoCard icon={Heart} title={t("PreviewCoformAnswer.activity")}>
              <p className="text-sm font-semibold text-foreground">{typeActivity || title}</p>
              <p className="text-xs text-muted-foreground">{typeGender || typeRaw}</p>
            </InfoCard>

            <InfoCard icon={Users} title={t("PreviewCoformAnswer.beneficiaries")}>
              {beneficiaries.length > 0 ? (
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  {beneficiaries.map((beneficiary, index) => (
                    <li key={`${beneficiary}-${index}`}>{beneficiary}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">{t("PreviewCoformAnswer.beneficiariesEmpty")}</p>
              )}
            </InfoCard>

            <InfoCard icon={Accessibility} title={t("PreviewCoformAnswer.accessibility")}>
              <p className="text-sm text-foreground font-semibold">{t("PreviewCoformAnswer.reducedMobility")}</p>
              <span className="inline-block rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                {mobilityReduced || t("PreviewCoformAnswer.notProvided")}
              </span>
            </InfoCard>

            <InfoCard icon={MapPin} title={t("PreviewCoformAnswer.installation")}>
              {installations.length > 0 ? (
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  {installations.map((installation) => (
                    <li key={installation.id}>{installation.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">{t("PreviewCoformAnswer.installationEmpty")}</p>
              )}
            </InfoCard>
          </div>
        </div>
      </div>
    </div>
  );
}
