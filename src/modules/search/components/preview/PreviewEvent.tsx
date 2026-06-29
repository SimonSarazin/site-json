import React, { useMemo } from "react";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import LazyImage from "@/components/layout/LazyImage";
import { useT } from "@/hooks/useT";
import getDateFnsLocale from "@/dateFns";
import useItem from "@/modules/search/hooks/useItem";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import { PreviewProps } from "@/modules/search/schema";
import { renderMarkdown } from "@/helpers/renderMarkdown";
import { EntityActionButtons } from "@/modules/profil/components/EntityActionButtons";
import { useEntityActionEffect } from "@/modules/profil/actions/entityActionBus";

/**
 * Détail d'un ÉVÉNEMENT : infos (date/heure, lieu, organisateur, participants) + barre d'ACTIONS réutilisée
 * (`EntityActionButtons` → useEventEntityActions : Participer/Suivre/Éditer…). Branché `preview.type:"event"`.
 * Sert le module search ET l'agenda → « lier event ↔ agenda » (même détail/actions partout).
 */
const PreviewEvent: React.FC<PreviewProps> = ({ item }) => {
  const t = useT("modules/search");
  const data = useItem(item);
  const { name, profilImageUrl, image, description, address, tags = [], startDate, endDate, organizerName } = data;

  const locale = getDateFnsLocale();
  const sameDay = startDate && endDate && format(startDate, "P", { locale }) === format(endDate, "P", { locale });
  const dateLine = startDate
    ? endDate && !sameDay
      ? `${format(startDate, "PPP", { locale })} → ${format(endDate, "PPP", { locale })}`
      : format(startDate, "PPP", { locale })
    : null;
  const timeLine = startDate
    ? `${format(startDate, "p", { locale })}${endDate ? ` – ${format(endDate, "p", { locale })}` : ""}`
    : null;

  // Compteur participants RÉACTIF : on s'abonne à `links` via le proxy réactif cocolight
  // (useReactiveProperty → useSyncExternalStore). Même pattern que useFormatProfileEntity
  // (membersCount).
  const linksReactive = useReactiveProperty<Record<string, unknown>>(item.serverData, "links");
  const attendeesCount = useMemo(() => {
    const att = linksReactive?.attendees;
    return att && typeof att === "object" ? Object.keys(att as Record<string, unknown>).length : 0;
  }, [linksReactive]);

  // Le PROBLÈME : Participer/Quitter (entity.requestToJoin()/leave()) met à jour `me` mais
  // ne re-fetche PAS le proxy de l'event → `links.attendees` resterait figé. SOLUTION : on
  // écoute le bus d'actions et on rappelle `item.refresh()` (recharge l'entité depuis le
  // serveur) sur SON entité → le proxy `links` est ré-hydraté → l'abonnement ci-dessus monte
  // le compteur. Bus = point d'extension : un autre écran peut réagir sans toucher aux mutations.
  useEntityActionEffect((e) => {
    if (e.type === "follow" || e.type === "unfollow" || e.type === "promote") return; // n'affectent pas les participants
    const evId = (e.entity.serverData as { id?: string } | undefined)?.id;
    const myId = (item.serverData as { id?: string } | undefined)?.id;
    if (!evId || evId !== myId) return;
    void (item as unknown as { refresh?: () => Promise<unknown> }).refresh?.();
  });

  const displayAddress = address
    ? `${address.streetAddress ?? ""}${address.streetAddress ? ", " : ""}${address.postalCode ?? ""}${
        address.postalCode ? ", " : ""
      }${address.addressLocality ?? ""}`.replace(/,\s*$/, "")
    : "";

  return (
    <Card className="h-[calc(100vh-130px)] overflow-y-auto bg-background text-foreground rounded-md shadow-md">
      <CardHeader className="p-0">
        <AspectRatio ratio={16 / 9} className="w-full overflow-hidden rounded-t-md">
          <LazyImage
            src={profilImageUrl || image || "/images/defaultImage.png"}
            alt={name}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/images/defaultImage.png";
            }}
            className="object-cover w-full h-full"
          />
        </AspectRatio>
      </CardHeader>

      <Separator />

      <CardContent className="px-4 py-4 space-y-5">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">{name}</h2>
          {dateLine && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 text-accent shrink-0" /><span>{dateLine}</span>
            </div>
          )}
          {timeLine && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-accent shrink-0" /><span>{timeLine}</span>
            </div>
          )}
          {displayAddress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-accent shrink-0" /><span>{displayAddress}</span>
            </div>
          )}
          {organizerName && (
            <div className="text-sm text-muted-foreground">
              {t("Organisé par")} <span className="font-medium text-foreground">{organizerName}</span>
            </div>
          )}
          {attendeesCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4 text-accent shrink-0" /><span>{attendeesCount} {t("participant·es")}</span>
            </div>
          )}
        </div>

        {/* Actions utilisateur (participer / suivre / éditer…) — système d'actions réutilisé */}
        <EntityActionButtons entity={item as unknown as EntityTypes} />

        {description && (
          <>
            <Separator />
            <div>
              <h3 className="text-lg font-semibold mb-1">{t("Description")}</h3>
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(description, { markdownEnabled: true }) }}
              />
            </div>
          </>
        )}

        {tags.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(tags)).slice(0, 20).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-sm">#{tag}</Badge>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PreviewEvent;
