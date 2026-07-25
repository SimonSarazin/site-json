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
import { useAuthModal } from "@/modules/auth";
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
  /** Conf de liste complète, transmise à tous les variants par `SearchCard` — non lue ici. */
  list?: SearchCardProps["list"];
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
  const { openLogin } = useAuthModal();
  const serverData = item?.serverData;

  const name = serverData?.name || String(t("Anonyme"));
  const profilImage = serverData?.profilImageUrl || serverData?.profilMediumImageUrl;
  const rawDescription = serverData?.shortDescription || serverData?.description;
  const description = typeof rawDescription === "string" ? rawDescription : null;
  const address = serverData?.address;
  const tags = serverData?.tags || [];

  let isAdmin = false;
  let isContributor = false;
  let isFollowing = false;
  try {
    isAdmin = item?.isAdmin?.() || false;
  } catch { /* ignore */ }
  try {
    isContributor = item?.isContributor?.() || false;
  } catch { /* ignore */ }
  try {
    isFollowing = item?.isFollowing?.() || false;
  } catch { /* ignore */ }

  const slug = item?.slug;

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
      openLogin();
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
      openLogin();
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
      <CardContent className="p-3 sm:p-4 md:p-6">
        <div className="flex flex-col items-center text-center space-y-2 sm:space-y-3 md:space-y-4">
          <Avatar className="h-16 w-16 border-2 sm:h-20 sm:w-20 md:h-24 md:w-24 sm:border-4 border-primary/20">
            <AvatarImage src={profilImage} alt={name} />
            <AvatarFallback className="text-sm sm:text-base md:text-lg font-semibold bg-primary/10">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="w-full space-y-1 sm:space-y-2">
            <h3 className="text-sm sm:text-lg md:text-xl font-bold line-clamp-2">{name}</h3>

            {showAddress && (
              <div className="flex items-center justify-center gap-1 text-xs sm:text-sm text-muted-foreground">
                <MapPin className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                <span className="line-clamp-1">
                  {address?.addressLocality
                    ? `${address.addressLocality}${address.addressCountry ? `, ${address.addressCountry}` : ""}`
                    : t("Adresse non renseignée")
                  }
                </span>
              </div>
            )}

            {showDescription && (
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-1">
                {description ?? String(t("Aucune description"))}
              </p>
            )}
          </div>

          {showBadges && (isAdmin || isContributor || isPending) && (
            <div className="flex flex-wrap gap-1 justify-center">
              {isAdmin && (
                <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">
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
                <Badge variant="outline" className="bg-info/20 text-info border-info/30">
                  {t("En attente")}
                </Badge>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-1 justify-center">
            {tags.length > 0 ? (
              <>
                {tags.slice(0, 3).map((tag: string, i: number) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-[10px] sm:text-xs bg-primary/10 text-primary border-primary/20"
                  >
                    {tag}
                  </Badge>
                ))}
                {tags.length > 3 && (
                  <Badge variant="outline" className="text-[10px] sm:text-xs">
                    +{tags.length - 3}
                  </Badge>
                )}
              </>
            ) : (
              <span className="text-[10px] sm:text-xs text-muted-foreground">{t("Aucun tag")}</span>
            )}
          </div>

          <div className="flex gap-4 text-center">
            <div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-primary">{projectsCount}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">{t("Projets")}</div>
            </div>
          </div>

          {!isMe && (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
                onClick={handleContact}
              >
                <MessageCircle className="h-3.5 w-3.5 mr-1 sm:h-4 sm:w-4" />
                {t("Contacter")}
              </Button>
              <Button
                variant={isFollowingState ? "default" : "outline"}
                size="sm"
                className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
                disabled={isLoadingFollow}
                onClick={handleFollow}
              >
                {isLoadingFollow ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                  <Heart className={cn("h-3.5 w-3.5 mr-1 sm:h-4 sm:w-4", isFollowingState && "fill-current")} />
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
