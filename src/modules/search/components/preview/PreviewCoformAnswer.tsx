import { useCocolight } from "@/hooks/useCocolight";
import { Accessibility, Calendar, Clock, Heart, Mail, MapPin, Phone, User, Users } from "lucide-react";
import type { PreviewProps } from "../../schema";

type ActivityStatus = "Valide" | "En attente" | "En cours" | "Refuse";

type Schedule = {
  day: string;
  times: string[];
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
 * NB (couplage à découpler — niveau 2) : les IDs de champs CoForm et le repli
 * `sportSanteBienetre` restent codés en dur ici ; à externaliser en config
 * (mapping de champs) dans un chantier dédié.
 */
export default function PreviewCoformAnswer({ item }: PreviewProps) {
  const { entity } = useCocolight();
  const serverData = item?.serverData as Record<string, unknown> | undefined;

  if (!serverData) {
    return null;
  }

  const slug = entity?.serverData?.slug;
  const keyPrefix = slug ?? "sportSanteBienetre";
  const fieldKey = (suffix: string) => `${keyPrefix}${suffix}`;

  const title = (serverData.name as string | undefined)
    ?? (serverData[fieldKey("2172025_854_0mdegc9sgox76p87n27")] as string | undefined)
    ?? "(Pas de titre)";

  const description = (serverData[fieldKey("2172025_854_0mdeggo91owe8t9ovl4p")] as string | undefined)
    ?? "(Pas de description)";

  const typeRaw = (serverData[fieldKey("2172025_854_0mdn1cs8on3yru1p80lq")] as string | undefined) ?? "";

  const stateRaw = (serverData[fieldKey("2172025_854_0mdn1jcq445i0mb9bap7")] as string | undefined) ?? "";
  const status = normalizeStatus(stateRaw);

  const instructorFirstName =
    (serverData[fieldKey("2172025_854_0mdmz5fbxxtvelsircg9")] as string | undefined) ?? "";
  const instructorLastName =
    (serverData[fieldKey("2172025_854_0mdmz4qoaelvlcpten8w")] as string | undefined) ?? "";

  const typeActivity =
    (serverData[fieldKey("2172025_854_0mdegdo93f77wi3y186s")] as string | undefined) ?? title;
  const typeGender =
    (serverData[fieldKey("2172025_854_0mdmya4gmezjilnyjj5f")] as string | undefined) ?? "";

  const beneficiariesRaw =
    (serverData[fieldKey("2172025_854_0mdmyf2gky9capf1vcfl")] as unknown[]) ?? [];
  const beneficiaries = beneficiariesRaw
    .map((value) => (typeof value === "string" ? value : String(value)))
    .filter(Boolean);

  const mobilityReduced =
    (serverData[fieldKey("2172025_854_0mdmy67hlexyn92fh98s")] as string | undefined) ?? "";

  const landmark = (serverData[fieldKey("2172025_854_0mdmxv88txy6f5z6svg")] as string | undefined) ?? "";
  const addressObj = serverData[fieldKey("2172025_854_0mdr0xcsmmpnr6ez17q")] as Record<string, unknown> | undefined;
  const addressLine = (addressObj?.address as string | undefined) ?? "";

  const placesRaw = (serverData[fieldKey("2172025_854_0mdmxe3qhkjb9qu74wli")] as unknown[]) ?? [];
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

  const installationFinderKey = `finder${fieldKey("2172025_854_0mocno9muqzznoo0gyx")}`;
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

  const scheduleRaw = (serverData[fieldKey("2172025_854_0mdefmehl5baa207uud6")] as unknown[]) ?? [];
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
              {stateRaw || "Validé"}
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
            <InfoCard icon={MapPin} title="Adresse">
              {addressParts.length > 0 ? (
                <div className="text-sm text-muted-foreground space-y-1">
                  {addressParts.map((line, index) => (
                    <p key={`${line}-${index}`}>{line}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">(Adresse non renseignée)</p>
              )}
            </InfoCard>

            <InfoCard icon={Phone} title="Contact">
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

          <InfoCard icon={Calendar} title="Créneaux horaires">
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
                <p className="text-xs text-muted-foreground">Aucun créneau</p>
              )}
            </div>
          </InfoCard>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoCard icon={Heart} title="Activité">
              <p className="text-sm font-semibold text-foreground">{typeActivity || title}</p>
              <p className="text-xs text-muted-foreground">{typeGender || typeRaw}</p>
            </InfoCard>

            <InfoCard icon={Users} title="Bénéficiaires">
              {beneficiaries.length > 0 ? (
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  {beneficiaries.map((beneficiary, index) => (
                    <li key={`${beneficiary}-${index}`}>{beneficiary}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Aucun bénéficiaire renseigné</p>
              )}
            </InfoCard>

            <InfoCard icon={Accessibility} title="Accessibilité">
              <p className="text-sm text-foreground font-semibold">Personne à mobilité réduite</p>
              <span className="inline-block rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                {mobilityReduced || "Non renseigné"}
              </span>
            </InfoCard>

            <InfoCard icon={MapPin} title="Installation">
              {installations.length > 0 ? (
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  {installations.map((installation) => (
                    <li key={installation.id}>{installation.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Aucune installation renseignée</p>
              )}
            </InfoCard>
          </div>
        </div>
      </div>
    </div>
  );
}
