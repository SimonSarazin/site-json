import type { ReactNode } from "react";
import "./i18n/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/useHydrated";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import type { StatSourceState } from "./statSourceState";

export interface StatFigureProps {
  state: StatSourceState;
  /** Le chiffre écrit de la config (`value`), repli du chiffre compté. */
  written?: string;
  /** Taille et teinte du squelette, à caler sur la typo du chiffre. */
  skeletonClassName?: string;
  /** Met en forme le chiffre connu (couleur, animation…). */
  children: (value: string) => ReactNode;
}

/**
 * Le rendu d'un chiffre de tuile, commun à toutes les sources : compte connu → le compte ; sinon le
 * chiffre écrit s'il existe ; sinon un squelette pendant l'attente et un tiret pour l'absence —
 * jamais un chiffre inventé, jamais un squelette perpétuel.
 *
 * L'absence n'est tranchée qu'APRÈS hydratation : un serveur qui n'a pas résolu l'entité voit
 * « absent » ce que le client, qui résout la sienne, verra « en attente » — trancher dès le SSR
 * désaccorderait les deux rendus.
 *
 * Le plafond du squelette est celui de la requête : en ligne, 30 s par appel du SDK et 3 nouvelles
 * tentatives de React Query (1 + 2 + 4 s), soit ~2 min au pire avant le tiret ; hors ligne, la requête
 * est en PAUSE et le squelette attend le retour du réseau. Voulu : un backend lent qui finit par
 * répondre donne son chiffre, plutôt qu'un tiret prématuré.
 */
export function StatFigure({ state, written, skeletonClassName, children }: StatFigureProps) {
  const hydrated = useHydrated();
  useLoadNamespace("components/sections");
  const t = useT("components/sections");

  if (state.value != null) return <>{children(String(state.value))}</>;
  if (written !== undefined) return <>{children(written)}</>;
  if (state.unavailable && hydrated) {
    return (
      <span>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t("Chiffre non disponible")}</span>
      </span>
    );
  }
  return (
    <>
      <Skeleton
        aria-hidden="true"
        className={cn("inline-block h-[0.85em] w-[2.2ch] align-baseline", skeletonClassName)}
      />
      <span className="sr-only">{t("Chiffre en cours de chargement")}</span>
    </>
  );
}
