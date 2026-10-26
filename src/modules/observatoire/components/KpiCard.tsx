import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

/** Taille de police adaptée à la longueur de la valeur — un cran au-dessus en `lg`. */
function valueClass(value: string, lg: boolean): string {
  if (value.length <= 6) return lg ? "text-4xl whitespace-nowrap" : "text-3xl whitespace-nowrap";
  if (value.length <= 12) return lg ? "text-3xl whitespace-nowrap" : "text-2xl whitespace-nowrap";
  return lg ? "text-lg leading-snug break-words" : "text-base leading-snug break-words";
}

interface KpiCardProps {
  icon: string;
  label: string;
  value: string;
  accentClasses: string;
  /** Valeur en cours de calcul : un sablier à sa place, `loadingLabel` pour les lecteurs d'écran. */
  loading?: boolean;
  loadingLabel?: string;
  /** `lg` : libellé, valeur et icône un cran plus grands — un indicateur mis en avant seul ou à deux (totaux
   *  d'heures de la fiche équipement). Défaut : la taille des grilles de l'observatoire. */
  size?: "default" | "lg";
}

/**
 * Carte d'un indicateur. Dans son propre fichier pour être réutilisée SANS le moteur du tableau de bord :
 * `KpiCards` (observatoire), la modale installation, et les totaux d'heures des fiches équipement et
 * organisation (module search), qui n'ont rien à faire de `computeKpiValue`.
 */
export function KpiCard({ icon, label, value, accentClasses, loading, loadingLabel, size = "default" }: KpiCardProps) {
  const lg = size === "lg";
  return (
    <Card className="gap-0 rounded-2xl border-border/50 py-5 hover:shadow-md transition-shadow min-w-0">
      <CardContent className="px-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={`${lg ? "text-sm" : "text-xs"} uppercase tracking-wider text-muted-foreground font-medium`}>
              {label}
            </p>
            {loading ? (
              <div className={`mt-2 flex ${lg ? "h-10" : "h-9"} items-center text-muted-foreground`}>
                <Spinner className="h-6 w-6" label={loadingLabel} />
              </div>
            ) : (
              <p className={`mt-2 font-bold text-foreground tabular-nums ${valueClass(value, lg)}`}>
                {value}
              </p>
            )}
          </div>
          <div className={`rounded-xl ${lg ? "p-3" : "p-2.5"} ${accentClasses}`}>
            <DynamicIcon name={icon as IconName} className={lg ? "h-6 w-6" : "h-5 w-5"} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
