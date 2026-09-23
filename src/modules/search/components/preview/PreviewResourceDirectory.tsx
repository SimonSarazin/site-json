import { useMemo } from "react";
import { Link } from "react-router";
import { Users, MapPin, ArrowUpRight, Building2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { PreviewProps } from "../../schema";
import { parseResourceDirectoryItem } from "../../lib/resourceDirectory";
import { formatCapacityRange } from "../../helpers/servicePricingAnswers";
import { useResourceParentsMap } from "../../contexts/resourceDirectory";
import { ResourcePhotoCarousel } from "../ResourcePhotoCarousel";

/** Prépend `https://` si l'URL n'a pas de schéma (et n'est pas un e-mail) — cf. preview legacy. */
function externalUrl(raw: string): string {
  return /^https?:\/\//i.test(raw) || raw.includes("@") ? raw : `https://${raw}`;
}

/** `"30"` → `"30 m²"` ; `"30 m²"` → inchangé. */
function areaLabel(area: string): string {
  return /m²|m2|\bm\b/i.test(area) ? area : `${area} m²`;
}

function isYes(v: string | undefined): boolean {
  return !!v && !/^(non|no|false|0)$/i.test(v.trim());
}

/**
 * Détail d'une ressource de tiers-lieu (`preview.type: "resource-directory"`).
 * Même présentation que le modal « En savoir plus » d'un tiers-lieu
 * (`ProfilTiersLieuxAbout`) : carrousel + pastille de capacité, puis nom, tarifs
 * (pastilles), surface, « À propos », équipements, services. Bouton d'action :
 * « Réserver » (lien de résa en ligne) OU « Contacter par e-mail » (`mailto:` de
 * l'e-mail du tiers-lieu) si pas de lien ; toujours « Voir le tiers-lieu ». Pas
 * d'étiquette de type. Adapté aux jetons de thème (clair + sombre).
 */
export default function PreviewResourceDirectory({ item, list }: PreviewProps) {
  useLoadNamespace("modules/search");
  const t = useT("modules/search");
  const conf = list?.resourceDirectory;
  const serverData = item?.serverData as Record<string, unknown> | undefined;
  const parentsMap = useResourceParentsMap();

  const model = useMemo(
    () =>
      conf
        ? parseResourceDirectoryItem(serverData, {
            resourceTypes: conf.resourceTypes,
            finderSuffix: conf.finderSuffix,
            fieldSuffixes: { finder: conf.finderSuffix, ...conf.fieldSuffixes },
          })
        : null,
    [conf, serverData],
  );

  if (!conf || !model) return null;

  const parent = model.parent ? parentsMap?.get(model.parent.id) : undefined;
  const parentName = parent?.name ?? model.parent?.name;
  const room = model.rooms[0];

  const name =
    model.name ??
    (model.nameFallback ? t(model.nameFallback.key, undefined, model.nameFallback.params) : undefined) ??
    parentName ??
    t("resourceDirectory.unknownPlace");

  const locality = [parent?.streetAddress, parent?.postalCode, parent?.addressLocality]
    .filter(Boolean)
    .join(" ");
  const images = model.photos.length > 0 ? model.photos : parent?.imageUrl ? [parent.imageUrl] : [];
  const area = model.area || room?.area || "";
  const solidaire = isYes(room?.solidaire);
  // Pas de lien de réservation en ligne mais un e-mail de tiers-lieu connu :
  // `mailto:` (objet pré-rempli, corps laissé au visiteur).
  const mailtoHref =
    !model.bookingUrl && model.parentEmail
      ? `mailto:${model.parentEmail}?subject=${encodeURIComponent(
          t("resourceDirectory.mailtoSubject", undefined, { name }),
        )}`
      : null;

  // Pastille de capacité — même logique que le badge des cartes de salle du profil.
  const stat = model.stats[0];
  let capacityBadge: string | null = null;
  if (stat) {
    if (stat.kind === "meeting") {
      const range = formatCapacityRange(stat.range ?? { min: 0, max: 0 });
      capacityBadge = range ? `${range} ${t("resourceDirectory.statPeople")}` : null;
    } else if (stat.count > 0) {
      capacityBadge = `${stat.count} ${
        stat.kind === "coworking" ? t("resourceDirectory.statDesks") : t("resourceDirectory.statRooms")
      }`;
    }
  }

  return (
    <div className="grid max-h-[90vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      {/* Carrousel d'images + pastille capacité */}
      <div className="relative h-56 overflow-hidden bg-muted">
        <ResourcePhotoCarousel
          images={images}
          alt={name}
          heightClass="h-56"
          arrowSize="lg"
          fallback={<Users className="h-14 w-14 text-muted-foreground/30" />}
        />
        {capacityBadge && (
          <span className="absolute right-3 top-3 z-10 rounded bg-background/90 px-2 py-1 text-xs text-foreground shadow">
            {capacityBadge}
          </span>
        )}
      </div>

      {/* Contenu */}
      <div className="space-y-4 overflow-y-auto p-5 scrollbar-thin">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">{name}</h3>
          {parentName && (
            <p className="text-sm text-muted-foreground">
              {t("resourceDirectory.by", undefined, { name: parentName })}
            </p>
          )}
          {locality && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {locality}
            </p>
          )}
        </div>

        {/* Tarifs — pastilles */}
        {(model.prices.length > 0 || solidaire) && (
          <div className="flex flex-wrap gap-2">
            {model.prices.map((p) => (
              <span
                key={p.unit}
                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
              >
                {p.price}€{" "}
                <span className="font-normal text-muted-foreground">
                  {t(`resourceDirectory.priceSuffix.${p.unit}`)}
                </span>
              </span>
            ))}
            {solidaire && (
              <span className="inline-flex items-center rounded-md bg-secondary/15 px-3 py-1 text-sm font-medium text-foreground">
                {t("resourceDirectory.solidaire")}
              </span>
            )}
          </div>
        )}

        {/* Surface */}
        {area && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{t("resourceDirectory.area")}</span>{" "}
            {areaLabel(area)}
          </p>
        )}

        {/* À propos */}
        {model.description && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{t("resourceDirectory.about")}</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {model.description}
            </p>
          </div>
        )}

        {/* Équipements */}
        {model.equipments.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{t("resourceDirectory.equipments")}</p>
            <div className="flex flex-wrap gap-1.5">
              {model.equipments.map((eq) => (
                <span key={eq} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {eq}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Services proposés */}
        {model.extraServices.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{t("resourceDirectory.services")}</p>
            <div className="flex flex-wrap gap-1.5">
              {model.extraServices.map((s) => (
                <span key={s} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {(model.bookingUrl || mailtoHref || parent?.slug) && (
          <div className="space-y-2 pt-1">
            {model.bookingUrl ? (
              <Button
                className="w-full"
                onClick={() => window.open(externalUrl(model.bookingUrl!), "_blank", "noopener,noreferrer")}
              >
                {t("resourceDirectory.book")}
                <ArrowUpRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : mailtoHref ? (
              <Button asChild className="w-full">
                <a href={mailtoHref}>
                  <Mail className="mr-1.5 h-4 w-4" />
                  {t("resourceDirectory.contactByEmail")}
                </a>
              </Button>
            ) : null}
            {parent?.slug && (
              <Button asChild variant="outline" className="w-full text-foreground">
                <Link to={`/profil/${parent.slug}`}>
                  <Building2 className="mr-1.5 h-4 w-4" />
                  {t("resourceDirectory.viewPlace")}
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
