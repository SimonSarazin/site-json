import { useRef, useState, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Formate des secondes en `m:ss`. */
function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Vitesses de lecture, cyclées au clic (utile pour écouter un témoignage : 1x → 1.25 → 1.5 → 2 → 1). */
const SPEEDS: number[] = [1, 1.25, 1.5, 2];

interface AudioPlayerProps {
  /** URL du média (absolue — normalisée par ApiClient pour un docPath, ou objectURL local). */
  src: string;
  className?: string;
  /** Compact : masque les temps + la vitesse (pour une cellule de tableau admin). */
  compact?: boolean;
}

/**
 * Lecteur audio réutilisable au style shadcn (Button + Slider), sans dépendance externe.
 * play/pause · seek · temps courant/durée · vitesse (cyclée). `<audio>` masqué piloté par ref, `preload="metadata"`.
 *
 * DURÉE : lue sur `loadedmetadata`/`durationchange` (+ `readyState` au montage), keyée sur `src`. Pour un mp3 VBR
 * `duration=Infinity` au début → on NE force PAS le calcul par un seek (= téléchargement COMPLET du fichier ;
 * patron ElevenLabs UI) : le slider est simplement désactivé tant que la durée n'est pas finie, et elle apparaît
 * dès que le navigateur la connaît (immédiat en CBR, en cours de lecture en VBR). Zéro download eager.
 */
export function AudioPlayer({ src, className, compact = false }: AudioPlayerProps) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const read = () => { if (Number.isFinite(a.duration) && a.duration > 0) setDuration(a.duration); };
    if (a.readyState >= 1) read(); // métadonnées déjà là (remount / fichier en cache)
    a.addEventListener("loadedmetadata", read);
    a.addEventListener("durationchange", read);
    return () => {
      a.removeEventListener("loadedmetadata", read);
      a.removeEventListener("durationchange", read);
    };
  }, [src]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) void a.play(); else a.pause();
  };
  const seek = (v: number[]) => {
    const a = ref.current;
    const t = v[0];
    if (a && Number.isFinite(t)) { a.currentTime = t; setCurrent(t); }
  };
  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
    setRate(next);
    if (ref.current) ref.current.playbackRate = next;
  };

  const known = Number.isFinite(duration) && duration > 0;
  return (
    <div className={cn("flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Lecture"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      {!compact && (
        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{fmtTime(current)}</span>
      )}
      <Slider
        className="flex-1"
        min={0}
        max={known ? duration : 0}
        step={0.1}
        value={[known ? Math.min(current, duration) : 0]}
        onValueChange={seek}
        disabled={!known}
        aria-label="Position de lecture"
      />
      {!compact && (
        <span className="w-9 shrink-0 text-xs tabular-nums text-muted-foreground">{known ? fmtTime(duration) : "--:--"}</span>
      )}
      {!compact && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={cycleSpeed}
          className="h-8 shrink-0 px-1.5 text-xs font-medium tabular-nums text-muted-foreground"
          aria-label={`Vitesse de lecture ${rate}×`}
          title="Vitesse de lecture"
        >
          {rate}×
        </Button>
      )}
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  );
}
