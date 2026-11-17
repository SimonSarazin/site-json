import type { KeyboardEvent } from "react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type KpiCardSize = "sm" | "default" | "lg";

/** Taille de police adaptée à la longueur de la valeur — un cran au-dessus en `lg`, un en dessous en `sm`. */
function valueClass(value: string, size: KpiCardSize): string {
  if (size === "sm") return value.length <= 8 ? "text-xl whitespace-nowrap" : "text-sm leading-snug break-words";
  const lg = size === "lg";
  if (value.length <= 6) return lg ? "text-4xl whitespace-nowrap" : "text-3xl whitespace-nowrap";
  if (value.length <= 12) return lg ? "text-3xl whitespace-nowrap" : "text-2xl whitespace-nowrap";
  return lg ? "text-lg leading-snug break-words" : "text-base leading-snug break-words";
}

/** Classes par taille : carte, libellé, hauteur du sablier, pastille et icône. */
const SIZES: Record<KpiCardSize, { card: string; content: string; label: string; spinner: string; pill: string; icon: string }> = {
  sm: { card: "py-2.5", content: "px-3", label: "text-[10px]", spinner: "h-7", pill: "p-1.5", icon: "h-4 w-4" },
  default: { card: "py-5", content: "px-5", label: "text-xs", spinner: "h-9", pill: "p-2.5", icon: "h-5 w-5" },
  lg: { card: "py-5", content: "px-5", label: "text-sm", spinner: "h-10", pill: "p-3", icon: "h-6 w-6" },
};

interface KpiCardProps {
  icon: string;
  label: string;
  value: string;
  accentClasses: string;
  /** Valeur en cours de calcul : un sablier à sa place, `loadingLabel` pour les lecteurs d'écran. */
  loading?: boolean;
  loadingLabel?: string;
  /** `lg` : libellé, valeur et icône un cran plus grands — un indicateur mis en avant seul ou à deux (totaux
   *  d'heures de la fiche équipement). `sm` : un cran plus petits — indicateurs d'une CARTE de liste (heures d'un
   *  usager dans l'annuaire). Défaut : la taille des grilles de l'observatoire. */
  size?: KpiCardSize;
  /** Carte CLIQUABLE (KPI à filtre de l'observatoire) : bouton accessible au clavier, `actionLabel` en description.
   *  Absent = carte inerte, comme partout ailleurs. */
  onClick?: () => void;
  /** Le filtre de la carte est en place : carte cerclée, `aria-pressed`. */
  active?: boolean;
  actionLabel?: string;
}

/**
 * Carte d'un indicateur. Dans son propre fichier pour être réutilisée SANS le moteur du tableau de bord :
 * `KpiCards` (observatoire), la modale installation, les totaux d'heures des fiches équipement et
 * organisation, et les heures des cartes de l'annuaire (module search), qui n'ont rien à faire de `computeKpiValue`.
 */
export function KpiCard({
  icon,
  label,
  value,
  accentClasses,
  loading,
  loadingLabel,
  size = "default",
  onClick,
  active,
  actionLabel,
}: KpiCardProps) {
  const s = SIZES[size];
  // Une `Card` est un bloc : dans un <button>, son contenu serait invalide. La carte devient donc elle-même le
  // bouton (rôle, focus, Entrée et Espace), comme le demande un élément cliquable non natif. Son nom accessible
  // reste son CONTENU (libellé et chiffre) ; l'action passe en description (`title`) — un `aria-label` taisait le chiffre.
  const onKeyDown = onClick
    ? (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onClick();
      }
    : undefined;
  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? Boolean(active) : undefined}
      title={onClick ? actionLabel : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        "gap-0 rounded-2xl border-border/50 hover:shadow-md transition-shadow min-w-0",
        s.card,
        onClick &&
          "cursor-pointer outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-primary bg-primary/5 ring-2 ring-primary/60",
      )}
    >
      <CardContent className={s.content}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={`${s.label} uppercase tracking-wider text-muted-foreground font-medium`}>
              {label}
            </p>
            {loading ? (
              <div className={`mt-2 flex ${s.spinner} items-center text-muted-foreground`}>
                <Spinner className={size === "sm" ? "h-5 w-5" : "h-6 w-6"} label={loadingLabel} />
              </div>
            ) : (
              <p className={`${size === "sm" ? "mt-1" : "mt-2"} font-bold text-foreground tabular-nums ${valueClass(value, size)}`}>
                {value}
              </p>
            )}
          </div>
          <div className={`rounded-xl ${s.pill} ${accentClasses}`}>
            <DynamicIcon name={icon as IconName} className={s.icon} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
