import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { kanbanErrorText } from "@/modules/kanban/lib/kanbanErrors";

export interface DangerNoticeProps {
  children: ReactNode;
  /**
   * `alert` : le bandeau est annoncé dès son insertion, pour un message qui apparaît EN MÊME
   * TEMPS que son conteneur. Sans rôle, c'est à l'appelant de fournir la région vivante.
   */
  role?: "alert";
  /** Commande de reprise (« Réessayer »), en bout de bandeau. */
  action?: ReactNode;
  className?: string;
}

/**
 * Bandeau d'échec ou de blocage : encre d'alerte du site sur sa teinte, triangle, texte. Un
 * seul dessin pour toutes les boîtes du module (repris de co-kanban). Le filet transparent ne
 * se voit qu'en couleurs forcées, où la teinte disparaît : le bandeau y garde son contour.
 */
export function DangerNotice({ children, role, action, className }: DangerNoticeProps) {
  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-2 rounded-xl border border-transparent bg-destructive/10 p-3 text-xs text-destructive",
        action !== undefined && "flex-wrap items-center gap-3",
        className,
      )}
    >
      <TriangleAlert aria-hidden className={cn("size-4 shrink-0", action === undefined && "mt-px")} />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

export interface FailureNoticeProps {
  /** Échec à dire (erreur levée par le transport ou autre) ; `null` = rien. */
  error: unknown;
  /**
   * `region` (défaut) : région vivante MONTÉE EN PERMANENCE, où le bandeau apparaît — pour un
   * échec qui survient après un geste. `alert` : le bandeau seul, `role="alert"`, pour un
   * échec rendu avec son écran (chargement d'une liste).
   */
  announce?: "region" | "alert";
  action?: ReactNode;
  className?: string;
}

/**
 * Échec d'un appel, traduit et annoncé : la RÈGLE de traduction est celle de
 * `kanbanErrorText` (raison fine du serveur, valeurs interpolées, repli du transport), le dessin
 * celui de `DangerNotice`.
 */
export function FailureNotice({ error, announce = "region", action, className }: FailureNoticeProps) {
  const { t } = useTranslation("modules/kanban");
  const notice =
    error === null || error === undefined ? null : (
      <DangerNotice role={announce === "alert" ? "alert" : undefined} action={action} className={className}>
        {kanbanErrorText(t, error)}
      </DangerNotice>
    );
  if (announce === "alert") return notice;
  return (
    <div aria-live="assertive" aria-atomic="true">
      {notice}
    </div>
  );
}
