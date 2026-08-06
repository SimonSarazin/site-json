import { useState } from "react";
import { Wrench } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { getBaseUrl } from "@/lib/constant/common";

interface ToolImageProps {
  /** `tool.image` : chemin backend (`/upload/…`, `/assets/…`), URL absolue, ou "". */
  src: string;
  alt: string;
  /** Largeur demandée au proxy d'optimisation (px). */
  width: number;
  className?: string;
  /** Classes de l'icône de repli (dimension imposée par l'appelant). */
  iconClassName?: string;
}

/**
 * Vignette d'un outil, avec repli sur une icône.
 *
 * Deux responsabilités que les 3 points d'affichage (carte, ligne, modale)
 * partageaient en les dupliquant :
 *  1. **URL absolue** — le backend renvoie des chemins RELATIFS au serveur PHP
 *     (`/assets/<hash>/images/tools/dokos.svg`), or le proxy `/img` du dev-server
 *     résout tout chemin commençant par `/` dans le `public/` du site → 404.
 *     On préfixe donc par `getBaseUrl()`, comme les autres consommateurs d'images
 *     backend (cf. `ReadOnlyUploaderGallery`).
 *  2. **Repli** — l'image d'un outil vient de sources hétérogènes (upload d'un
 *     admin, asset embarqué, image par défaut) : un fichier peut avoir disparu.
 *     `onError` bascule alors sur l'icône plutôt que d'afficher une image cassée.
 */
export function ToolImage({
  src,
  alt,
  width,
  className = "h-full w-full object-contain p-1.5",
  iconClassName = "h-7 w-7 text-muted-foreground",
}: ToolImageProps) {
  // On mémorise LA source en échec (et non un booléen) : quand React recycle le
  // composant sur un autre outil, la nouvelle source reprend sa chance sans effet
  // de reset.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return <Wrench className={iconClassName} />;
  }

  const absolute = /^(https?:)?\/\//.test(src) || src.startsWith("data:")
    ? src
    : `${getBaseUrl()}${src.startsWith("/") ? "" : "/"}${src}`;

  return (
    <OptimizedImage
      src={absolute}
      alt={alt}
      width={width}
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
}
