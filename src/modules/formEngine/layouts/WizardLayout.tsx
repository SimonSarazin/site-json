/**
 * Layout `wizard` : étapes séquentielles sur **Radix Tabs**. Barre « Étape X / N » + libellé actif
 * (gauche) · pastilles cliquables (droite, saut libre) ; Précédent / Suivant en bas, « Suivant »
 * VALIDE l'étape courante avant d'avancer ; saut au 1er onglet fautif au submit. Lazy-chargé.
 */
import { useMemo, type ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { check } from "../engine/conditional";
import { SequentialFooter, StepPanels, StepTriggers, useStepNav, type LayoutProps } from "./shared";

export default function WizardLayout(p: LayoutProps): ReactNode {
  const values = p.form.watch();
  const steps = useMemo(() => p.descriptor.sections.filter((s) => check(s.visibleIf, values)), [p.descriptor.sections, values]);
  const nav = useStepNav(p, steps);

  return (
    <>
      <Tabs.Root value={nav.current?.id ?? ""} onValueChange={nav.selectById} className="flex flex-1 flex-col min-h-0">
        <div className="shrink-0 px-6 pt-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/60 px-4 py-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {p.texts.stepLabel ? p.texts.stepLabel(nav.active + 1, steps.length) : `${nav.active + 1} / ${steps.length}`}
              </div>
              {nav.current?.label && <div className="text-sm font-medium text-foreground">{p.t(nav.current.label)}</div>}
            </div>
            <StepTriggers steps={steps} active={nav.active} errors={nav.errors} t={p.t} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <StepPanels steps={steps} p={p} values={values} />
        </div>
      </Tabs.Root>
      <SequentialFooter p={p} active={nav.active} isLast={nav.isLast} goNext={nav.goNext} goPrev={nav.goPrev} />
    </>
  );
}
