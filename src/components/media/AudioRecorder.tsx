import { useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveWaveform } from "@/components/media/LiveWaveform";
import { cn } from "@/lib/utils";

/**
 * Choisit le meilleur `mimeType` d'enregistrement supporté + l'extension à donner au fichier.
 * MediaRecorder N'ENCODE PAS de mp3 : Chrome/FF → webm/opus, Firefox → ogg, Safari → mp4 (≈ m4a).
 * L'extension conditionne l'acceptation backend (whitelist étendue à webm/ogg + m4a existant).
 */
function pickRecordingMime(): { mimeType: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates: Array<{ mimeType: string; ext: string }> = [
    { mimeType: "audio/webm;codecs=opus", ext: "webm" },
    { mimeType: "audio/webm", ext: "webm" },
    { mimeType: "audio/mp4", ext: "m4a" }, // Safari
    { mimeType: "audio/ogg;codecs=opus", ext: "ogg" },
    { mimeType: "audio/ogg", ext: "ogg" },
  ];
  for (const c of candidates) if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
  return { mimeType: "", ext: "webm" }; // fallback : le navigateur choisit son conteneur
}

interface AudioRecorderProps {
  /** Appelé avec le fichier enregistré — à ajouter aux `added` du champ (upload via le flux existant). */
  onRecorded: (file: File) => void;
  className?: string;
}

/**
 * Enregistreur audio in-navigateur (Paroles de parents). Bouton micro → visualisation `LiveWaveform` EN DIRECT
 * → `MediaRecorder` branché sur le stream (via `onStreamReady`) → à l'arrêt, produit un `File` (webm/opus le plus
 * souvent, mp4 sur Safari), remis à `onRecorded`. Le mic est coupé au démontage de `LiveWaveform` (active=false).
 */
export function AudioRecorder({ onRecorded, className }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const extRef = useRef<string>("webm");

  const onStreamReady = (stream: MediaStream) => {
    const picked = pickRecordingMime();
    if (!picked) { setError("Enregistrement non supporté par ce navigateur."); setRecording(false); return; }
    extRef.current = picked.ext;
    chunksRef.current = [];
    try {
      const rec = picked.mimeType
        ? new MediaRecorder(stream, { mimeType: picked.mimeType })
        : new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 0) {
          const file = new File([blob], `parole-${blob.size}.${extRef.current}`, { type: blob.type });
          onRecorded(file);
        }
      };
      rec.start();
      recorderRef.current = rec;
    } catch {
      setError("Enregistrement non supporté par ce navigateur.");
      setRecording(false);
    }
  };

  const start = () => { setError(null); setRecording(true); };
  const stop = () => {
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
    recorderRef.current = null;
    setRecording(false); // LiveWaveform active=false → coupe le micro
  };

  return (
    <div className={cn("rounded-md border border-dashed border-border bg-muted/20 p-2", className)}>
      <div className="flex items-center gap-2">
        {!recording ? (
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={start}>
            <Mic className="h-4 w-4" /> Enregistrer
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={stop}>
            <Square className="h-4 w-4 fill-current" /> Arrêter
          </Button>
        )}
        {recording && (
          <LiveWaveform
            active
            onStreamReady={onStreamReady}
            onError={() => { setError("Micro inaccessible (autorisation refusée ?)."); setRecording(false); }}
            className="flex-1"
            height={40}
          />
        )}
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
