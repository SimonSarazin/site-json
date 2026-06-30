/**
 * Layout `wizard` : étapes séquentielles sur **Radix Tabs**. Présentation pilotée par `layout`
 * (variants sérialisables, cf. `LayoutPresentation`) — défaut = look « équipement » :
 *   stepper:"pills" (pastilles) · progress:"count" (« X/N ») · header:"plain" (boîte arrondie).
 * Variant riche (ancien tiers-lieu) : stepper:"tabs" (onglets icône+label) + progress:"bar" (texte
 * « Étape X/N » + barre) + header:"gradient" (bandeau dégradé pleine largeur + footer muté).
 * « Suivant » VALIDE l'étape ; saut au 1er onglet fautif au submit.
 */
import { useMemo, type ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { check } from "../engine/conditional";
import {
  SequentialFooter, StepPanels, StepTriggers, TabBar, ProgressBar, useStepNav, layoutPresentation,
  type LayoutProps,
} from "./shared";

export default function WizardLayout(p: LayoutProps): ReactNode {
  const values = p.form.watch();
  const steps = useMemo(() => p.descriptor.sections.filter((s) => check(s.visibleIf, values)), [p.descriptor.sections, values]);
  const nav = useStepNav(p, steps);
  const pres = layoutPresentation(p.descriptor.layout);
  const isGradient = pres.header === "gradient";

  // Texte d'étape : count ET bar (l'ancien tiers-lieu avait texte + barre).
  const stepText = p.texts.stepLabel ? p.texts.stepLabel(nav.active + 1, steps.length) : `${nav.active + 1} / ${steps.length}`;
  const stepName = nav.current?.label ? p.t(nav.current.label) : "";
  const countLabel = pres.progress === "none" ? null
    : pres.stepper === "tabs"
      // tabs (riche) : « Étape X sur N — Nom » sur UNE ligne ; nom de section en primaire + un peu plus gros (parité ancien form).
      ? <div className="text-xs text-muted-foreground">{stepText}{stepName && <> — <span className="text-sm font-medium text-primary">{stepName}</span></>}</div>
      // pills (équipement) : count en label + nom dessous (deux lignes).
      : (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{stepText}</div>
          {stepName && <div className="text-sm font-medium text-foreground">{stepName}</div>}
        </div>
      );
  const bar = pres.progress === "bar" ? <ProgressBar active={nav.active} total={steps.length} /> : null;

  // header:gradient → bandeau À PLAT pleine largeur (continue le header de la modale) ; plain → boîte arrondie.
  const outerClass = isGradient
    ? "shrink-0 border-b border-border/50 bg-linear-to-b from-primary/5 to-transparent px-6 pb-4 pt-2"
    : "shrink-0 px-6 pt-4";
  const innerClass = isGradient ? "space-y-3" : "space-y-3 rounded-lg border border-border/60 bg-background/60 px-4 py-3";

  return (
    <>
      <Tabs.Root value={nav.current?.id ?? ""} onValueChange={nav.selectById} className="flex flex-1 flex-col min-h-0">
        <div className={outerClass}>
          <div className={innerClass}>
            {pres.stepper === "tabs" ? (
              // sous-titre → barre → onglets (ordre de l'ancien form)
              <>
                {countLabel}
                {bar}
                <TabBar steps={steps} errors={nav.errors} t={p.t} />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  {countLabel ?? <div />}
                  <StepTriggers steps={steps} active={nav.active} errors={nav.errors} t={p.t} />
                </div>
                {bar}
              </>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <StepPanels steps={steps} p={p} values={values} />
        </div>
      </Tabs.Root>
      <SequentialFooter p={p} active={nav.active} isLast={nav.isLast} goNext={nav.goNext} goPrev={nav.goPrev} muted={isGradient} />
    </>
  );
}
