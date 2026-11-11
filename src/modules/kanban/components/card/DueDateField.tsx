import { useId, type ReactElement } from "react";
import { CircleCheck, Clock, TriangleAlert, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDayClock } from "@/modules/kanban/components/board/useDayClock";
import { Field } from "@/modules/kanban/components/ui/Field";
import { fieldDescribedBy } from "@/modules/kanban/components/ui/fieldIds";
import { useInterfaceLanguage } from "@/modules/kanban/hooks/useInterfaceLanguage";
import { daysUntil, dueStatus, formatDate, reconcileDateInput, toDateInputValue, type DateZone, type DayEdge } from "@/modules/kanban/lib/dates";

/*
 * Des ÉLÉMENTS constants, pas des composants choisis pendant le rendu : une variable de type
 * composant produit un type de nœud différent à chaque rendu (`react-hooks/static-components`).
 */
const DUE_ICONS = {
  overdue: <TriangleAlert aria-hidden className="size-3.5 shrink-0" />,
  clock: <Clock aria-hidden className="size-3.5 shrink-0" />,
  done: <CircleCheck aria-hidden className="size-3.5 shrink-0 text-[var(--ck-success-ink)]" />,
};

export interface DueDateFieldProps {
  /** Timestamp en secondes, ou `null` quand la carte n'a pas d'échéance. */
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  /** Une carte close n'est jamais en retard (RG-30). */
  completedAt?: number | null;
  /** Carte close par son STATUT, même sans date de clôture (§11.9 E11, `isCardDone`). */
  done?: boolean;
  /** Fuseau du jour civil (`dateZoneFor` de la source) : local sur un tableau relié. */
  zone: DateZone;
  /** Borne du jour posée à la saisie : FIN de jour pour l'échéance d'un tableau relié (`DayEdge`). */
  edge: DayEdge;
  /** Instant d'ORIGINE : re-choisir son jour garde l'heure posée dans Kanban gestion. */
  original?: number | null;
  /** Message déjà traduit. */
  error?: string;
  className?: string;
}

/** Échéance de la fiche de carte, reprise de co-kanban (`DueDateField`). */
export function DueDateField({ value, onChange, disabled = false, completedAt = null, done = false, zone, edge, original, error, className }: DueDateFieldProps) {
  const { t } = useTranslation("modules/kanban");
  const locale = useInterfaceLanguage();
  const inputId = useId();
  const statusId = useId();

  /*
   * L'instant courant n'est connu que dans le navigateur : au rendu serveur comme au premier
   * rendu client il vaut 0, aucun retard n'est affiché et le HTML est le même des deux côtés.
   */
  const nowSeconds = useDayClock();

  // Close par son statut sans date de clôture : aucune aide (ni « En retard », ni « Terminée le »).
  const status = nowSeconds === 0 || (done && completedAt === null) ? "none" : dueStatus(value, completedAt, nowSeconds, zone);
  const days = nowSeconds > 0 && value !== null ? daysUntil(value, nowSeconds, zone) : 0;

  /*
   * L'état de l'échéance porte une ICÔNE et un MOT, jamais la seule couleur : « en retard » et
   * « proche » ne se distinguent pas autrement pour qui ne perçoit pas le rouge et l'ambre.
   */
  const hint: { icon: ReactElement; text: string; tone: string } | null =
    status === "overdue"
      ? { icon: DUE_ICONS.overdue, text: t("dueDate.overdue", { count: Math.abs(days) }), tone: "font-medium text-destructive" }
      : status === "today"
        ? { icon: DUE_ICONS.clock, text: t("dueDate.today"), tone: "font-medium text-[var(--ck-warn-ink)]" }
        : status === "soon"
          ? { icon: DUE_ICONS.clock, text: t("dueDate.soon", { count: days }), tone: "font-medium text-[var(--ck-warn-ink)]" }
          : status === "later"
            ? { icon: DUE_ICONS.clock, text: t("dueDate.later", { count: days }), tone: "text-muted-foreground" }
            : status === "done"
              ? { icon: DUE_ICONS.done, text: t("dueDate.completed", { date: formatDate(completedAt, locale, zone) }), tone: "text-muted-foreground" }
              : null;

  return (
    <Field className={className} label={t("dueDate.label")} htmlFor={inputId} error={error}>
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          type="date"
          disabled={disabled}
          value={toDateInputValue(value, zone)}
          aria-invalid={error !== undefined || undefined}
          // L'aide d'échéance n'est PAS le `hint` du champ : calculée après hydratation, `<Field>`
          // la rendrait dans le HTML serveur.
          aria-describedby={cn(fieldDescribedBy(inputId, { error }) ?? "", hint ? statusId : "").trim() || undefined}
          onChange={(event) => onChange(reconcileDateInput(event.target.value, original, zone, edge))}
          className="pointer-coarse:h-11"
        />
        {value !== null && !disabled ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("dueDate.clear")} className="text-muted-foreground pointer-coarse:size-11" onClick={() => onChange(null)}>
            <X aria-hidden />
          </Button>
        ) : null}
      </div>

      {hint ? (
        <p id={statusId} className={cn("flex items-center gap-1.5 text-xs", hint.tone)}>
          {hint.icon}
          {hint.text}
        </p>
      ) : null}
    </Field>
  );
}
