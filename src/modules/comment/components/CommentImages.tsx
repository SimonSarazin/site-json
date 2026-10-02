import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import type { CommentImage } from "../types";

export interface CommentImagesProps {
  readonly images: readonly CommentImage[];
  readonly className?: string;
}

/**
 * Les images d'un message, et leur agrandissement.
 *
 * Disposition volontairement différente du collage plein cadre de `news` : un fil est **dense**,
 * et une image y est une pièce jointe, pas une publication. Une image seule est donc rendue à sa
 * taille naturelle, bornée en hauteur ; plusieurs deviennent des vignettes carrées qu'on peut
 * parcourir. C'est le parti que prend aussi Discord, et il se lit mieux dans une colonne étroite.
 *
 * `OptimizedImage` reconnaît les URL `blob:` et les laisse passer sans transformation : la même
 * grille sert donc aux aperçus locaux d'un message en cours d'envoi et aux images du serveur.
 */
export function CommentImages({ images, className }: CommentImagesProps) {
  const t = useT("modules/comment");
  const [agrandie, setAgrandie] = useState<number | null>(null);

  const nombre = images.length;

  const aller = useCallback((pas: number) => {
    setAgrandie(courant => (courant === null ? null : (courant + pas + nombre) % nombre));
  }, [nombre]);

  // Les flèches du clavier parcourent la visionneuse. Posées sur `window` et non sur le
  // dialogue : Radix garde le focus sur le conteneur, mais un clic sur l'image le lui prend.
  useEffect(() => {
    if (agrandie === null || nombre < 2) return;
    const surTouche = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") { event.preventDefault(); aller(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); aller(-1); }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [agrandie, nombre, aller]);

  if (nombre === 0) return null;

  const ouverte = agrandie !== null ? images[agrandie] : null;
  const seule = nombre === 1;

  return (
    <>
      <ul
        data-comment-images=""
        className={cn("mt-1 flex flex-wrap items-start gap-1", className)}
      >
        {images.map((image, index) => {
          const source = seule ? image.url ?? image.thumbUrl : image.thumbUrl ?? image.url;
          return (
            <li key={image.id || index}>
              <button
                type="button"
                onClick={() => setAgrandie(index)}
                // Sans nom de fichier, l'intitulé reste utile : « Image 2 sur 3 ».
                aria-label={String(image.name || t("images.nth", undefined, { index: index + 1, total: nombre }))}
                className={cn(
                  "group block overflow-hidden rounded-md border border-border bg-muted",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  seule ? "max-w-[min(22rem,100%)]" : "size-24",
                )}
              >
                {source ? (
                  <OptimizedImage
                    src={source}
                    alt={image.name || ""}
                    width={seule ? 480 : 192}
                    className={cn(
                      "transition-transform duration-200 group-hover:scale-[1.02]",
                      seule ? "max-h-64 w-auto object-contain" : "size-full object-cover",
                    )}
                  />
                ) : (
                  // Le document a disparu côté serveur : on le dit, plutôt qu'un cadre vide.
                  <span className="flex size-24 items-center justify-center text-muted-foreground">
                    <ImageOff className="size-5" aria-hidden />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog open={ouverte !== null} onOpenChange={open => !open && setAgrandie(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="flex max-h-[92dvh] w-fit max-w-[min(72rem,95vw)] items-center gap-2 border-0
                     bg-transparent p-0 shadow-none"
        >
          <DialogTitle className="sr-only">{ouverte?.name || String(t("images.viewer"))}</DialogTitle>

          {nombre > 1 ? (
            <button
              type="button"
              onClick={() => aller(-1)}
              aria-label={String(t("images.previous"))}
              className="rounded-full bg-background/80 p-2 text-foreground shadow-sm hover:bg-background"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
          ) : null}

          {ouverte?.url || ouverte?.thumbUrl ? (
            <OptimizedImage
              src={(ouverte.url ?? ouverte.thumbUrl) as string}
              alt={ouverte.name || ""}
              width={1200}
              className="max-h-[88dvh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
            />
          ) : null}

          {nombre > 1 ? (
            <button
              type="button"
              onClick={() => aller(1)}
              aria-label={String(t("images.next"))}
              className="rounded-full bg-background/80 p-2 text-foreground shadow-sm hover:bg-background"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
