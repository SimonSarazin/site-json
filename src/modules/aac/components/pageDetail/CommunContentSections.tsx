import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";

export function ContentCard({ title, body, small }: { title: string; body: string; small?: boolean }) {
    return (
        <div className="p-5 rounded-lg border border-border bg-surface/60 hover:bg-surface transition-colors">
            <h4 className={`font-display font-bold mb-2 ${small ? "text-base" : "text-lg"}`}>{title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        </div>
    );
}

export function GallerySection() {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");

    const images = [
        { src: undefined, alt: String(t("detail.gallery.editionsAlt")), label: String(t("detail.gallery.editions")) },
        { src: undefined, alt: String(t("detail.gallery.workshopAlt")), label: String(t("detail.gallery.workshop")) },
        { src: undefined, alt: String(t("detail.gallery.printingAlt")), label: String(t("detail.gallery.printing")) },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {images.map((g) => (
                <figure
                    key={g.label}
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
                    <figcaption className="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-background/85 text-foreground backdrop-blur">
                        {g.label}
                    </figcaption>
                </figure>
            ))}
        </div>
    );
}