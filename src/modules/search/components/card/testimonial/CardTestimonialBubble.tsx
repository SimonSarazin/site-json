import { Calendar, Mic } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDateLong } from "@/helpers/formatDate";
import { newsExcerpt } from "@/modules/news/lib/newsExcerpt";
import { useT } from "@/hooks/useT";
import { bubbleTint } from "../../../lib/testimonial";
import { useTestimonialData } from "../../../hooks/useTestimonialData";
import { SearchCardProps } from "../../../schema";

/**
 * Design « bubble » de la card testimonial : la citation (extrait) est le HÉROS, posée dans une bulle de
 * parole teintée de la catégorie (`badge`) avec une queue vers l'attribution. Repères sobres : pastille de
 * catégorie, point coloré d'accent (ex. territoire), sous-titre, date. L'ÉCOUTE se fait dans la preview
 * (clic = ouverture) → ici, la puce signale seulement qu'une voix existe. Données via `useTestimonialData`.
 */
export default function CardTestimonialBubble({ item, onClick, list }: SearchCardProps) {
  const t = useT("modules/search");
  const testimonial = list?.testimonial;
  const data = useTestimonialData(item, testimonial);
  const badgeColor = data.badge?.color ?? "var(--primary)";
  const tint = bubbleTint(badgeColor);
  const excerpt = newsExcerpt(data.quote, 260);

  return (
    <Card
      onClick={onClick}
      className="group flex h-full cursor-pointer flex-col gap-0 overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      {/* Repères du haut : catégorie (pastille-bulle) + présence d'une voix */}
      <div className="flex items-center justify-between gap-2">
        {data.badge ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: tint.surfaceStrong, borderColor: tint.border, color: tint.text }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: badgeColor }} />
            {data.badge.value}
          </span>
        ) : (
          <span />
        )}
        {data.audio && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
            <Mic className="h-3.5 w-3.5" /> {t("testimonial.listen")}
          </span>
        )}
      </div>

      {/* Bulle de parole : la citation est le héros */}
      {excerpt && (
        <div
          className="relative mt-3.5 rounded-2xl px-4 py-3.5"
          style={{ backgroundColor: tint.surface }}
        >
          <p className="line-clamp-5 text-[0.95rem] leading-relaxed text-foreground/90">{excerpt}</p>
          {/* Queue de bulle (pointe vers l'attribution en-dessous) */}
          <span
            aria-hidden
            className="absolute -bottom-1.5 left-6 h-3 w-3 rotate-45 rounded-[3px]"
            style={{ backgroundColor: tint.surface }}
          />
        </div>
      )}

      {/* Titre — attribution sous la bulle */}
      {data.title && (
        <h3 className="mt-3.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {excerpt && <span className="text-muted-foreground">— </span>}
          {data.title}
        </h3>
      )}

      {/* Pied : accent (point coloré) · sous-titre · date */}
      <div className="mt-auto space-y-2 pt-3">
        {(data.accent || data.subtitle) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {data.accent && (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground/75">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: data.accent.color }}
                />
                {data.accent.value}
              </span>
            )}
            {data.subtitle && <span className="truncate">{data.subtitle}</span>}
          </div>
        )}
        {data.date && (
          <div className="flex items-center gap-1.5 border-t border-border pt-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {formatDateLong(data.date)}
          </div>
        )}
      </div>
    </Card>
  );
}
