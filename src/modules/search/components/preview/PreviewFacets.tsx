import React, { useState } from "react";
import { Edit, MapPin } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import LazyImage from "@/components/layout/LazyImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { renderMarkdown } from "@/helpers/renderMarkdown";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import { DynamicEditModal } from "@/modules/profil/components/profile-edit/EditModalRegistry";
import { useT } from "@/hooks/useT";
import useItem from "@/modules/search/hooks/useItem";
import { ClickableFacet } from "@/modules/search/components/ClickableFacet";
import { resolveServerDataPath, toFacetTokens } from "@/modules/search/lib/dropdownFilters";
import type { PreviewProps } from "@/modules/search/schema";

/**
 * Preview **générique piloté par la config** (`preview.type: "facets"`) : rend
 * l'en-tête (image / nom / adresse), le résumé, les facettes déclarées dans
 * `preview.facets` (`{ field, label?, icon? }`) puis les tags. Chaque valeur de
 * facette passe par `<ClickableFacet>` : cliquable si un dropdownFilter indexe
 * `field`, sinon texte simple. Aucun code par site — la même primitive que les
 * previews sur-mesure (l'axe « bespoke » reste dispo via un `preview.type` dédié).
 *
 * Il porte les mêmes blocs que ses voisins, pour qu'un aperçu ne se distingue pas
 * par ce qui lui manque :
 *  • DESCRIPTION en markdown, comme `PreviewDefault` (`showDescription:false` la masque) ;
 *  • TAGS en pastilles, comme `PreviewDefault` — et non en facette : `tags` est presque
 *    toujours indexé par un dropdownFilter d'une AUTRE page (`findFilterByField` balaie
 *    toute la config), le clic quitterait donc le listing courant ;
 *  • ÉDITER, comme `PreviewPoiAmenities` : gardé par `canEditProfile` et routé par
 *    `DynamicEditModal`, donc vers le formulaire costum que la config déclare pour ce
 *    type d'entité (`profiles.<type>.editModals`), sans rien câbler ici.
 */
const PreviewFacets: React.FC<PreviewProps> = ({ item, preview, onClose }) => {
  const t = useT("modules/search");
  const data = useItem(item);
  const { canEditProfile } = useProfilPermissions(item ?? null);
  const [editionOuverte, setEditionOuverte] = useState(false);
  const facets = preview?.facets ?? [];
  const serverData = (item?.serverData ?? {}) as Record<string, unknown>;

  // `useItem` fait déjà tomber l'une sur l'autre quand une seule est renseignée : le résumé suffit ici,
  // l'aperçu n'est pas la fiche complète.
  const description = data.shortDescription || data.description;
  // Dédoublonnés et plafonnés, comme `PreviewDefault` : une fiche en porte parfois plusieurs dizaines.
  const tags = Array.from(new Set(data.tags ?? [])).slice(0, 20);
  const address = data.address;
  const displayAddress =
    [address?.streetAddress, address?.postalCode, address?.addressLocality]
      .filter(Boolean)
      .join(", ") || t("Adresse non disponible");

  const rows = facets
    .map((facet) => ({
      facet,
      tokens: toFacetTokens(resolveServerDataPath(serverData, facet.field)),
    }))
    .filter((r) => r.tokens.length > 0);

  return (
    // `max-h` et non `h` : ce renderer sert dans un TIROIR (pleine hauteur) comme dans une MODALE, que
    // `DetailsModeDialog` borne déjà à `max-h-[90vh] overflow-hidden` — une hauteur FIXE de
    // `100vh - 130px` y débordait du conteneur et se faisait rogner. Chaque `Preview*` borne sa propre
    // hauteur et son propre défilement (cf. le commentaire de `DetailsModeDialog`).
    <Card className="max-h-[85vh] overflow-y-auto bg-background text-foreground rounded-md shadow-md">
      <CardHeader className="relative p-0">
        {/* Posé sur l'image, à gauche du bouton de fermeture du Dialog (lui-même en haut à droite). */}
        {canEditProfile && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEditionOuverte(true)}
            className="absolute right-12 top-2 z-10 shadow-sm"
          >
            <Edit className="h-4 w-4" />
            {t("Modifier")}
          </Button>
        )}
        <AspectRatio ratio={16 / 9} className="w-full overflow-hidden rounded-t-md">
          <LazyImage
            src={data.profilImageUrl || "/images/defaultImage.png"}
            alt={data.name}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/images/defaultImage.png";
            }}
            className="object-cover w-full h-full"
          />
        </AspectRatio>
      </CardHeader>

      <Separator />

      <CardContent className="px-4 space-y-6">
        <div className="text-center space-y-1">
          <CardTitle className="text-2xl">{data.name}</CardTitle>
          <div className="flex items-center justify-center text-sm text-muted-foreground">
            <MapPin className="mr-1 h-5 w-5 text-accent" />
            <span>{displayAddress}</span>
          </div>
        </div>

        {/* La description n'est pas une facette (ni libellé, ni valeur cliquable), mais l'omettre ampute
            la fiche de sa présentation. Rendue en markdown comme dans `PreviewDefault` ; `showDescription:
            false` la masque quand les facettes se suffisent. */}
        {preview?.showDescription !== false && description && (
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(description, { markdownEnabled: true }) }}
          />
        )}

        {rows.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="text-lg font-semibold mb-2">{t("Caractéristiques")}</h3>
              <div className="space-y-4">
                {rows.map(({ facet, tokens }) => (
                  <div key={facet.field} className="flex items-start">
                    <DynamicIcon
                      name={(facet.icon ?? "tag") as IconName}
                      className="h-5 w-5 text-accent mt-1 shrink-0"
                    />
                    <div className="ml-3">
                      <p className="text-sm font-medium">
                        {facet.label ? t(facet.label) : facet.field}
                      </p>
                      <p className="text-sm">
                        {tokens.map((token, index) => (
                          <span key={`${token}-${index}`}>
                            {index > 0 && ", "}
                            <ClickableFacet
                              field={facet.field}
                              token={token}
                              onClose={onClose}
                              className="cursor-pointer font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary hover:text-primary/80"
                            />
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        {tags.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="text-lg font-semibold mb-2">{t("Tags")}</h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-sm">#{tag}</Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>

      {/* La modale d'édition se monte HORS de la carte : `DynamicEditModal` porte son propre Dialog,
          portalisé sur `document.body`. Il se superpose donc à l'aperçu sans en hériter le défilement. */}
      {canEditProfile && item && (
        <DynamicEditModal
          open={editionOuverte}
          onOpenChange={(ouvert) => { setEditionOuverte(ouvert); if (!ouvert) onClose?.(); }}
          entity={item}
        />
      )}
    </Card>
  );
};

export default PreviewFacets;
