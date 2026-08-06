import { useState } from "react";
import { MapPin, Calendar, ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/hooks/useT";
import { Link } from "react-router";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { getEntityIcon } from "@/lib/entityIcons";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { EntityPreviewDrawer } from "./EntityPreviewDrawer";

interface EntityCardProps {
  entity: EntityTypes;
  showRole?: boolean;
  lastItemRef?: (node: HTMLDivElement | null) => void;
}

export function EntityCard({
  entity,
  showRole = false,
  lastItemRef,
}: EntityCardProps) {
  const t = useT("modules/profil");
  const type = entity.getEntityType?.() || "";

  // Les entités SANS slug (ex. POI importés) n'ont pas de page profil `/profil/:slug` :
  // on ouvre un aperçu en drawer plutôt que de produire un lien cassé `/profil/null`.
  const hasSlug = Boolean(entity.slug);
  const profileUrl = `/profil/${entity.slug}`;
  const [openDetails, setOpenDetails] = useState(false);
  const [imageKo, setImageKo] = useState(false);
  const openPreview = () => setOpenDetails(true);

  const getTypeLabel = () => {
    switch (type) {
      case "organizations":
        return t("MembershipTab.organization");
      case "projects":
        return t("MembershipTab.project");
      case "poi":
        return t("MembershipTab.poi");
      case "events":
        return t("MembershipTab.event");
      default:
        return type;
    }
  };

  // Enveloppe cliquable : <Link> si l'entité a un slug, sinon bouton ouvrant l'aperçu (drawer).
  // Fonction de rendu (pas un composant imbriqué) pour éviter un remount à chaque render.
  const renderClickable = (className: string, children: React.ReactNode) =>
    hasSlug ? (
      <Link to={profileUrl} className={className}>
        {children}
      </Link>
    ) : (
      <button type="button" onClick={openPreview} className={`${className} text-left`}>
        {children}
      </button>
    );

  return (
    // `@container` : la carte s'adapte à la largeur de SA COLONNE, pas à celle de l'écran. Elle est
    // posée aussi bien en pleine largeur (onglet Adhésions) que dans une grille à 3 colonnes
    // (ProfileRelated : events/projects d'une organisation) — soit ~256 px sur un écran de bureau.
    // Les points d'arrêt d'écran (`sm:`) ne voyaient pas cette contrainte : le bloc d'action gardait
    // son libellé long et prenait 119 des 142 px de la ligne, ne laissant au titre qu'une colonne
    // d'UN caractère — le titre s'affichait alors en vertical, lettre par lettre.
    <div
      ref={lastItemRef}
      className="@container/entity-card bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-4">
        {/* Image/Logo */}
        {renderClickable(
          "w-16 h-16 rounded-lg border border-border overflow-hidden bg-muted shrink-0 hover:opacity-80 transition-opacity",
          entity.serverData?.profilImageUrl && !imageKo ? (
            <OptimizedImage
              src={entity.serverData.profilImageUrl}
              alt={entity.serverData?.name || ""}
              width={64}
              className="w-full h-full object-cover"
              // Une image ABSENTE côté source (les visuels des vieilles fiches vivent sur le serveur
              // de production, pas dans une copie de développement) affichait l'icône « image cassée »
              // du navigateur suivie du texte alternatif, qui débordait de la vignette. On retombe sur
              // l'icône de type, exactement comme une fiche sans image.
              onError={() => setImageKo(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {getEntityIcon(type, { className: "w-5 h-5", withColor: true })}
            </div>
          ),
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Étroit : action SOUS le contenu (pleine largeur disponible). Large : action à droite,
              disposition d'origine. `@sm` = 24rem de CONTENEUR — au-dessus, la ligne tient. */}
          <div className="flex flex-col gap-2 @sm/entity-card:flex-row @sm/entity-card:items-start @sm/entity-card:justify-between @sm/entity-card:gap-0">
            <div className="flex-1 min-w-0">
              {/* Le titre prend la place restante et, dans une carte étroite, s'écrit sur DEUX lignes
                  plutôt que d'être coupé au 4ᵉ caractère : `truncate` seul rendait « Les Ouvertures… »
                  illisible dès que la pastille de type lui prenait la moitié de la ligne. */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {renderClickable(
                  "min-w-0 basis-full @sm/entity-card:basis-auto flex-1 font-semibold text-foreground line-clamp-2 @sm/entity-card:line-clamp-none @sm/entity-card:truncate hover:text-primary hover:underline transition-colors",
                  entity.serverData?.name || t("common.untitled"),
                )}
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {getTypeLabel()}
                </Badge>
              </div>

              {entity.serverData?.shortDescription && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {entity.serverData.shortDescription}
                </p>
              )}

              {/* Localisation */}
              {entity.serverData?.address?.addressLocality && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  <MapPin className="w-3 h-3" />
                  <span>
                    {entity.serverData.address.addressLocality}
                    {entity.serverData.address.postalCode &&
                      `, ${entity.serverData.address.postalCode}`}
                  </span>
                </div>
              )}

              {/* Date pour les événements */}
              {type === "events" && entity.serverData?.startDate && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {new Date(entity.serverData.startDate).toLocaleDateString()}
                  </span>
                </div>
              )}

              {/* Rôle de l'utilisateur (optionnel) */}
              {showRole && (
                <div className="flex items-center gap-2 text-xs">
                  {/* Admin badge - seulement pour organizations, projects, events */}
                  {type !== "poi" && entity.isAdmin?.() && (
                    <Badge
                      variant="outline"
                      className="text-primary border-primary"
                    >
                      {t("MembershipTab.admin")}
                    </Badge>
                  )}

                  {/* Badges spécifiques selon le type d'entité */}
                  {type === "organizations" && entity.isMember?.() && (
                    <Badge variant="outline">{t("MembershipTab.member")}</Badge>
                  )}
                  {type === "projects" && entity.isContributor?.() && (
                    <Badge variant="outline">
                      {t("MembershipTab.contributor")}
                    </Badge>
                  )}
                  {type === "events" && entity.isAttendee?.() && (
                    <Badge variant="outline">
                      {t("MembershipTab.participant")}
                    </Badge>
                  )}
                  {type === "poi" && entity.isAuthor?.() && (
                    <Badge variant="outline">{t("MembershipTab.author")}</Badge>
                  )}
                </div>
              )}
            </div>

            {/* Actions : lien profil si slug, sinon aperçu (drawer) */}
            <div className="flex shrink-0 items-center gap-2 @sm/entity-card:ml-4">
              {hasSlug ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to={profileUrl}>
                    <ExternalLink className="w-4 h-4" />
                    {/* Libellé masqué seulement quand la CARTE est trop étroite pour lui —
                        `sm:` (écran) le laissait passer dans une colonne de 142 px. */}
                    <span className="hidden @[11rem]/entity-card:inline ml-1">
                      {t("common.viewProfile")}
                    </span>
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={openPreview}>
                  <Eye className="w-4 h-4" />
                  <span className="hidden @[11rem]/entity-card:inline ml-1">
                    {t("common.preview")}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Aperçu drawer "léger actionnable" pour les entités sans slug (Édition auteur + Email + carte). */}
      {!hasSlug && (
        <EntityPreviewDrawer entity={entity} open={openDetails} onOpenChange={setOpenDetails} />
      )}
    </div>
  );
}
