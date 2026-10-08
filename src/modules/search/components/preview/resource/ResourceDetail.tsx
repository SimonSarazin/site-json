import type { ReactNode } from "react";
import { Users } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ProseContent } from "@/components/shared/ProseContent";

export interface ResourceDetailProps {
  name: string;
  images: string[];
  /** Texte de la pastille posée sur les photos (capacité) — absente si vide. */
  capacityLabel?: string | null;
  /** Lignes sous le nom (porteur, adresse…). */
  subtitle?: ReactNode;
  /** Tarifs déjà formatés : montant + unité (« /h », « la journée »…). */
  prices?: { amount: number | string; suffix: string }[];
  /** Libellé de la pastille « tarif solidaire » — absente si vide. */
  solidarityLabel?: string | null;
  area?: { label: string; value: string } | null;
  /** Listes à pastilles (équipements, services…). */
  tags?: { label: string; values: string[] }[];
  /** Textes libres saisis (markdown ou HTML), rendus via `ProseContent`. */
  notes?: { label: string; value: string }[];
  /** Boutons en pied (réserver, contacter, voir le lieu…). */
  actions?: ReactNode;
}

/**
 * Détail d'une ressource de tiers-lieu (salle, poste de coworking, hébergement) — UNE présentation pour
 * la fiche du lieu (`ProfilTiersLieuxAbout`) et l'annuaire des ressources (`PreviewResourceDirectory`) :
 * photos + pastille de capacité, puis nom, tarifs, surface, listes, textes libres, actions. Purement
 * visuel : chaque appelant traduit et met en forme ses propres données.
 */
export function ResourceDetail({
  name,
  images,
  capacityLabel,
  subtitle,
  prices = [],
  solidarityLabel,
  area,
  tags = [],
  notes = [],
  actions,
}: ResourceDetailProps) {
  return (
    // `max-h` + défilement du seul contenu : les textes libres sont de longueur quelconque, les photos
    // restent fixes en tête.
    <div className="grid max-h-[90vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <div className="relative h-56 bg-muted overflow-hidden">
        {images.length > 0 ? (
          <Carousel opts={{ align: "start", loop: images.length > 1 }} className="w-full h-full">
            <CarouselContent className="h-56 ml-0">
              {images.map((src, idx) => (
                <CarouselItem key={idx} className="pl-0 h-56">
                  <img src={src} alt={`${name} – ${idx + 1}`} className="w-full h-full object-cover" />
                </CarouselItem>
              ))}
            </CarouselContent>
            {images.length > 1 && (
              <>
                <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8" />
                <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" />
              </>
            )}
          </Carousel>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Users className="w-14 h-14 text-muted-foreground/30" />
          </div>
        )}
        {capacityLabel && (
          <span className="absolute top-3 right-3 bg-background/90 text-foreground text-xs px-2 py-1 rounded shadow z-10">
            {capacityLabel}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4 overflow-y-auto scrollbar-thin">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">{name}</h3>
          {subtitle}
        </div>

        {(prices.length > 0 || solidarityLabel) && (
          <div className="flex flex-wrap gap-2">
            {prices.map((p) => (
              <span
                key={p.suffix}
                className="inline-flex items-center gap-1 text-sm bg-primary/10 text-primary rounded-md px-3 py-1 font-medium"
              >
                {p.amount}€ <span className="font-normal text-muted-foreground">{p.suffix}</span>
              </span>
            ))}
            {solidarityLabel && (
              <span className="inline-flex items-center gap-1 text-sm bg-secondary/15 text-foreground rounded-md px-3 py-1 font-medium">
                {solidarityLabel}
              </span>
            )}
          </div>
        )}

        {area && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{area.label}</span> {area.value}
          </p>
        )}

        {tags.map((group) => (
          <div key={group.label} className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.values.map((v) => (
                <span key={v} className="text-xs bg-muted text-muted-foreground rounded-md px-2 py-1">
                  {v}
                </span>
              ))}
            </div>
          </div>
        ))}

        {/* Textes SAISIS par le gestionnaire du lieu — markdown ou HTML auto-détecté, puis sanitisé. */}
        {notes.map((note) => (
          <div key={note.label} className="space-y-1">
            <p className="text-sm font-medium text-foreground">{note.label}</p>
            <ProseContent
              text={note.value}
              className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
            />
          </div>
        ))}

        {actions}
      </div>
    </div>
  );
}

export default ResourceDetail;
