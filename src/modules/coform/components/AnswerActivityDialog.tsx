import { useMemo } from "react";
import { Loader2, History as HistoryIcon, UserCircle2, Pencil, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useT } from "@/hooks/useT";
import { useCoFormAnswerHistory } from "../hooks/useCoFormAnswerHistory";
import { formatRelative } from "../utils/formatRelative";
import type { AnswerChange, ExistingAnswerMeta } from "../types";

interface AnswerActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  answerId: string | null | undefined;
  meta?: ExistingAnswerMeta | null;
  /**
   * Map `subFormId → display name` pour rendre l'historique lisible : sans
   * elle, on affiche les clés brutes (ex: `navigatorDesTierslieux1572025_2311_0`)
   * peu utiles à l'utilisateur. Construite par le caller depuis
   * `formData.inputs[stepKey].name`. Optionnel — fallback sur la clé brute
   * pour les steps non trouvées (form modifié depuis l'audit).
   */
  stepNames?: Record<string, string>;
}

/**
 * Format date absolu localisé (utilisé pour la date de création — moins
 * volatile que le dernier modifieur, on préfère un format daté complet).
 */
function formatAbsolute(timestampSec: number, locale: string): string {
  return new Date(timestampSec * 1000).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface HistoryEntryProps {
  entry: AnswerChange;
  t: ReturnType<typeof useT>;
  stepNames?: Record<string, string>;
}

function HistoryEntry({ entry, t, stepNames }: HistoryEntryProps) {
  const isCreate = entry.mutationType === "create";
  const Icon = isCreate ? Plus : Pencil;
  // Résout chaque clé d'étape vers son nom affichable. Fallback sur la clé
  // brute si la step a été supprimée/renommée depuis l'audit — préférable à
  // un placeholder muet.
  const stepsResolved = entry.changedFields.map((k) => stepNames?.[k] ?? k);
  const userLabel = entry.userName.trim() !== ""
    ? entry.userName
    : t("coform.activity.unknownUser");

  // Pour la version "update", on rend le verbe traduit + la liste de noms
  // d'étapes en gras. On utilise un sentinel `__STEPS__` qu'on splitte côté
  // JSX pour réinjecter les noms en `<strong>`. Avantage : la traduction
  // reste un simple "{{steps}}", pas de markup côté i18n.
  const STEPS_MARK = "__STEPS__";
  const action = isCreate
    ? <>{t("coform.activity.entryCreate")}</>
    : (() => {
        const raw = t("coform.activity.entryUpdate", undefined, {
          count: entry.changedFields.length,
          steps: STEPS_MARK,
        });
        const [prefix, suffix = ""] = raw.split(STEPS_MARK);
        return (
          <>
            {prefix}
            {stepsResolved.map((name, i) => (
              <span key={i}>
                {i > 0 && ", "}
                <strong>{name}</strong>
              </span>
            ))}
            {suffix}
          </>
        );
      })();

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 rounded-full bg-muted p-1.5 shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0 text-sm">
        <div className="font-medium truncate">{userLabel}</div>
        <div className="text-xs text-muted-foreground">
          {formatRelative(entry.at, t)} · {action}
        </div>
      </div>
    </div>
  );
}

export function AnswerActivityDialog({
  open,
  onOpenChange,
  answerId,
  meta,
  stepNames,
}: AnswerActivityDialogProps) {
  const t = useT("modules/coform");
  const locale = useMemo(() => (typeof navigator !== "undefined" ? navigator.language : "fr-FR"), []);

  // Ne pas fetch tant que le dialog n'est pas ouvert (évite les calls
  // inutiles + permet à React Query de cache-hit si rouvert rapidement).
  const { history, isLoading, error } = useCoFormAnswerHistory({
    answerId,
    enabled: open,
  });

  const createdLine = meta?.createdBy && meta?.createdAt
    ? t("coform.activity.createdBy", undefined, {
        // Le nom du créateur vient soit de l'historique (mutationType=create),
        // soit on n'a pas l'info au niveau meta — on fallback "utilisateur"
        // mais l'historique en dessous donne le nom proprement.
        name: history.find((h) => h.mutationType === "create")?.userName
          || t("coform.activity.unknownUser"),
        date: formatAbsolute(meta.createdAt, locale),
      })
    : null;

  const lastModifiedLine = meta?.lastModifierName && meta?.lastModifiedAt
    && meta.lastModifier !== meta.createdBy  // n'affiche que si différent du créateur
    ? t("coform.activity.lastModifiedBy", undefined, {
        name: meta.lastModifierName,
        relative: formatRelative(meta.lastModifiedAt, t),
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5" />
            {t("coform.activity.title")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("coform.activity.title")}
          </DialogDescription>
        </DialogHeader>

        {/* Méta principales */}
        {(createdLine || lastModifiedLine) && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
            {createdLine && (
              <div className="flex items-start gap-2 text-sm">
                <UserCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>{createdLine}</span>
              </div>
            )}
            {lastModifiedLine && (
              <div className="flex items-start gap-2 text-sm">
                <Pencil className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>{lastModifiedLine}</span>
              </div>
            )}
          </div>
        )}

        {/* Historique chronologique */}
        <div>
          <h3 className="text-sm font-semibold mb-1">{t("coform.activity.historyTitle")}</h3>
          <Separator className="mb-2" />
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("coform.activity.loading")}
            </div>
          ) : error ? (
            <p className="text-sm text-muted-foreground italic py-2">
              {t("coform.activity.errorLoad")}
            </p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">
              {t("coform.activity.empty")}
            </p>
          ) : (
            <ScrollArea className="max-h-72 pr-3">
              <div className="space-y-1 divide-y">
                {history.map((entry, idx) => (
                  <HistoryEntry key={`${entry.at}-${entry.userId}-${idx}`} entry={entry} t={t} stepNames={stepNames} />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("coform.activity.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
