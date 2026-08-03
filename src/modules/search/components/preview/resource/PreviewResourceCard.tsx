import { Calendar, Download, ExternalLink, MapPin, Play } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { AudioPlayer } from "@/components/media/AudioPlayer";
import { GalleryGrid } from "@/components/media/GalleryGrid";
import { FilesList } from "@/components/media/FilesList";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { formatDateLong } from "@/helpers/formatDate";
import { renderMarkdown } from "@/helpers/renderMarkdown";
import { useT } from "@/hooks/useT";
import { ClickableFacet } from "../../ClickableFacet";
import { normalizeFilterValue } from "../../../lib/dropdownFilters";
import { bubbleTint, hostname } from "../../../lib/testimonial";
import { useResourceData } from "../../../hooks/useResourceData";
import { useResourceEntity } from "../../../hooks/useResourceEntity";
import { PreviewProps } from "../../../schema";

/**
 * Design « card » de la preview resource — PILE DE BLOCS OPTIONNELS (pas une mise en page par type) :
 * en-tête adaptatif (bannière image OU bande typée + grande icône) → action principale (Ouvrir le lien /
 * Regarder / Télécharger, selon le type) → description markdown → GALERIE (medias image) → DOCUMENTS (fichiers)
 * → AUDIO (AudioPlayer réutilisé) → LIENS → repères (facettes cliquables). Chaque bloc n'apparaît que s'il a
 * de la donnée → une seule preview couvre toutes les combinaisons. Données via `useResourceData`.
 * NB : galerie/documents = `medias` INDEXÉ ; la galerie complète (about.images/files) = chargement d'entité (à venir).
 */
export default function PreviewResourceCard({ item, list, onClose }: PreviewProps) {
  const t = useT("modules/search");
  const data = useResourceData(item, list?.resource);
  const badgeColor = data.badge?.color ?? "var(--primary)";
  const tint = bubbleTint(badgeColor);
  const typeIcon = (data.badge?.icon ?? "file") as IconName;
  const cat = normalizeFilterValue(data.badge?.value ?? "");
  const descHtml = data.description.trim() ? renderMarkdown(data.description, { markdownEnabled: true }) : "";

  // Détail : charge l'entité COMPLÈTE pour la galerie (`about.images`) + les documents (`about.files`),
  // comme le reader d'article (blog). La card, elle, se contente des champs indexés. Rendu avec les
  // primitives partagées `GalleryGrid` (grille + lightbox) et `FilesList` (téléchargement).
  const slug = (item as { slug?: string } | undefined)?.slug;
  const id = String((item?.serverData as { id?: unknown } | undefined)?.id ?? (item as { id?: unknown } | undefined)?.id ?? "");
  const { gallery, documents, audio: entityAudio, video: entityVideo } = useResourceEntity({ slug, id });
  // Audio : l'entité (fichiers classés par extension) prime ; sinon le média audio indexé par la recherche.
  const audios = entityAudio.length > 0 ? entityAudio : data.audio ? [data.audio] : [];

  // Action principale = l'usage du type (cascade). Rendue en CTA proéminent. Le href reflète ce que la preview
  // affiche RÉELLEMENT : le fichier de l'entité (`about.files`, classé par extension) prime sur le média indexé —
  // sinon le CTA « Télécharger »/« Regarder » disparaîtrait alors que FilesList / `<video>` montrent bien le fichier.
  const primaryDoc = documents[0]?.docPath ?? data.documents[0]?.url ?? null;
  const primaryVideo = entityVideo[0] ?? data.video ?? data.urls[0] ?? null;
  const primaryAction =
    cat === "lien" && data.urls[0]
      ? { href: data.urls[0], label: t("resource.open"), Icon: ExternalLink }
      : cat === "video" && primaryVideo
        ? { href: primaryVideo, label: t("resource.watch"), Icon: Play }
        : primaryDoc && (cat === "document" || cat === "compte-rendu")
          ? { href: primaryDoc, label: t("resource.download"), Icon: Download }
          : null;

  const typePill = data.badge ? (
    <span
      className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: tint.surfaceStrong, borderColor: tint.border, color: tint.text }}
    >
      <DynamicIcon name={typeIcon} className="h-3.5 w-3.5" />
      {data.badge.value}
    </span>
  ) : null;

  const metaLine =
    data.city || data.date ? (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {data.city && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {data.city}
          </span>
        )}
        {data.date && (
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDateLong(data.date)}
          </span>
        )}
      </p>
    ) : null;

  return (
    <div className="flex max-h-[85vh] flex-col">
      {/* EN-TÊTE adaptatif : bannière image, sinon bande typée + grande icône */}
      {data.image ? (
        <>
          {/* Bannière plafonnée à 30vh. Sans ce plafond, `aspect-[21/9]` dérive
              sa hauteur de la LARGEUR du dialogue et `shrink-0` l'empêche de
              céder : mesuré à 577px sur 813 de dialogue, soit 71 % de la place,
              ne laissant que 98px à la zone de contenu pour 220px à afficher.
              Le scroll existait bien (`overflow-y-auto` plus bas) mais dans une
              fenêtre inutilisable. Le ratio est conservé tant qu'il tient sous
              le plafond ; au-delà, `object-cover` recadre. */}
          <div className="relative aspect-[21/9] max-h-[30vh] w-full shrink-0 overflow-hidden bg-muted">
            <OptimizedImage src={data.image} alt={data.title} width={840} className="h-full w-full object-cover" />
          </div>
          <div className="shrink-0 space-y-2 border-b border-border py-4 pl-5 pr-12">
            {typePill}
            <h2 className="text-xl font-semibold leading-tight text-foreground">{data.title}</h2>
            {metaLine}
          </div>
        </>
      ) : (
        <div
          className="flex shrink-0 items-start gap-4 border-b border-border py-4 pl-5 pr-12"
          style={{ backgroundColor: `color-mix(in oklab, ${badgeColor} 12%, var(--card))` }}
        >
          {data.badge && (
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-xl"
              style={{ backgroundColor: `color-mix(in oklab, ${badgeColor} 22%, var(--card))`, color: badgeColor }}
            >
              <DynamicIcon name={typeIcon} className="h-7 w-7" />
            </span>
          )}
          <div className="min-w-0 space-y-1.5 pt-0.5">
            {typePill}
            <h2 className="text-xl font-semibold leading-tight text-foreground">{data.title}</h2>
            {metaLine}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        {/* ACTION principale */}
        {primaryAction && (
          <a
            href={primaryAction.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <primaryAction.Icon className="h-4 w-4" />
            {primaryAction.label}
          </a>
        )}

        {/* DESCRIPTION (markdown) */}
        {descHtml && (
          <div
            className="prose max-w-none text-foreground/90 [&_p]:leading-relaxed"
            dangerouslySetInnerHTML={{ __html: descHtml }}
            suppressHydrationWarning
          />
        )}

        {/* GALERIE — entité complète (`about.images`) via GalleryGrid partagé (grille + lightbox) */}
        {gallery.length > 0 && (
          <div className="space-y-2">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("resource.gallery")} · {gallery.length}
            </p>
            <GalleryGrid images={gallery} />
          </div>
        )}

        {/* DOCUMENTS — entité complète (`about.files`, classés par extension : audio/vidéo exclus) via FilesList */}
        {documents.length > 0 && (
          <div className="space-y-2">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">{t("resource.documents")}</p>
            <FilesList files={documents} />
          </div>
        )}

        {/* AUDIO — fichiers audio classés par extension (contentKey non fiable) */}
        {audios.length > 0 && (
          <div className="space-y-2">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">{t("resource.audio")}</p>
            {audios.map((src, i) => (
              <AudioPlayer key={`${src}-${i}`} src={src} />
            ))}
          </div>
        )}

        {/* VIDÉO — fichiers vidéo de l'entité (lecteur natif) */}
        {entityVideo.length > 0 && (
          <div className="space-y-2">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">{t("resource.video")}</p>
            {entityVideo.map((src, i) => (
              <video
                key={`${src}-${i}`}
                src={src}
                controls
                preload="metadata"
                className="w-full rounded-lg border border-border bg-black"
              />
            ))}
          </div>
        )}

        {/* LIENS */}
        {data.urls.length > 0 && (
          <div className="space-y-2">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">{t("resource.links")}</p>
            <div className="space-y-1.5">
              {data.urls.map((u, i) => (
                <a
                  key={`${u}-${i}`}
                  href={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <ExternalLink className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{hostname(u)}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{u}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* REPÈRES (facettes cliquables) */}
        {data.facets.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.facets.map((f) => (
              <div key={f.field} className="space-y-1.5">
                <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  {f.label ? t(f.label) : f.field}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {f.tokens.map((token, i) => (
                    <span
                      key={`${token}-${i}`}
                      className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs text-foreground/80"
                    >
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
