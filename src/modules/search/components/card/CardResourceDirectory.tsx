import { useMemo } from "react";
import { Link } from "react-router";
import { Monitor, Users, BedDouble, MapPin, Building2, Euro, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { SearchCardProps } from "../../schema";
import { parseResourceDirectoryItem, type ResourceKind } from "../../lib/resourceDirectory";
import { formatCapacityRange } from "../../helpers/servicePricingAnswers";
import {
  useResourceDirectoryActions,
  useResourceParentsMap,
} from "../../contexts/resourceDirectory";
import { ResourcePhotoCarousel } from "../ResourcePhotoCarousel";

const KIND_ICON: Record<ResourceKind, LucideIcon> = {
  coworking: Monitor,
  meeting: Users,
  accommodation: BedDouble,
};

/**
 * Carte d'une ressource de tiers-lieu (`card.type: "resource-directory"`) —
 * suit `tlCardRessourcePanelHtml` (JS costum) : NOM de la ressource en titre,
 * localité, CAPACITÉ (postes / min-max pers. / chambres) + TARIF « à partir de »,
 * et le tiers-lieu PORTEUR en pied. Les équipements ne sont montrés qu'au détail.
 * Logique pure : `lib/resourceDirectory.ts`.
 */
export default function CardResourceDirectory({ item, onClick, list }: SearchCardProps) {
  useLoadNamespace("modules/search");
  const t = useT("modules/search");
  const conf = list?.resourceDirectory;
  const serverData = item?.serverData as Record<string, unknown> | undefined;
  const parentsMap = useResourceParentsMap();
  const actions = useResourceDirectoryActions();

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

  const typeConf = conf.resourceTypes.find((rt) => rt.id === model.type?.id);
  const parent = model.parent ? parentsMap?.get(model.parent.id) : undefined;
  const parentName = parent?.name ?? model.parent?.name;
  const KindIcon = model.type ? KIND_ICON[model.type.kind] : Building2;

  const name =
    model.name ??
    (model.nameFallback ? t(model.nameFallback.key, undefined, model.nameFallback.params) : undefined) ??
    parentName ??
    t("resourceDirectory.unknownPlace");

  const locality = [parent?.streetAddress, parent?.postalCode, parent?.addressLocality]
    .filter(Boolean)
    .join(" ");
  const images = model.photos.length > 0 ? model.photos : parent?.imageUrl ? [parent.imageUrl] : [];

  const stat = model.stats[0];
  const capacityLabel = stat ? capacityText(t, stat) : null;
  const service = model.services[0];
  const priceLabel = service
    ? t("card.servicePricing.priceFrom", undefined, {
        price: t(`card.servicePricing.price.${service.unit}`, undefined, { price: service.price }),
      })
    : null;

  return (
    <article
      onClick={onClick}
      className="flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-md transition-shadow hover:shadow-lg"
    >
      <ResourcePhotoCarousel
        images={images}
        alt={name}
        heightClass="h-40"
        autoPlay
        controls="none"
        fallback={<KindIcon className="h-10 w-10 opacity-40" />}
        overlay={
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            {typeConf && (
              <Badge className="absolute left-3 top-3 gap-1 rounded-full border-0 bg-primary text-primary-foreground hover:bg-primary">
                <KindIcon className="h-3.5 w-3.5" />
                {t(typeConf.label)}
              </Badge>
            )}
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2">{name}</h3>

        {locality && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{locality}</span>
          </p>
        )}

        {(capacityLabel || priceLabel) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-foreground">
            {capacityLabel && (
              <span className="inline-flex items-center gap-1">
                <KindIcon className="h-3.5 w-3.5 text-primary" />
                {capacityLabel}
              </span>
            )}
            {priceLabel && (
              <span className="inline-flex items-center gap-1">
                <Euro className="h-3.5 w-3.5 text-primary" />
                {priceLabel}
              </span>
            )}
          </p>
        )}

        {parentName && (
          <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
            <Avatar className="h-7 w-7">
              {parent?.imageUrl && <AvatarImage src={parent.imageUrl} alt={parentName} className="object-cover" />}
              <AvatarFallback className="bg-muted">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            {actions && model.parent ? (
              <button
                type="button"
                title={t("resourceDirectory.filterByParent", undefined, { name: parentName })}
                onClick={(e) => {
                  e.stopPropagation();
                  actions.setActiveParent({ id: model.parent!.id, name: parentName });
                }}
                className="min-w-0 truncate text-left text-xs text-muted-foreground hover:text-primary hover:underline"
              >
                {t("resourceDirectory.by", undefined, { name: parentName })}
              </button>
            ) : (
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {t("resourceDirectory.by", undefined, { name: parentName })}
              </span>
            )}
            {parent?.slug && (
              <Link
                to={`/profil/${parent.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="ml-auto shrink-0 text-xs font-medium text-primary hover:underline"
              >
                {t("resourceDirectory.viewPlace")}
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/** Libellé de capacité au format legacy : « N postes » / « min–max pers. » / « N chambres ». */
function capacityText(
  t: ReturnType<typeof useT>,
  stat: { kind: "coworking" | "meeting" | "accommodation"; count: number; range?: { min: number; max: number } },
): string | null {
  if (stat.kind === "meeting") {
    const range = formatCapacityRange(stat.range ?? { min: 0, max: 0 });
    return range ? t("resourceDirectory.capacityMeeting", undefined, { range }) : null;
  }
  if (stat.count <= 0) return null;
  const key =
    stat.kind === "coworking"
      ? "resourceDirectory.capacityCoworking"
      : "resourceDirectory.capacityAccommodation";
  return t(key, undefined, { count: stat.count });
}
