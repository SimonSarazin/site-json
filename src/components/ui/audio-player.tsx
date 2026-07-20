import * as React from "react";
import { AlertCircle, Loader2, Pause, Play } from "lucide-react";

import { useHydrated } from "@/hooks/useHydrated";
import {
  VITESSES_LECTURE,
  calculerPourcentage,
  clamp,
  formaterTemps,
  formaterVitesse,
  vitesseSuivante,
} from "@/lib/audioPlayerUtils";
import { cn } from "@/lib/utils";

type AudioPlayerLabels = {
  lecteur: string;
  lire: string;
  pause: string;
  position: string;
  vitesse: string;
  erreur: string;
};

const LIBELLES_DEFAUT: AudioPlayerLabels = {
  lecteur: "Lecteur audio",
  lire: "Lire",
  pause: "Mettre en pause",
  position: "Position de lecture",
  vitesse: "Vitesse de lecture",
  erreur: "Impossible de lire ce fichier audio.",
};

type AudioPlayerProps = {
  /** URL du fichier audio. */
  src: string;
  /** Libellé accessible du lecteur (ex. titre du témoignage), affiché au-dessus de la barre. */
  title?: string;
  className?: string;
  autoPlay?: boolean;
  /** Libellés surchargables (défauts en français). */
  labels?: Partial<AudioPlayerLabels>;
};

function AudioPlayer({
  src,
  title,
  className,
  autoPlay = false,
  labels,
}: AudioPlayerProps) {
  // L'API HTMLMediaElement n'existe qu'au client : on ne monte l'<audio>
  // qu'après hydratation pour que le 1er render client soit identique au SSR.
  const hydrated = useHydrated();
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const [enLecture, setEnLecture] = React.useState(false);
  const [tempsCourant, setTempsCourant] = React.useState(0);
  const [duree, setDuree] = React.useState(0);
  const [vitesse, setVitesse] = React.useState<number>(VITESSES_LECTURE[0]);
  const [pret, setPret] = React.useState(false);
  const [enErreur, setEnErreur] = React.useState(false);

  const l = { ...LIBELLES_DEFAUT, ...labels };

  // `loadstart` est émis à chaque nouvelle ressource (montage ou changement de
  // src) : c'est l'élément audio qui pilote la remise à zéro des états dérivés.
  const surDebutChargement = () => {
    setEnLecture(false);
    setTempsCourant(0);
    setDuree(0);
    setPret(false);
    setEnErreur(false);
  };

  const surMetadonnees = () => {
    const audio = audioRef.current;
    if (!audio) return;
    // Certains flux renvoient une durée Infinity : on garde 0 (barre inerte, temps "0:00").
    setDuree(Number.isFinite(audio.duration) ? audio.duration : 0);
    setPret(true);
    // La vitesse choisie doit survivre à un changement de source.
    audio.playbackRate = vitesse;
  };

  const basculerLecture = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      // Le rejet de play() (lecture bloquée par le navigateur) est ignoré :
      // l'état reste piloté par les événements play/pause/error de l'élément.
      void audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  const surChangementPosition = (event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || duree <= 0) return;
    const position = clamp(Number(event.target.value), 0, duree);
    audio.currentTime = position;
    setTempsCourant(position);
  };

  const surChangementVitesse = () => {
    const nouvelle = vitesseSuivante(vitesse);
    setVitesse(nouvelle);
    if (audioRef.current) audioRef.current.playbackRate = nouvelle;
  };

  const chargement = hydrated && !pret && !enErreur;
  const pourcentage = calculerPourcentage(tempsCourant, duree);

  return (
    <div
      data-slot="audio-player"
      role="group"
      aria-label={title ?? l.lecteur}
      className={cn(
        "bg-card text-card-foreground border-border flex w-full items-center gap-3 rounded-lg border p-3",
        className
      )}
    >
      {hydrated && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          autoPlay={autoPlay}
          onLoadStart={surDebutChargement}
          onLoadedMetadata={surMetadonnees}
          onTimeUpdate={() => setTempsCourant(audioRef.current?.currentTime ?? 0)}
          onPlay={() => setEnLecture(true)}
          onPause={() => setEnLecture(false)}
          onError={() => {
            setEnErreur(true);
            setEnLecture(false);
          }}
        />
      )}

      {enErreur ? (
        <p
          role="alert"
          className="text-muted-foreground flex items-center gap-2 text-sm"
        >
          <AlertCircle className="text-destructive size-4 shrink-0" aria-hidden="true" />
          {l.erreur}
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={basculerLecture}
            disabled={!hydrated || chargement}
            aria-label={enLecture ? l.pause : l.lire}
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/50 inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            {chargement ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : enLecture ? (
              <Pause className="size-4" aria-hidden="true" />
            ) : (
              // Le triangle Play paraît décentré dans un cercle : léger décalage optique.
              <Play className="size-4 translate-x-px" aria-hidden="true" />
            )}
          </button>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {title && (
              <span className="text-foreground truncate text-sm font-medium">
                {title}
              </span>
            )}
            <input
              type="range"
              min={0}
              max={duree > 0 ? duree : 1}
              step="any"
              value={tempsCourant}
              onChange={surChangementPosition}
              disabled={!hydrated || duree <= 0}
              aria-label={l.position}
              aria-valuetext={`${formaterTemps(tempsCourant)} / ${formaterTemps(duree)}`}
              className={cn(
                "h-1.5 w-full cursor-pointer appearance-none rounded-full",
                "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
                "disabled:cursor-default disabled:opacity-50",
                "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
                "[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0"
              )}
              // Partie lue en primary, reste en muted : un range natif ne stylise
              // pas sa piste via Tailwind seul, d'où le dégradé calculé inline.
              style={{
                background: `linear-gradient(to right, var(--primary) ${pourcentage}%, var(--muted) ${pourcentage}%)`,
              }}
            />
            <div className="text-muted-foreground flex items-center justify-between text-xs tabular-nums">
              <span>{formaterTemps(tempsCourant)}</span>
              <span>{formaterTemps(duree)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={surChangementVitesse}
            disabled={!hydrated}
            aria-label={`${l.vitesse} : ${formaterVitesse(vitesse)}`}
            className="border-border text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 h-7 w-12 shrink-0 rounded-md border text-xs font-medium tabular-nums transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            {formaterVitesse(vitesse)}
          </button>
        </>
      )}
    </div>
  );
}

export { AudioPlayer };
export type { AudioPlayerProps, AudioPlayerLabels };
// Export par défaut pour le lazy-loading (React.lazy) dans le drawer de preview.
export default AudioPlayer;
