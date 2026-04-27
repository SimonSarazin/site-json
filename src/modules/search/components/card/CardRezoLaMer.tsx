import { SearchCardProps } from "../../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { cn } from "@/lib/utils";
import { getEntityIcon } from "@/lib/entityIcons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MapPin, Users, ArrowRight } from "lucide-react";

export default function CardRezoLaMer({
  item,
  onClick,
  card,
  fundingByProjectId,
}: SearchCardProps) {
  const serverData = item?.serverData;
  const entityType = item?.getEntityType?.() || "";
  const projectId = String(serverData?.id || item?.id || "").trim();

  const image = serverData?.profilImageUrl;
  const title = serverData?.name;
  const description = serverData?.shortDescription || serverData?.description;
  const location = getLocation(item);
  const avatarIcon = getEntityIcon(entityType, "w-16 h-16 text-muted-foreground/50");
  const tags = serverData?.tags || [];
  const category = tags.length > 0 ? String(tags[0]) : "Pas de tags";
  const fundingFromMap = projectId ? fundingByProjectId?.[projectId] : undefined;
  const status = getStatus(serverData, fundingFromMap);
  const links = serverData?.links as Record<string, Record<string, unknown>> | undefined;
  const contributors = links?.contributors ? Object.keys(links.contributors).length : 0;
  const funding = getFunding(serverData, fundingFromMap);
  const hasRealFunding = !!fundingFromMap || Number.isFinite(Number(serverData?.fundingGoal)) || Number.isFinite(Number(serverData?.goal)) || Number.isFinite(Number(serverData?.fundingRaised)) || Number.isFinite(Number(serverData?.raised)) || Number.isFinite(Number(serverData?.collected));
  const displayDescription = description ? String(description) : "Pas de description";
  
  return (
    <article
      onClick={onClick}
      className="group bg-card rounded-2xl border border-border overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer"
    >
      <div className="relative aspect-16/10 overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={title || ""}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-secondary/30 flex items-center justify-center">
            {avatarIcon}
          </div>
        )}
        <Badge
          className={cn(
            "absolute top-4 left-4",
            status === "Financé" ? "bg-green-500" : "bg-primary text-primary-foreground"
          )}
        >
          {status}
        </Badge>
      </div>

      <div className="p-6">
        {category && (
          <Badge variant="outline" className="mb-3 border-primary/30 text-primary">
            {category}
          </Badge>
        )}
        <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-1">
          {title}
        </h3>
        {card?.showDescription !== false && (
          <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
            {displayDescription}
          </p>
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {contributors}
          </span>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            {hasRealFunding ? (
              <>
                <span className="font-semibold text-foreground">
                  {funding.raised.toLocaleString()} €
                </span>
                <span className="text-muted-foreground">
                  sur {funding.goal.toLocaleString()} €
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Donnée non disponible</span>
            )}
          </div>
          <Progress value={hasRealFunding ? funding.percentage : 0} className="h-2" />
        </div>

        <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0">
          Voir le projet
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </article>
  );
}

function getLocation(item: SearchEntity): string | null {
  const serverData = item?.serverData;

  if (serverData?.address?.addressLocality) {
    return serverData.address.addressLocality;
  }

  if ((serverData?.address as Record<string, unknown> | undefined)?.codePostal) {
    return String((serverData!.address as Record<string, unknown>).codePostal);
  }

  return null;
}

function getStatus(
  serverData: Record<string, unknown> | undefined,
  fundingFromMap?: { goal: number; raised: number; percentage: number }
): string {
  if (!serverData) return "En cours";

  if (serverData.status) {
    return String(serverData.status);
  }

  const funding = getFunding(serverData, fundingFromMap);
  if (funding.percentage >= 100) {
    return "Financé";
  }

  return "En cours";
}

function getFunding(
  serverData: Record<string, unknown> | undefined,
  fundingFromMap?: { goal: number; raised: number; percentage: number }
): { goal: number; raised: number; percentage: number } {
  const goal = Number(fundingFromMap?.goal) || Number(serverData?.fundingGoal) || Number(serverData?.goal) || 0;
  const raised = Number(fundingFromMap?.raised) || Number(serverData?.fundingRaised) || Number(serverData?.raised) || Number(serverData?.collected) || 0;
  const percentage = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

  return { goal, raised, percentage };
}
