import { T } from "@/components/ui/T";
import { useLocalization } from "@/hooks/useLocalization";
import MarkdownIt from "markdown-it";
import { sanitize } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import type { SectionPropsMap } from "@/types/site";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import NavLink from "@/components/layout/NavLink";

/**
 * Même parseur que `MarkdownSection`, initialisé une seule fois. La description accepte donc du
 * MARKDOWN : gras, tirets, retours à la ligne — la mise en forme que portait le texte source et que
 * le rendu en `<p>` plat écrasait. Un texte sans balisage reste rendu à l'identique : vérifié sur le
 * parc, aucune description existante ne contient de caractère markdown.
 */
const mdParser = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: true });

export function ContentSection({ 
  id, 
  props 
}: { 
  id?: string; 
  props: SectionPropsMap["content"] 
}) {
  const { t } = useLocalization();
  const {
    category,
    categoryVariant,
    title,
    description,
    tags,
    image,
    imageHref,
    imagePosition = "right",
    links,
    iconCard,
    infoText,
    decorativeElements,
    stats,
    imageFit = "cover",
    width = "prose",
    align = "left",
    className
  } = props;

  const isImageLeft = imagePosition === "left";
  // Sans visuel, la colonne de droite serait vide : on passe en colonne unique.
  const hasVisual = Boolean(image) || Boolean(decorativeElements && decorativeElements.type !== "none");
  // `wide` donne LA MÊME largeur aux deux formes et les centre ; `prose` garde le comportement
  // historique — colonne de lecture calée à gauche, forme illustrée en pleine largeur. La contrainte
  // s'applique aussi à la catégorie, que le rendu place HORS du bloc : sans elle, elle flotterait
  // seule à un autre bord. Classes littérales, le JIT ne génère pas de classe construite.
  const largeurCls = width === "wide" ? "max-w-6xl mx-auto" : "";
  // `align: "center"` centre le bloc ET son texte. Sans visuel, la colonne est bornée à `max-w-3xl`
  // SANS `mx-auto` : elle se colle donc à gauche, et sur une page par ailleurs centrée la moitié
  // droite reste vide. Défaut `left` = comportement historique, aucun site existant ne bouge.
  const estCentre = align === "center";
  const centreCls = estCentre ? "mx-auto text-center" : "";
  // Le libellé est porté par un <span> INTERNE : en pastille, la bordure doit se réduire au texte
  // (un <p> bordé barrerait toute la largeur) sans perdre la largeur ni l'alignement du bloc, que
  // le <p> continue de porter (`largeurCls`/`centreCls`). Défaut : texte simple, aucun site ne bouge.
  // Pas `sectionBadgeClass` : cette pastille-là est un repère de TITRE (inclinée, serif, ombrée,
  // SANS bordure) ; ici c'est un surtitre discret qui n'existe que par sa bordure — non fusionné.
  const pastilleCls =
    categoryVariant === "pill" ? "inline-block rounded-full border border-border px-3 py-1" : undefined;

  return (
    <section id={id} className={cn("py-16", className)}>
      <div className="container mx-auto px-6">
        {category && !isImageLeft && (
          <p className={cn("text-muted-foreground text-sm font-medium mb-2", largeurCls, centreCls)}>
            <T k={category} className={pastilleCls} />
          </p>
        )}
        
        <div className={cn(
          hasVisual ? "grid lg:grid-cols-2 gap-16 items-center" : "max-w-3xl",
          largeurCls,
          centreCls,
          hasVisual && isImageLeft && "direction-rtl"
        )}>
          {/* Content Column */}
          <div className={cn(hasVisual && isImageLeft && "lg:order-2")}>
            {category && isImageLeft && (
              <p className="text-muted-foreground text-sm font-medium mb-4">
                <T k={category} className={pastilleCls} />
              </p>
            )}
            
            <T k={title} as="h2" className="text-4xl font-bold text-primary mb-6 leading-tight" />

            {/* `sanitize` avant injection (isomorphic-dompurify) : la config est maîtrisée, mais le
                chemin reste une écriture de HTML. `prose-theme` branche la typographie sur les jetons
                du thème, clair et sombre. */}
            <div
              className="prose prose-theme max-w-none text-muted-foreground mb-8 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitize(mdParser.render(t(description))) }}
              suppressHydrationWarning
            />

            {/* Stats */}
            {stats && stats.length > 0 && (
              <div className={cn("flex flex-wrap gap-x-10 gap-y-6 mb-8", estCentre && "justify-center")}>
                {stats.map((stat, idx) => (
                  <div key={idx}>
                    <div className="text-3xl font-bold text-primary">{stat.value}</div>
                    <T k={stat.label} as="div" className="text-sm text-muted-foreground mt-1" />
                  </div>
                ))}
              </div>
            )}

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div className={cn("flex flex-wrap gap-3 mb-8", estCentre && "justify-center")}>
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-full text-sm cursor-pointer transition"
                    suppressHydrationWarning
                  >
                    {t(tag)}
                  </span>
                ))}
              </div>
            )}

            {/* Icon Card and/or Links */}
            {(iconCard || (links && links.length > 0)) && (
              <div className={cn("flex items-start gap-4 mb-6", estCentre && "justify-center")}>
                {/* Icon */}
                {iconCard && (
                  <div className="w-28 h-28 px-4 bg-card rounded-2xl border border-border flex items-center justify-center text-3xl shadow-lg flex-0">
                    <div dangerouslySetInnerHTML={{ __html: iconCard.svg }} suppressHydrationWarning />
                  </div>
                )}

                {/* Links Card */}
                {links && links.length > 0 && (
                <div className="bg-card rounded-2xl shadow-lg p-6 border border-border flex-1">
                  <div className="space-y-4">
                    {links.map((link, idx) => (
                      <div key={idx} className="flex items-center space-x-3">
                        <svg className="w-3 h-3 text-foreground" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        {/* NavLink : href interne → navigation SPA (react-router),
                            http(s) → nouvel onglet — un `<a>` brut rechargeait
                            toute la page pour un chemin interne. */}
                        <NavLink
                          to={link.href}
                          className="font-semibold text-foreground hover:text-primary transition"
                          suppressHydrationWarning
                        >
                          {t(link.label)}
                        </NavLink>
                      </div>
                    ))}
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Info Text */}
            {infoText && (
              <div className={cn("flex items-center space-x-2 text-sm text-muted-foreground", estCentre && "justify-center")}>
                <svg className="w-5 h-5 text-foreground" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="mt-1" dangerouslySetInnerHTML={{ __html: t(infoText) }} suppressHydrationWarning />
              </div>
            )}
          </div>

          {/* Image Column */}
          {hasVisual && (
          <div className={cn("relative h-full", isImageLeft && "lg:order-1")}>
            <div className="h-full rounded-2xl overflow-hidden">
              {image && (() => {
                const visuel = (
                  <OptimizedImage
                    src={image}
                    alt={t(title)}
                    width={600}
                    className={cn(
                      "w-full h-full rounded-xl",
                      imageFit === "contain" ? "max-h-96 object-contain" : "object-cover",
                      imageHref && "transition-transform duration-300 hover:scale-[1.03]",
                    )}
                  />
                );
                if (!imageHref) return visuel;
                // `NavLink` (le même que les liens ci-dessous) tranche déjà interne/externe : chemin
                // → navigation SPA, http(s) → nouvel onglet. Rien à réimplémenter ici.
                return (
                  <NavLink to={imageHref} className="block h-full" suppressHydrationWarning>
                    {visuel}
                  </NavLink>
                );
              })()}
            </div>

            {/* Decorative Elements */}
            {decorativeElements && decorativeElements.type === "corner-icon" && (
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary rounded-tl-full flex items-center justify-center shadow-2xl">
                <div className="text-white text-4xl mb-4 ml-4">
                  <div className="flex space-x-2 mb-1">
                    <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
                    <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
                  </div>
                  <div className="w-8 h-1 bg-primary-foreground rounded-full"></div>
                </div>
              </div>
            )}

            {decorativeElements && decorativeElements.type === "colored-squares" && (
              <div className="absolute bottom-8 left-8 flex gap-4">
                <div className="w-24 h-24 bg-chart-2 transform -rotate-12 shadow-2xl rounded-lg"></div>
                <div className="w-24 h-24 bg-chart-4 transform rotate-12 shadow-2xl rounded-lg"></div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ContentSection;