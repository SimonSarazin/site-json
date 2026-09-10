import { useState, type ComponentProps, type ReactNode } from "react";
import { Check, ChevronDown, Lock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import "../i18n/i18n";
import {
  computeStepsWindow,
  firstErrorStep,
  railStateBetween,
  type RailState,
  type StepNavItem,
  type StepStatus,
} from "../utils/stepsNav";

/**
 * En-tête de navigation entre les étapes d'un formulaire multi-étapes.
 *
 * Design tranché avec l'user le 4 septembre (banc d'essai
 * `.claude/doc/stepper-banc-essai.html`, options A et B) :
 *
 * - **ordinateur** : une fenêtre d'étapes reliées par un rail ; toutes cliquables,
 *   en création comme en édition, sauf celles réservées à un autre rôle ;
 * - **téléphone** : la même chose repliée sur l'étape courante ;
 * - **un seul sommaire**, ouvert depuis les nœuds « ⋯ », depuis le compteur, ou
 *   depuis le bouton d'étape sur téléphone.
 *
 * Ce composant ne décide rien : les états viennent de `utils/stepsNav`, et
 * l'appelant reste maître de ce qu'il fait avant de changer d'étape (sauver le
 * brouillon, notamment — cf. `MultiStepCoForm`).
 */

type Translate = ReturnType<typeof useT>;

interface StepsNavProps {
  steps: StepNavItem[];
  /** Index de l'étape courante dans `steps`. */
  currentIndex: number;
  /** Appelé avec l'index de l'étape choisie. */
  onStepSelect: (index: number) => void;
  /** Numéroter les pastilles des étapes encore à faire. Défaut : true. */
  showStepNumbers?: boolean;
  className?: string;
}

export function StepsNav({
  steps,
  currentIndex,
  onStepSelect,
  showStepNumbers = true,
  className,
}: StepsNavProps) {
  const t = useT("modules/coform");

  const total = steps.length;
  const { start, end } = computeStepsWindow(total, currentIndex);
  const current = steps[currentIndex];

  const counter = t("coform.steps.counter", undefined, { current: currentIndex + 1, total });

  const summary = (trigger: ReactNode) => (
    <StepsSummaryPopover steps={steps} onStepSelect={onStepSelect} trigger={trigger} />
  );

  return (
    <nav aria-label={t("coform.steps.navLabel")} className={cn("pb-4 border-b", className)}>
      {/* ── Ordinateur : la fenêtre et son rail ── */}
      <div className="hidden md:block">
        <ol className="flex list-none items-start gap-1 p-0 m-0">
          {start > 0 && (
            <li className="contents">
              {summary(
                <OverflowNode label={t("coform.steps.hiddenBefore", undefined, { count: start })} />
              )}
            </li>
          )}

          {steps.slice(start, end).map((step, offset) => {
            const absolute = start + offset;
            // Le rail vit DANS le bouton : il tient la pastille par le bord, quelle
            // que soit la largeur du libellé. Aux deux bouts de la fenêtre il file
            // vers le « ⋯ » — ce qu'on voit est une portion d'un parcours qui continue.
            const railBefore =
              offset > 0
                ? railStateBetween(steps[absolute - 1], step)
                : start > 0
                  ? railStateBetween(steps[start - 1], step)
                  : null;
            const railAfter =
              absolute === end - 1 && end < total ? railStateBetween(step, steps[end]) : null;

            return (
              <li key={step.id} className="contents">
                <StepButton
                  step={step}
                  showStepNumbers={showStepNumbers}
                  railBefore={railBefore}
                  railBeforeFromOverflow={offset === 0}
                  railAfter={railAfter}
                  onSelect={onStepSelect}
                />
              </li>
            );
          })}

          {end < total && (
            <li className="contents">
              {summary(
                <OverflowNode
                  label={t("coform.steps.hiddenAfter", undefined, { count: total - end })}
                />
              )}
            </li>
          )}
        </ol>

        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">{counter}</span>
          {summary(
            <button
              type="button"
              className="cursor-pointer text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {t("coform.steps.allSteps")}
            </button>
          )}
        </div>
      </div>

      {/* ── Téléphone : l'étape courante, et le même sommaire ── */}
      <div className="md:hidden">
        <div className={cn("flex", steps.length > 12 ? "gap-px" : "gap-1")} aria-hidden="true">
          {steps.map((step) => (
            <span
              key={step.id}
              className={cn("h-1 flex-1 rounded-full", PROGRESS_TRACK_CLASS[step.status])}
            />
          ))}
        </div>
        {summary(
          <button
            type="button"
            className="mt-2 flex w-full min-w-0 cursor-pointer items-center justify-between gap-3 rounded-lg border bg-card p-2.5 text-left"
          >
            <span className="min-w-0">
              <span className="block text-xs tabular-nums text-muted-foreground">
                {counter}
                {current ? ` · ${t(STATUS_LABEL_KEY[current.status])}` : ""}
              </span>
              {/* `line-clamp-1` et non `truncate` : `truncate` pose
                  `white-space: nowrap`, dont la largeur min-content est la phrase
                  ENTIÈRE — elle remonte alors jusqu'à élargir la modale. */}
              {current?.name && (
                <span className="line-clamp-1 text-sm font-semibold text-foreground">
                  {current.name}
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-primary">
              {t("coform.steps.allSteps")}
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}

// ─── Une étape dans la fenêtre ────────────────────────────────────────────────

function StepButton({
  step,
  showStepNumbers,
  railBefore,
  railBeforeFromOverflow,
  railAfter,
  onSelect,
}: {
  step: StepNavItem;
  showStepNumbers: boolean;
  railBefore: RailState | null;
  /** Le voisin de gauche est le nœud « ⋯ » et non une étape : géométrie différente. */
  railBeforeFromOverflow: boolean;
  railAfter: RailState | null;
  onSelect: (index: number) => void;
}) {
  const t = useT("modules/coform");
  const label = accessibleStepLabel(step, t);

  return (
    <button
      type="button"
      onClick={() => step.clickable && onSelect(step.index)}
      // `aria-disabled` plutôt que `disabled` : une étape réservée doit rester
      // atteignable au clavier et annonçable — sinon celui qui navigue au lecteur
      // d'écran ignore jusqu'à son existence.
      aria-disabled={!step.clickable || undefined}
      aria-current={step.status === "current" ? "step" : undefined}
      aria-label={label}
      title={step.name || label}
      // Toute la boîte reste cliquable — c'est la cible, elle doit être large.
      // Mais elle ne se PEINT pas : un rectangle gris derrière une pastille et un
      // libellé ne désigne rien. Le survol éclaire ce qu'on vise : la pastille,
      // son libellé, et les segments de rail qui la touchent — celui qui y arrive
      // (enfant de ce bouton, `group-hover`) comme celui qui en part (enfant du
      // bouton SUIVANT, `RAIL_HOVER_PRECEDENT`).
      className={cn(
        "group relative flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-md p-1 text-center",
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        step.clickable ? "cursor-pointer" : "cursor-not-allowed"
      )}
    >
      {/* Géométrie du rail. Les trois valeurs répliquent le `gap-1` (0.25rem) du
          conteneur, le rayon de `size-8` (1rem) et le `p-1` du bouton — à changer
          ENSEMBLE. Les étapes de la fenêtre ont toutes la même largeur (`flex-1`),
          donc le bord droit de la pastille précédente est à −50 % − gap + rayon.
          Sauf en tête de fenêtre : le voisin est alors le nœud « ⋯ », qui n'est pas
          `flex-1` — le rail part du gap, exactement comme il y file à l'autre bout. */}
      {railBefore && (
        <span
          aria-hidden="true"
          className={cn(
            RAIL_BASE,
            railBeforeFromOverflow
              ? "left-[-0.25rem] right-[calc(50%+1rem)]"
              : "left-[calc(-50%-0.25rem+1rem)] right-[calc(50%+1rem)]",
            RAIL_CLASS[railBefore],
            step.clickable && RAIL_HOVER[railBefore],
            // Ce segment est aussi le segment SORTANT de l'étape précédente : il
            // s'éclaire donc quand c'est ELLE qu'on survole. Les `<li>` sont en
            // `display: contents` mais restent des frères, d'où le sélecteur.
            step.clickable && RAIL_HOVER_PRECEDENT[railBefore]
          )}
        />
      )}
      {railAfter && (
        <span
          aria-hidden="true"
          className={cn(
            RAIL_BASE,
            "left-[calc(50%+1rem)] right-[-0.25rem]",
            RAIL_CLASS[railAfter],
            step.clickable && RAIL_HOVER[railAfter]
          )}
        />
      )}

      <StepPip step={step} showStepNumbers={showStepNumbers} />

      {step.name && (
        <span
          className={cn(
            "line-clamp-2 max-w-full text-xs font-semibold leading-tight transition-colors",
            step.status === "current" && "text-primary",
            step.status === "locked" && "text-muted-foreground",
            step.clickable && "group-hover:text-primary"
          )}
        >
          {step.name}
        </span>
      )}
    </button>
  );
}

/**
 * Trait posé en absolu, à hauteur du centre des pastilles (`p-1` + rayon 16 px,
 * moins la moitié de son épaisseur). Sa longueur ne dépend donc pas de celle du
 * libellé : un segment flottant au milieu du vide ne relierait rien.
 */
const RAIL_BASE =
  "pointer-events-none absolute top-[calc(0.25rem+1rem-1px)] border-t-2 transition-colors";

/**
 * Survol : le trait qui touche la pastille visée s'éclaire, sans changer de
 * nature. Le pointillé reste pointillé — c'est lui qui porte l'état, pas la
 * teinte — donc rien ne peut se lire comme « cette étape vient d'être faite ».
 */
const RAIL_HOVER: Record<RailState, string> = {
  done: "group-hover:border-primary",
  error: "group-hover:border-destructive",
  todo: "group-hover:border-primary/50",
};

/** Le même éclairage, déclenché par le survol de l'étape précédente. */
const RAIL_HOVER_PRECEDENT: Record<RailState, string> = {
  done: "[li:hover+li_&]:border-primary",
  error: "[li:hover+li_&]:border-destructive",
  todo: "[li:hover+li_&]:border-primary/50",
};

const RAIL_CLASS: Record<RailState, string> = {
  done: "border-solid border-primary",
  error: "border-solid border-destructive",
  todo: "border-dashed border-muted-foreground/40",
};

function StepPip({ step, showStepNumbers }: { step: StepNavItem; showStepNumbers: boolean }) {
  const base = cn(
    "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold tabular-nums transition-[box-shadow,color,border-color]",
    // Halo au survol : c'est la pastille qu'on vise, c'est elle qui répond.
    step.clickable && "group-hover:ring-4 group-hover:ring-primary/15"
  );

  switch (step.status) {
    case "done":
      return (
        <span
          className={cn(base, "border-primary bg-primary text-primary-foreground")}
          aria-hidden="true"
        >
          <Check className="size-4" strokeWidth={3} />
        </span>
      );
    case "error":
      return (
        <span
          className={cn(base, "border-destructive bg-destructive text-white")}
          aria-hidden="true"
        >
          !
        </span>
      );
    case "locked":
      return (
        <span className={cn(base, "border-muted bg-muted text-muted-foreground")} aria-hidden="true">
          <Lock className="size-3.5" />
        </span>
      );
    case "current":
      return (
        <span
          className={cn(base, "border-primary bg-primary/10 text-primary ring-3 ring-primary/25")}
          aria-hidden="true"
        >
          {step.index + 1}
        </span>
      );
    default:
      return (
        <span
          className={cn(
            base,
            "border-dashed border-muted-foreground/40 text-muted-foreground",
            // Une pastille grise doit répondre au survol : le halo seul se voit mal.
            step.clickable && "group-hover:border-primary/70 group-hover:text-primary"
          )}
          aria-hidden="true"
        >
          {showStepNumbers ? step.index + 1 : "•"}
        </span>
      );
  }
}

// ─── Nœud « ⋯ » : ce n'est pas un décor, c'est le bouton du sommaire ─────────

/**
 * Bulle allongée en pointillé — le vocabulaire des étapes pas encore faites,
 * une silhouette qui n'est pas celle d'une étape — et dessous le nombre
 * d'étapes cachées de ce côté, avec le chevron « ça ouvre le sommaire ».
 *
 * Reçoit et transmet les props de `PopoverTrigger asChild` (dont `ref`).
 */
function OverflowNode({
  label,
  className,
  ...triggerProps
}: { label: string } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn("group flex shrink-0 cursor-pointer flex-col items-center gap-1.5 p-1", className)}
      {...triggerProps}
    >
      <span
        aria-hidden="true"
        className={cn(
          // `relative` : la bulle reste au-dessus du rail des pastilles voisines,
          // qui est absolu et peint après le contenu en flux.
          "relative z-10 grid h-8 min-w-[46px] place-items-center rounded-full border-2 border-dashed border-muted-foreground/40",
          "bg-muted px-2.5 text-xs font-bold tracking-widest text-foreground",
          "group-hover:border-solid group-hover:border-primary group-hover:bg-primary/10 group-hover:text-primary"
        )}
      >
        ⋯
      </span>
      <span className="flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground group-hover:text-primary">
        <span className="underline decoration-muted-foreground/40 underline-offset-2 group-hover:decoration-current">
          {label}
        </span>
        <ChevronDown className="size-3" aria-hidden="true" />
      </span>
    </button>
  );
}

// ─── Sommaire ────────────────────────────────────────────────────────────────

function StepsSummaryPopover({
  steps,
  onStepSelect,
  trigger,
}: {
  steps: StepNavItem[];
  onStepSelect: (index: number) => void;
  trigger: ReactNode;
}) {
  const t = useT("modules/coform");
  const [open, setOpen] = useState(false);
  const toFix = firstErrorStep(steps);

  const select = (index: number) => {
    setOpen(false);
    onStepSelect(index);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        // Radix donne role="dialog" au contenu : sans nom accessible, il s'annonce nu.
        aria-label={t("coform.steps.allSteps")}
        className="w-[min(26rem,calc(100vw-2rem))] p-0"
        // Contenu portalisé : dans un Dialog, `react-remove-scroll` annulerait
        // molette et scroll tactile sans ces deux stopPropagation.
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("coform.steps.allSteps")}
        </div>
        <ol className="scrollbar-thin m-0 max-h-80 list-none overflow-y-auto p-1">
          {steps.map((step) => (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => step.clickable && select(step.index)}
                aria-disabled={!step.clickable || undefined}
                aria-current={step.status === "current" ? "step" : undefined}
                aria-label={accessibleStepLabel(step, t)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left",
                  step.clickable ? "cursor-pointer hover:bg-muted" : "cursor-not-allowed opacity-70"
                )}
              >
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {step.index + 1}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 text-sm",
                    step.status === "current" && "font-semibold text-primary"
                  )}
                >
                  {step.name}
                </span>
                <StatusBadge status={step.status} />
              </button>
            </li>
          ))}
        </ol>
        {toFix?.clickable && (
          <div className="border-t p-1">
            <button
              type="button"
              onClick={() => select(toFix.index)}
              className="w-full cursor-pointer rounded-md px-2 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              {t("coform.steps.goToFirstError")}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const STATUS_LABEL_KEY: Record<StepStatus, string> = {
  done: "coform.steps.status.done",
  current: "coform.steps.status.current",
  error: "coform.steps.status.error",
  locked: "coform.steps.status.locked",
  todo: "coform.steps.status.todo",
};

const STATUS_BADGE_CLASS: Record<StepStatus, string> = {
  done: "bg-primary/10 text-primary",
  current: "bg-primary text-primary-foreground",
  error: "bg-destructive/10 text-destructive",
  locked: "bg-muted text-muted-foreground",
  todo: "bg-muted text-muted-foreground",
};

const PROGRESS_TRACK_CLASS: Record<StepStatus, string> = {
  done: "bg-primary/50",
  current: "bg-primary",
  error: "bg-destructive",
  locked: "bg-muted",
  todo: "bg-muted",
};

function StatusBadge({ status }: { status: StepStatus }) {
  const t = useT("modules/coform");
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        STATUS_BADGE_CLASS[status]
      )}
    >
      {t(STATUS_LABEL_KEY[status])}
    </span>
  );
}

/**
 * Nom accessible d'une étape : « Étape 3 : Publics (complétée) ». Sans nom, le
 * numéro et l'état suffisent — on ne fabrique pas de libellé.
 */
function accessibleStepLabel(step: StepNavItem, t: Translate): string {
  const params = {
    number: step.index + 1,
    name: step.name,
    state: t(STATUS_LABEL_KEY[step.status]),
  };
  // Deux clés distinctes : la ponctuation entre le numéro et le nom n'est pas la
  // même d'une langue à l'autre, et une étape sans nom n'en reçoit aucun.
  return step.name
    ? t("coform.steps.stepLabel", undefined, params)
    : t("coform.steps.stepLabelUnnamed", undefined, params);
}

export default StepsNav;
