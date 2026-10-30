import { useMemo } from "react";
import { Link } from "react-router";
import { MapPin, ArrowUpRight, Building2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { getBaseUrl } from "@/lib/constant/common";
import type { PreviewProps } from "../../schema";
import { parseResourceDirectoryItem, resolveAnswerDetails, resolveAnswerType } from "../../lib/resourceDirectory";
import { resourceDisplayName } from "../../lib/resourceDirectorySearch";
import { formatCapacityRange } from "../../helpers/servicePricingAnswers";
import { useResourceParentsMap } from "../../contexts/resourceDirectory";
import { ResourceDetail } from "./resource/ResourceDetail";

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
 * Même composant que le détail d'une ressource sur la fiche du lieu (`ResourceDetail`,
 * partagé avec `ProfilTiersLieuxAbout`), avec en plus le porteur et son adresse. Bouton d'action :
 * « Réserver » (lien de résa en ligne) OU « Réserver par e-mail » (`mailto:` de
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
            baseUrl: getBaseUrl(),
          })
        : null,
    [conf, serverData],
  );

  if (!conf || !model) return null;

  // Champs du détail déclarés pour ce type (`detailSuffixes`) : mêmes blocs et libellés que la fiche
  // du lieu. Sinon, rendu historique (équipements / services / à propos de l'annuaire). Sans `useMemo` :
  // `t` (`useT`) change à chaque rendu, le memo recalculerait de toute façon.
  const details = resolveAnswerDetails(serverData, resolveAnswerType(serverData, conf.resourceTypes), (key) =>
    t(`resourceDirectory.detail.${key}`),
  );

  const parent = model.parent ? parentsMap?.get(model.parent.id) : undefined;
  const parentName = parent?.name ?? model.parent?.name;
  const room = model.rooms[0];

  const name = resourceDisplayName(model, t, parentName);

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
    <ResourceDetail
      name={name}
      images={images}
      capacityLabel={capacityBadge}
      subtitle={
        <>
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
        </>
      }
      prices={model.prices.map((p) => ({ amount: p.price, suffix: t(`resourceDirectory.priceSuffix.${p.unit}`) }))}
      solidarityLabel={solidaire ? t("resourceDirectory.detail.solidarity") : null}
      area={area ? { label: t("resourceDirectory.detail.area"), value: areaLabel(area) } : null}
      tags={
        details
          ? details.tags
          : [
              { label: t("resourceDirectory.equipments"), values: model.equipments },
              { label: t("resourceDirectory.services"), values: model.extraServices },
            ].filter((g) => g.values.length > 0)
      }
      notes={
        details
          ? details.notes
          : model.description
            ? [{ label: t("resourceDirectory.about"), value: model.description, plainText: true }]
            : []
      }
      actions={
        (model.bookingUrl || mailtoHref || parent?.slug) && (
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
        )
      }
    />
  );
}
