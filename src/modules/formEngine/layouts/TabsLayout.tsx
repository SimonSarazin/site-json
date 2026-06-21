/**
 * Layout `tabs` : navigation LIBRE sur **Radix Tabs** (pas de Next/Previous, pas de gate par step),
 * une section à la fois, **validation globale** au submit (toujours dispo). Badge sur l'onglet fautif
 * + saut au 1er onglet en erreur au submit. Lazy-chargé.
 */
import { useMemo, type ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { check } from "../engine/conditional";
import { Footer, StepPanels, TabBar, useStepNav, type LayoutProps } from "./shared";

export default function TabsLayout(p: LayoutProps): ReactNode {
  const values = p.form.watch();
  const steps = useMemo(() => p.descriptor.sections.filter((s) => check(s.visibleIf, values)), [p.descriptor.sections, values]);
  const nav = useStepNav(p, steps);

  return (
    <>
      <Tabs.Root value={nav.current?.id ?? ""} onValueChange={nav.selectById} className="flex flex-1 flex-col min-h-0">
        <div className="shrink-0 px-6 pt-4">
          <TabBar steps={steps} errors={nav.errors} t={p.t} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <StepPanels steps={steps} p={p} values={values} />
        </div>
      </Tabs.Root>
      <Footer {...p} />
    </>
  );
}
