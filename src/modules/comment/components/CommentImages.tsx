import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

  // Les images dont l'ORIGINAL n'a pas pu être servi (optimiseur en 502, fichier absent) : pour
  // elles seules, la miniature du backend reprend du service — mieux vaut un carré imparfait
  // qu'une image cassée.
  const [enRepli, setEnRepli] = useState<ReadonlySet<string>>(() => new Set<string>());
  const cleDe = (image: CommentImage, index: number): string => image.id || String(index);
  const sourceDe = (image: CommentImage, index: number): string | null =>
    (enRepli.has(cleDe(image, index)) ? image.thumbUrl ?? image.url : image.url ?? image.thumbUrl);
  // Sans miniature, ou quand elle porte la même adresse (aperçu local `blob:`), la source ne
  // change pas : rien ne se recharge, et l'erreur ne se rejoue pas.
  const replier = (image: CommentImage, index: number) => {
    const cle = cleDe(image, index);
    setEnRepli(courant => (courant.has(cle) ? courant : new Set(courant).add(cle)));
  };

  const aller = useCallback((pas: number) => {
    setAgrandie(courant => (courant === null ? null : (courant + pas + nombre) % nombre));
  }, [nombre]);

  // Les flèches du clavier parcourent la visionneuse. Posées sur `window` et non sur le
  // dialogue : à l'ouverture Radix donne le focus à la croix, mais un clic sur l'image — qui
  // n'est pas focalisable — le rend au document, et les touches n'atteindraient plus le dialogue.
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
          // L'image d'ORIGINE, même en vignette : `OptimizedImage` la demande déjà réduite à la
          // largeur voulue, alors que la miniature du backend est un carré de 200 px où une image
          // en paysage arrive déformée et flanquée d'une bande noire (vu au navigateur le 07/10).
          // Elle ne sert plus que de repli — quand l'original manque, ou ne se charge pas.
          const source = sourceDe(image, index);
          return (
            <li key={image.id || index}>
              <button
                type="button"
                onClick={() => setAgrandie(index)}
                // Rien à agrandir : la visionneuse s'ouvrirait sur sa seule croix.
                disabled={!source}
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
                    onError={() => replier(image, index)}
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
          // La croix du dialogue de base est sombre sur le voile sombre, et dite « Close » : la
          // visionneuse porte la sienne, sur le même fond que ses flèches.
          showCloseButton={false}
          // Deux réglages du dialogue de base bornaient l'image « agrandie », mesurés au navigateur :
          // `sm:max-w-lg`, qu'une largeur maximale sans variante `sm:` n'écrase pas (512 px), puis
          // `left-[50%]`, sous lequel une boîte `w-fit` ne dispose que de la moitié de l'écran.
          // On centre donc par les marges, et la largeur maximale est répétée en `sm:`.
          // `min-h-36` : la croix occupe le coin, les flèches le milieu de la rangée — sous
          // 124 px de haut (panoramique sur téléphone, image pas encore arrivée) la croix
          // recouvrait « suivante », et la toucher fermait la visionneuse.
          className="right-0 left-0 mx-auto flex max-h-[92dvh] min-h-36 w-fit max-w-[min(72rem,95vw)]
                     translate-x-0 items-center gap-2 border-0 bg-transparent p-0 shadow-none
                     sm:max-w-[min(72rem,95vw)]"
        >
          <DialogTitle className="sr-only">{ouverte?.name || String(t("images.viewer"))}</DialogTitle>

          <DialogClose
            aria-label={String(t("images.close"))}
            className="absolute end-0 top-0 z-10 m-2 rounded-full bg-background/80 p-2 text-foreground shadow-sm
                       hover:bg-background focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="size-5" aria-hidden />
          </DialogClose>

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

          {ouverte && agrandie !== null && sourceDe(ouverte, agrandie) ? (
            <OptimizedImage
              src={sourceDe(ouverte, agrandie) as string}
              alt={ouverte.name || ""}
              width={1200}
              onError={() => replier(ouverte, agrandie)}
              // `min-w-0` : sans lui une image ne rétrécit pas dans une rangée flex, et la flèche
              // « suivante » était poussée hors du cadre.
              className="max-h-[88dvh] w-auto max-w-full min-w-0 rounded-lg object-contain shadow-2xl"
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
