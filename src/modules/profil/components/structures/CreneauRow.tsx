// Libellés de statut et noms de jours : ceux du module search, les mêmes que le détail du créneau.
import "@/modules/search/i18n";
import { Building2, ChevronRight, Clock } from "lucide-react";
import { useId } from "react";

import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { statusKey, type CoformAnswer } from "@/modules/search/lib/coformAnswer";
import { DAY_KEYS } from "@/modules/search/lib/schedules";

import { scheduleSummary, weekdayPresence } from "../../lib/managedStructures";
import { STATUS_TONE } from "./statusTone";

/**
 * Bande de la semaine, lundi → dimanche : les jours où la séance a lieu, d'un coup d'œil. Purement
 * visuelle — la ligne porte la même information en texte pour les lecteurs d'écran. L'initiale vient
 * du nom du jour (« Lundi » → « L », « Monday » → « M ») : pas de second jeu de libellés à tenir.
 */
function WeekStrip({ presence, labels }: { presence: readonly boolean[]; labels: readonly string[] }) {
  return (
    <span aria-hidden="true" className="inline-flex gap-1">
      {labels.map((label, i) => (
        <span
          key={DAY_KEYS[i]}
          className={cn(
            "grid size-6 place-items-center rounded-full text-xs font-semibold",
            presence[i] ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {label.charAt(0)}
        </span>
      ))}
    </span>
  );
}

interface CreneauRowProps {
  answer: CoformAnswer;
  onOpen: (opener: HTMLElement) => void;
  /**
   * Structures citées par le créneau, pour une ligne hors de toute structure (créneaux déposés
   * ailleurs) : une ligne « structure » de plus, « Sans structure » si le tableau est vide. Absent —
   * le créneau est déjà rangé sous sa structure — : pas de ligne.
   */
  structureNames?: readonly string[];
}

/**
 * Un créneau, en une ligne : titre, type, statut de modération, jours et horaire (et sa structure
 * quand la ligne n'est pas rangée dessous). La ligne entière est un bouton qui ouvre le détail : son
 * NOM dit l'action et le créneau, sa DESCRIPTION (`aria-describedby`) le reste — un nom fait de tout
 * le contenu ne disait pas l'action.
 */
export function CreneauRow({ answer, onOpen, structureNames }: CreneauRowProps) {
  const t = useT("modules/profil");
  const tSearch = useT("modules/search");
  const id = useId();
  // Des éléments ordinaires (pas un `display: contents`, que certains navigateurs sortent de
  // l'arbre d'accessibilité) : type, statut, structure le cas échéant, jours et horaire.
  const typeId = `${id}-type`;
  const statutId = `${id}-statut`;
  const structureId = `${id}-structure`;
  const horaireId = `${id}-horaire`;
  const key = statusKey(answer.status);
  const { Icon, pill } = STATUS_TONE[key];
  const presence = weekdayPresence(answer.schedules);
  const { first, more } = scheduleSummary(answer.schedules);
  const jours = DAY_KEYS.map((day) => tSearch(`days.${day}`));
  const joursActifs = jours.filter((_, i) => presence[i]);
  const titre = answer.title || t("StructuresTab.untitled");

  return (
    <button
      type="button"
      onClick={(event) => onOpen(event.currentTarget)}
      aria-label={t("StructuresTab.openSlot", undefined, { title: titre })}
      aria-describedby={[answer.typeLabel ? typeId : null, statutId, structureNames ? structureId : null, horaireId]
        .filter(Boolean)
        .join(" ")}
      className={cn(
        // `<type>-card` raccroche la ligne au code couleur des types du site, comme `CardAnswer`
        // (customCSS : `.ssso-card .border-card-border-left`) — d'où le liseré en élément enfant.
        `${answer.typeLabel.toLowerCase()}-card`,
        "group relative flex min-h-14 w-full cursor-pointer items-center gap-3 overflow-hidden rounded-lg border border-border bg-background py-3 pr-3 pl-4 text-left",
        "transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      )}
    >
      <span aria-hidden="true" className="border-card-border-left absolute inset-y-0 left-0 border-l-4" />
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-words font-medium text-foreground">{titre}</span>
          {answer.typeLabel && (
            <span id={typeId} className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              {answer.typeLabel}
            </span>
          )}
          <span id={statutId} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", pill)}>
            <Icon aria-hidden="true" className="size-3.5" />
            {tSearch(`coformAnswer.status.${key}`)}
          </span>
        </span>
        {structureNames && (
          <span id={structureId} className="flex items-center gap-1 text-sm text-muted-foreground">
            <Building2 aria-hidden="true" className="size-3.5 shrink-0" />
            {structureNames.length > 0 ? (
              <>
                {/* Visible : les noms seuls ; annoncé : ce qu'ils sont (même principe que les horaires). */}
                <span aria-hidden="true" className="min-w-0 break-words">{structureNames.join(", ")}</span>
                <span className="sr-only">
                  {t("StructuresTab.submitted.structureSr", undefined, {
                    structures: structureNames.join(", "),
                    count: structureNames.length,
                  })}
                </span>
              </>
            ) : (
              t("StructuresTab.submitted.noStructure")
            )}
          </span>
        )}
        <span id={horaireId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <WeekStrip presence={presence} labels={jours} />
          <span className="sr-only">
            {joursActifs.length
              ? t("StructuresTab.weekDays", undefined, { days: joursActifs.join(", ") })
              : t("StructuresTab.noDays")}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock aria-hidden="true" className="size-3.5" />
            {first ?? t("StructuresTab.noSchedule")}
            {more > 0 && (
              <>
                <span aria-hidden="true">{t("StructuresTab.moreSchedules", undefined, { count: more })}</span>
                <span className="sr-only">{t("StructuresTab.moreSchedulesSr", undefined, { count: more })}</span>
              </>
            )}
          </span>
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </button>
  );
}
