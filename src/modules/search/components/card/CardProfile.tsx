import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MapPin, MessageCircle, Heart, Shield, User as UserIcon, Loader2 } from "lucide-react";
import type { User, Organization } from "@communecter/cocolight-api-client";
import { Link } from "react-router";
import { useMemo, useState } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { toast } from "sonner";
import { useFollowEntity, useUnfollowEntity } from "@/modules/profil/actions/mutations/relationship";
import { useT } from "@/hooks/useT";
import type { SearchCardProps } from "../../schema";

export interface CardProfileCardConfig {
  showDescription?: boolean;
  showAddress?: boolean;
  detailsMode?: "drawer" | "dialog" | "link";
}

export interface CardProfileProps {
  item: User | Organization;
  index?: number;
  showBadges?: boolean;
  isPending?: boolean;
  card?: CardProfileCardConfig | SearchCardProps["card"];
  onClick?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function CardProfile({
  item,
  index = 0,
  showBadges = true,
  isPending = false,
  card,
  onClick,
}: CardProfileProps) {
  const t = useT("modules/search");
  const { me } = useCocolight();
  const serverData = item?.serverData;

  const name = serverData?.name || String(t("Anonyme"));
  const profilImage = serverData?.profilImageUrl || serverData?.profilMediumImageUrl;
  const rawDescription = serverData?.shortDescription || serverData?.description;
  const description = typeof rawDescription === "string" ? rawDescription : null;
  const address = serverData?.address;
  const tags = serverData?.tags || [];
  const isAdmin = item?.isAdmin?.() || false;
  const isContributor = item?.isContributor?.() || false;
  const slug = item?.slug;
  const isFollowing = item?.isFollowing?.() || false;

  const isConnected = !!me;

  const isMe = me?.id === item?.id || me?.slug === item?.slug;

  const links = serverData?.links as Record<string, Record<string, unknown>> | undefined;
  const projectsCount = links?.projects ? Object.keys(links.projects).length : 0;

  const profileUrl = slug ? `/@${slug}` : "#";

  const initials = useMemo(() => getInitials(name), [name]);

  const showDescription = card?.showDescription !== false;
  const showAddress = card?.showAddress !== false;
  const detailsMode = card?.detailsMode || "drawer";

  const [isFollowingState, setIsFollowingState] = useState(isFollowing);

  const followMutation = useFollowEntity(item);
  const unfollowMutation = useUnfollowEntity(item);

  const isLoadingFollow = followMutation.isPending || unfollowMutation.isPending;

  const handleFollow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isConnected) {
      toast.error(t("Vous devez être connecté pour suivre"));
      return;
    }
    if (isFollowingState) {
      unfollowMutation.mutate(undefined, {
        onSuccess: () => setIsFollowingState(false),
      });
    } else {
      followMutation.mutate(undefined, {
        onSuccess: () => setIsFollowingState(true),
      });
    }
  };

  const handleContact = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isConnected) {
      toast.error(t("Vous devez être connecté pour contacter"));
      return;
    }
    toast.info(t("Fonctionnalité de contact à venir"));
  };

  const cardContent = (
    <Card
      className={cn(
        "group bg-card/40 backdrop-blur-sm border-border/50",
        "hover:bg-card/60 transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-2",
        "cursor-pointer",
        isPending && "opacity-60"
      )}
      style={{ animationDelay: `${index * 100}ms` }}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <Avatar className="h-24 w-24 border-4 border-primary/20">
            <AvatarImage src={profilImage} alt={name} />
            <AvatarFallback className="text-lg font-semibold bg-primary/10">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-2">
            <h3 className="text-xl font-bold">{name}</h3>

            {showAddress && (
              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>
                  {address?.addressLocality
                    ? `${address.addressLocality}${address.addressCountry ? `, ${address.addressCountry}` : ""}`
                    : t("Adresse non renseignée")
                  }
                </span>
              </div>
            )}

            {showDescription && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {description ?? String(t("Aucune description"))}
              </p>
            )}
          </div>

          {showBadges && (isAdmin || isContributor || isPending) && (
            <div className="flex flex-wrap gap-1 justify-center">
              {isAdmin && (
                <Badge variant="outline" className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                  <Shield className="h-3 w-3 mr-1" />
                  {t("Admin")}
                </Badge>
              )}
              {isContributor && !isAdmin && (
                <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                  <UserIcon className="h-3 w-3 mr-1" />
                  {t("Contributeur")}
                </Badge>
              )}
              {isPending && (
                <Badge variant="outline" className="bg-orange-500/20 text-orange-600 border-orange-500/30">
                  {t("En attente")}
                </Badge>
              )}
            </div>
          )}

          <div className="flex gap-1 justify-center overflow-hidden max-w-full h-6">
            {tags.length > 0 ? (
              <>
                {tags.slice(0, 3).map((tag: string, i: number) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-xs bg-primary/10 text-primary border-primary/20 shrink-0"
                  >
                    {tag}
                  </Badge>
                ))}
                {tags.length > 3 && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    +{tags.length - 3}
                  </Badge>
                )}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">{t("Aucun tag")}</span>
            )}
          </div>

          <div className="flex gap-4 text-center pt-2">
            <div>
              <div className="text-2xl font-bold text-primary">{projectsCount}</div>
              <div className="text-xs text-muted-foreground">{t("Projets")}</div>
            </div>
          </div>

          {!isMe && (
            <div className="flex gap-2 w-full pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={!isConnected}
                onClick={handleContact}
              >
                <MessageCircle className="mr-1 h-4 w-4" />
                {t("Contacter")}
              </Button>
              <Button
                variant={isFollowingState ? "default" : "outline"}
                size="sm"
                className="flex-1"
                disabled={!isConnected || isLoadingFollow}
                onClick={handleFollow}
              >
                {isLoadingFollow ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Heart className={cn("mr-1 h-4 w-4", isFollowingState && "fill-current")} />
                )}
                {isFollowingState ? t("Suivi") : t("Suivre")}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (detailsMode === "link" && slug) {
    return (
      <Link to={profileUrl} className="block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
