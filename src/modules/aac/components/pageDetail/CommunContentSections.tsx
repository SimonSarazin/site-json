import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";

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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {images.map((g, i) => (
                <figure
                    key={`${g.src}-${i}`}
                    className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-surface group"
                >
                    <img
                        src={g.src}
                        alt={g.alt}
                        loading="lazy"
                        width={1024}
                        height={768}
                        className="size-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                </figure>
            ))}
        </div>
    );
}