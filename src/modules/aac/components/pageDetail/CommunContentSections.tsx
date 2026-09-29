import { useState } from "react";
import { Expand } from "lucide-react";

import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { ImageViewer } from "@/components/ui/image-viewer";

export interface GalleryImage {
    src: string;
    alt: string;
}

interface GallerySectionProps {
    images: GalleryImage[];
}

export function GallerySection({ images }: GallerySectionProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");

    /**
     * L'INDEX de l'image ouverte, et non un booléen : la visionneuse est montée sur toute la
     * liste, pour que ses flèches fassent défiler la galerie depuis la vignette cliquée.
     */
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);

    if (images.length === 0) {
        return (
            <div className="p-5 rounded-lg border border-border bg-surface/60">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {String(t("detail.gallery.empty"))}
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                {images.map((g, i) => (
                    <figure
                        key={`${g.src}-${i}`}
                        className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-surface group"
                    >
                        {/* Un vrai `button` plutôt qu'un `onClick` sur la figure :
                            la vignette est atteignable au clavier et annoncée
                            comme une action, pas comme une simple image. */}
                        <button
                            type="button"
                            onClick={() => setViewerIndex(i)}
                            aria-label={String(
                                t("detail.gallery.openImage", "Agrandir l'image {{index}}", { index: i + 1 })
                            )}
                            className="block size-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                        >
                            <img
                                src={g.src}
                                alt={g.alt}
                                loading="lazy"
                                width={1024}
                                height={768}
                                className="size-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                            />
                            {/* Affordance : sans elle, rien ne dit que la vignette
                                s'ouvre. `pointer-events-none` pour que le survol
                                et le clic restent ceux du bouton. */}
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/30 group-hover:opacity-100 group-focus-within:bg-black/30 group-focus-within:opacity-100"
                            >
                                <Expand className="size-6 text-white drop-shadow" />
                            </span>
                        </button>
                    </figure>
                ))}
            </div>

            <ImageViewer
                images={images.map((g) => ({ src: g.src, name: g.alt }))}
                initialIndex={viewerIndex ?? 0}
                open={viewerIndex !== null}
                onClose={() => setViewerIndex(null)}
            />
        </>
    );
}
