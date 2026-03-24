import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;

export interface ImageViewerImage {
  src: string;
  name?: string;
}

export interface ImageViewerProps {
  images: ImageViewerImage[];
  /** Index de l'image à afficher à l'ouverture. Réinitialisé à chaque (re)ouverture. */
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

/**
 * Dialogue interne monté uniquement quand le viewer est ouvert.
 * L'état de navigation est local et initialisé depuis initialIndex sans effet.
 */
function ImageViewerDialog({
  images,
  initialIndex,
  onClose,
}: {
  images: ImageViewerImage[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [fitSize, setFitSize] = useState<{ w: number; h: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const prevZoomRef = useRef(1);
  const total = images.length;
  const current = images[index];

  // Calcule la taille « fit » réelle de l'image dans le container au chargement
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const container = scrollRef.current;
    if (!container) return;
    const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const ratio = Math.min(cw / nw, ch / nh);
    setFitSize({ w: Math.round(nw * ratio), h: Math.round(nh * ratio) });
  }, []);

  // Réinitialise zoom et fitSize au changement d'image
  const goNext = useCallback(() => { setIndex((i) => Math.min(i + 1, total - 1)); setZoom(1); setFitSize(null); }, [total]);
  const goPrev = useCallback(() => { setIndex((i) => Math.max(i - 1, 0)); setZoom(1); setFitSize(null); }, []);
  const zoomIn  = useCallback(() => setZoom((z) => Math.min(+(z + ZOOM_STEP).toFixed(2), ZOOM_MAX)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(+(z - ZOOM_STEP).toFixed(2), ZOOM_MIN)), []);

  // Maintient le centre du viewport lors d'un changement de zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || prevZoomRef.current === zoom) return;
    const ratio = zoom / prevZoomRef.current;
    const cx = el.scrollLeft + el.clientWidth / 2;
    const cy = el.scrollTop + el.clientHeight / 2;
    el.scrollLeft = cx * ratio - el.clientWidth / 2;
    el.scrollTop  = cy * ratio - el.clientHeight / 2;
    prevZoomRef.current = zoom;
  }, [zoom]);

  // Drag-to-pan handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (zoom <= 1) return;
    const el = scrollRef.current;
    if (!el) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    el.setPointerCapture(e.pointerId);
    el.style.cursor = "grabbing";
    e.preventDefault();
  }, [zoom]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = dragStart.current.scrollLeft - (e.clientX - dragStart.current.x);
    el.scrollTop = dragStart.current.scrollTop - (e.clientY - dragStart.current.y);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const el = scrollRef.current;
    if (el) {
      el.releasePointerCapture(e.pointerId);
      el.style.cursor = zoom > 1 ? "grab" : "default";
    }
  }, [zoom]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "+" || e.key === "=") zoomIn();
      else if (e.key === "-") zoomOut();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, zoomIn, zoomOut]);

  if (!current) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="w-[98vw] max-w-[98vw] sm:max-w-[80vw] max-h-[96vh] p-0 gap-0 overflow-hidden bg-black/95 border-none [&>button]:hidden"
        onPointerDownOutside={onClose}
      >
        <DialogTitle className="sr-only">{current.name ?? "Image"}</DialogTitle>
        {/* Conteneur principal — position relative pour les overlays absolus */}
        <div className="relative w-full h-[92vh] overflow-hidden">

          {/*
            Zone scrollable : le container a une taille fixe (w-full h-full).
            Le div interne a une taille explicite en pixels quand zoomé
            → déborde → overflow-auto crée les scrollbars.
          */}
          <div
            ref={scrollRef}
            className="w-full h-full"
            style={{
              overflow: zoom > 1 ? "scroll" : "hidden",
              cursor: zoom > 1 ? "grab" : "default",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                // minWidth/minHeight garantit que le wrapper remplit toujours le container
                // → l'image reste centrée même quand la taille zoomée est inférieure au container
                minWidth: "100%",
                minHeight: "100%",
                ...(fitSize && zoom > 1
                  ? { width: fitSize.w * zoom, height: fitSize.h * zoom }
                  : {}),
              }}
            >
              <img
                key={current.src}
                src={current.src}
                alt={current.name ?? "Image"}
                onLoad={handleImageLoad}
                className="select-none block"
                style={
                  fitSize
                    ? {
                        // Taille explicite = taille fit × zoom → l'image grossit vraiment
                        width: fitSize.w * zoom,
                        height: fitSize.h * zoom,
                        flexShrink: 0,
                        transition: "width 0.15s ease, height 0.15s ease",
                      }
                    : { maxWidth: "100%", maxHeight: "100%" }
                }
              />
            </div>
          </div>

          {/* Fermer */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-3 right-3 z-10 h-9 w-9 p-0 text-white/80 hover:text-white hover:bg-white/10"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Contrôles zoom — en haut à gauche */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-md bg-black/40 px-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20"
              disabled={zoom <= ZOOM_MIN}
              onClick={zoomOut}
              aria-label="Zoom arrière"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="min-w-12 text-center text-xs text-white/70 tabular-nums select-none">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20"
              disabled={zoom >= ZOOM_MAX}
              onClick={zoomIn}
              aria-label="Zoom avant"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation précédent */}
          {total > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 p-0 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20"
              disabled={index === 0}
              onClick={goPrev}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}

          {/* Navigation suivant */}
          {total > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 p-0 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20"
              disabled={index === total - 1}
              onClick={goNext}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}

          {/* Footer : nom + compteur */}
          {(current.name || total > 1) && (
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-linear-to-t from-black/60 to-transparent pointer-events-none">
              {current.name ? (
                <span className="text-sm text-white/90 truncate mr-4">{current.name}</span>
              ) : (
                <span />
              )}
              {total > 1 && (
                <span className="text-xs text-white/60 shrink-0">
                  {index + 1} / {total}
                </span>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Lightbox réutilisable : monte le dialogue uniquement quand open=true,
 * ce qui évite de gérer la réinitialisation de l'index par effet.
 */
export function ImageViewer({ images, initialIndex = 0, open, onClose }: ImageViewerProps) {
  if (!open || images.length === 0) return null;
  return <ImageViewerDialog images={images} initialIndex={initialIndex} onClose={onClose} />;
}
