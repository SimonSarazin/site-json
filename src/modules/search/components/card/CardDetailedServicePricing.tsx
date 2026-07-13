import { useMemo } from "react";
import { Monitor, Users, BedDouble, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/hooks/useT";
import { SearchCardProps } from "../../schema";
import useItem from "../../hooks/useItem";
import { getBaseUrl } from "@/lib/constant/common";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import type { Answer, FormId } from "@communecter/cocolight-api-client";
import {
  buildServicePricingServices,
  buildServicePricingStats,
  extractServicePricingAnswers,
  servicePricingStatLabel,
  type ServicePricingStatKind,
} from "../../helpers/servicePricingAnswers";

const STAT_ICONS: Record<ServicePricingStatKind, LucideIcon> = {
  coworking: Monitor,
  meeting: Users,
  accommodation: BedDouble,
};

const SERVICE_NAME_KEY: Record<ServicePricingStatKind, string> = {
  coworking: "card.servicePricing.service.coworking",
  meeting: "card.servicePricing.service.meetingRoom",
  accommodation: "card.servicePricing.service.room",
};

export default function CardDetailedServicePricing({
  item,
  onClick,
  card,
}: SearchCardProps) {
  const t = useT("modules/search");
  const data = useItem(item);
  const { name, address, shortDescription, description } = data;

  const image = item?.serverData?.profilImageUrl;
  const ville = address?.addressLocality ?? "";
  const region = address?.level3Name ?? "";
  const fullDescription = shortDescription || description;
  const answers = item?.serverData?.answers as Record<FormId, Answer[]> | undefined;
  const servicePricingPaths = card?.servicePricing;

  // Vue détaillée : on n'affiche stats et services que pour les catégories
  // effectivement tarifées (`requirePrice: true`).
  const { stats, services } = useMemo(() => {
    const agg = extractServicePricingAnswers(answers, servicePricingPaths);
    return {
      stats: buildServicePricingStats(agg, { requirePrice: true }),
      services: buildServicePricingServices(agg),
    };
  }, [answers, servicePricingPaths]);

  return (
    <Card
      onClick={onClick}
      className="group hover:shadow-lg transition-all duration-300 cursor-pointer"
    >
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Image */}
          <div className="w-full md:w-48 h-48 shrink-0 relative overflow-hidden rounded-lg bg-muted">
            {image && (
              <OptimizedImage
                src={image.startsWith("http") ? image : `${getBaseUrl()}${image}`}
                alt={name}
                width={192}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Infos */}
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-foreground mb-1">{name}</h3>
            {(ville || region) && (
              <p className="text-sm text-muted-foreground">
                {ville}
                {ville && region ? ", " : ""}
                {region}
              </p>
            )}

            {fullDescription && (
              <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                {fullDescription}
              </p>
            )}

            {/* Stats (icônes colorées) */}
            {stats.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4">
                {stats.map((stat) => {
                  const Icon = STAT_ICONS[stat.kind];
                  const { key, params } = servicePricingStatLabel(stat);
                  const label = t(key, undefined, params);
                  return (
                    <div key={stat.kind} className="flex items-center gap-1.5 text-primary text-sm font-medium">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tableau des services / tarifs */}
          {services.length > 0 && (
            <div className="w-full md:w-80 shrink-0 self-start rounded-lg border border-border divide-y divide-border overflow-hidden">
              {services.map((service) => (
                <div key={service.kind} className="flex items-start justify-between gap-4 px-4 py-3">
                  <span className="text-sm font-semibold text-primary shrink-0">
                    {t(SERVICE_NAME_KEY[service.kind])}
                  </span>
                  <span className="text-sm text-muted-foreground text-right">
                    {t("card.servicePricing.priceFrom", undefined, {
                      price: t(`card.servicePricing.price.${service.unit}`, undefined, { price: service.price }),
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
