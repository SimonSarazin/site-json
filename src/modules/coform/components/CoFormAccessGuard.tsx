import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { CoFormAccessInfo, CoFormAccessReason } from "../types";
import "../i18n/i18n";
import {
  AlertCircle,
  Calendar,
  Clock,
  Lock,
  LogIn,
  Pencil,
  Power,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface CoFormAccessGuardProps {
  access: CoFormAccessInfo | null;
  onEditExisting?: () => void;
  onLogin?: () => void;
  children: ReactNode;
}

/**
 * Composant garde d'accès pour CoForm
 * 
 * Vérifie les droits d'accès avant d'afficher le formulaire.
 * Gère tous les cas de refus avec des messages adaptés :
 * - Formulaire pas encore ouvert (dates)
 * - Formulaire fermé (dates)  
 * - Non connecté
 * - Non membre de la communauté
 * - Déjà répondu (avec option d'édition)
 */
export function CoFormAccessGuard({
  access,
  onEditExisting,
  onLogin,
  children,
}: CoFormAccessGuardProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");

  // Si pas d'info d'accès, on laisse passer
  if (!access) {
    return <>{children}</>;
  }

  if (access.canAnswer) {
    return <>{children}</>;
  }

  return (
    <AccessDeniedCard
      access={access}
      reason={access.reason}
      t={t}
      onEditExisting={onEditExisting}
      onLogin={onLogin}
    />
  );
}

// ─── Composant interne : carte de refus d'accès ───────────────────

interface AccessDeniedCardProps {
  access: CoFormAccessInfo;
  reason: CoFormAccessReason;
  t: ReturnType<typeof useT>;
  onEditExisting?: () => void;
  onLogin?: () => void;
}

function AccessDeniedCard({
  access,
  reason,
  t,
  onEditExisting,
  onLogin,
}: AccessDeniedCardProps) {
  const config = getReasonConfig(reason, access, t);

  return (
    <div className="max-w-lg w-full mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
        {/* En-tête coloré — text color hérite de `headerClass` (text-{token}-foreground). */}
        <div className={`px-6 py-8 text-center ${config.headerClass}`}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background/20 backdrop-blur-sm mb-4">
            {config.icon}
          </div>
          <h2 className="text-xl font-bold">
            {config.title}
          </h2>
        </div>

        {/* Corps */}
        <div className="px-6 py-6 space-y-4">
          <p className="text-muted-foreground text-center leading-relaxed">
            {config.description}
          </p>

          {/* Info dates si applicable */}
          {(access.dates.start || access.dates.end) && (
            <DateInfo access={access} t={t} />
          )}

          {/* Boutons d'action */}
          <div className="flex flex-col gap-3 pt-2">
            {reason === "already_answered" && onEditExisting && (
              <Button onClick={onEditExisting} className="gap-2 w-full">
                <Pencil className="w-4 h-4" />
                {t("coform.access.alreadyAnswered.editButton")}
              </Button>
            )}
            {reason === "not_logged_in" && onLogin && (
              <Button onClick={onLogin} className="gap-2 w-full">
                <LogIn className="w-4 h-4" />
                {t("coform.access.notLoggedIn.loginButton")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Composant interne : affichage des dates ──────────────────────

function DateInfo({
  access,
  t,
}: {
  access: CoFormAccessInfo;
  t: ReturnType<typeof useT>;
}) {
  const { start, end } = access.dates;
  
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  let dateText = "";
  if (start && end) {
    dateText = t("coform.access.dateRange", undefined, {
      start: formatDate(start),
      end: formatDate(end),
    });
  } else if (start) {
    dateText = t("coform.access.dateStart", undefined, { start: formatDate(start) });
  } else if (end) {
    dateText = t("coform.access.dateEnd", undefined, { end: formatDate(end) });
  }

  if (!dateText) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
      <Calendar className="w-4 h-4 shrink-0" />
      <span>{dateText}</span>
    </div>
  );
}

// ─── Configuration par raison de refus ────────────────────────────

function getReasonConfig(
  reason: CoFormAccessReason,
  access: CoFormAccessInfo,
  t: ReturnType<typeof useT>,
) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Tokens sémantiques shadcn (warning, info, destructive, primary, muted) — mode sombre
  // automatiquement géré. Avant : palettes Tailwind hardcodées (amber/blue/sky/rose/...).
  switch (reason) {
    case "already_answered":
      return {
        icon: <AlertCircle className="w-8 h-8 text-warning-foreground" />,
        title: t("coform.access.alreadyAnswered.title"),
        description: t("coform.access.alreadyAnswered.description"),
        headerClass: "bg-warning text-warning-foreground",
      };
    case "not_member":
      return {
        icon: <Users className="w-8 h-8 text-info-foreground" />,
        title: t("coform.access.notMember.title"),
        description: t("coform.access.notMember.description"),
        headerClass: "bg-info text-info-foreground",
      };
    case "form_not_started":
      return {
        icon: <Clock className="w-8 h-8 text-info-foreground" />,
        title: t("coform.access.formNotStarted.title"),
        description: t("coform.access.formNotStarted.description", undefined, {
          date: formatDate(access.dates.start),
        }),
        headerClass: "bg-info text-info-foreground",
      };
    case "form_closed":
      return {
        icon: <Lock className="w-8 h-8 text-destructive-foreground" />,
        title: t("coform.access.formClosed.title"),
        description: t("coform.access.formClosed.description", undefined, {
          date: formatDate(access.dates.end),
        }),
        headerClass: "bg-destructive text-destructive-foreground",
      };
    case "form_inactive":
      return {
        icon: <Power className="w-8 h-8 text-muted-foreground" />,
        title: t("coform.access.formInactive.title"),
        description: t("coform.access.formInactive.description"),
        headerClass: "bg-muted text-foreground",
      };
    case "not_logged_in":
      return {
        icon: <LogIn className="w-8 h-8 text-primary-foreground" />,
        title: t("coform.access.notLoggedIn.title"),
        description: t("coform.access.notLoggedIn.description"),
        headerClass: "bg-primary text-primary-foreground",
      };
    default:
      return {
        icon: <ShieldAlert className="w-8 h-8 text-muted-foreground" />,
        title: t("coform.access.denied"),
        description: t("coform.status.error"),
        headerClass: "bg-muted text-foreground",
      };
  }
}

export default CoFormAccessGuard;
