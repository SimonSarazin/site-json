import { Calendar, Mic } from "lucide-react";
import { AudioPlayer } from "@/components/media/AudioPlayer";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { formatDateLong } from "@/helpers/formatDate";
import { useT } from "@/hooks/useT";
import { ClickableFacet } from "../../ClickableFacet";
import { bubbleTint, valueColor } from "../../../lib/testimonial";
import { useTestimonialData } from "../../../hooks/useTestimonialData";
import { PreviewProps } from "../../../schema";

/**
 * Design « bubble » de la preview testimonial (contenu de la modale `detailsMode:"dialog"`). Le conteneur
 * pose la croix en haut-droite → l'en-tête réserve `pr-12`. Rendu : bannière d'illustration éventuelle,
 * en-tête (pastille catégorie + titre + attribution accent·date), LECTEUR AUDIO mis en avant, puis la
 * citation en pulled-quote teinté catégorie (texte brut, `whitespace-pre-line`), puis les
 * « repères » GÉNÉRIQUES (aucun champ en dur) via `data.facets` +
 * `ClickableFacet` (deviennent cliquables si un dropdownFilter indexe le champ ; sinon texte simple).
 */
export default function PreviewTestimonialBubble({ item, list, onClose }: PreviewProps) {
  const t = useT("modules/search");
  const testimonial = list?.testimonial;
  const data = useTestimonialData(item, testimonial);
  const badgeColor = data.badge?.color ?? "var(--primary)";
  const tint = bubbleTint(badgeColor);
  const accentField = testimonial?.accent?.field;
  const accentColors = testimonial?.accent?.colors;

  return (
    /* `min-w-0` : même raison que sur `PreviewResourceCard` (voir son commentaire de racine) — sans lui,
       cette racine est un élément de grille à `min-width: auto` et s'ÉLARGIT jusqu'à la largeur
       min-content de son contenu au lieu de le comprimer. Un titre long ou une URL collée dans la
       citation déborde alors du dialogue, rogné en silence par son `overflow-hidden`. */
    <div className="flex max-h-[85vh] min-w-0 flex-col">
      {/* Illustration — bannière plafonnée à 30vh : `aspect-[21/9]` dérive sa hauteur de la LARGEUR du
          dialogue et `shrink-0` l'empêche de céder, ce qui écraserait la zone de contenu sur un grand
          écran (même plafond que la preview « resource »). Le conteneur pose la croix de fermeture
          par-dessus : c'est `DetailsModeDialog` qui lui donne sa pastille de contraste. */}
      {data.image && (
        <div className="relative aspect-[21/9] max-h-[30vh] w-full shrink-0 overflow-hidden bg-muted">
          <OptimizedImage src={data.image} alt={data.title} width={840} className="h-full w-full object-cover" />
        </div>
      )}

      {/* En-tête : catégorie + titre + attribution (accent · date) */}
      <div className="shrink-0 space-y-3 border-b border-border py-4 pl-5 pr-12">
        {data.badge && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: tint.surfaceStrong, borderColor: tint.border, color: tint.text }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: badgeColor }} />
            {data.badge.value}
          </span>
        )}
        {data.title && (
          <h2 className="text-xl font-semibold leading-tight text-foreground">{data.title}</h2>
        )}
        {(data.accent || data.date) && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {data.accent && (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground/70">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: data.accent.color }} />
                {data.accent.value}
              </span>
            )}
            {data.accent && data.date && <span aria-hidden>·</span>}
            {data.date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDateLong(data.date)}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        {/* La voix : mise en avant (raison d'ouvrir le témoignage) */}
        {data.audio && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Mic className="h-3.5 w-3.5" /> {t("testimonial.listenTitle")}
            </p>
            <AudioPlayer src={data.audio} />
          </div>
        )}

        {/* Citation — pulled-quote teinté de la catégorie (texte brut) */}
        {data.quote && (
          <blockquote className="relative rounded-2xl px-5 pb-4 pt-6" style={{ backgroundColor: tint.surface }}>
            <span
              aria-hidden
              className="absolute left-4 top-1 select-none font-serif text-4xl leading-none"
              style={{ color: badgeColor }}
            >
              &ldquo;
            </span>
            <p className="whitespace-pre-line leading-relaxed text-foreground/90">{data.quote}</p>
          </blockquote>
        )}

        {/* Repères — taxonomies GÉNÉRIQUES (config `facets`), pills cliquables via ClickableFacet */}
        {data.facets.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.facets.map((f) => {
              const isAccent = !!accentField && f.field === accentField;
              return (
                <div key={f.field} className="space-y-1.5">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    {f.label ? t(f.label) : f.field}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {f.tokens.map((token, i) => (
                      <span
                        key={`${token}-${i}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs text-foreground/80"
                      >
                        {isAccent && (
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: valueColor(token, { map: accentColors }) }}
                          />
                        )}
                        <ClickableFacet
                          field={f.field}
                          token={token}
                          onClose={onClose}
                          className="cursor-pointer appearance-none bg-transparent p-0 text-xs text-inherit hover:underline"
                        >
                          {token}
                        </ClickableFacet>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
