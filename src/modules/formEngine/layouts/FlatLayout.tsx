/** Layout `flat` : toutes les sections empilées, submit global. Lazy-chargé par le registry. */
import type { ReactNode } from "react";
import { check } from "../engine/conditional";
import { Footer, renderSection, type LayoutProps } from "./shared";

export default function FlatLayout(p: LayoutProps): ReactNode {
  const values = p.form.watch();
  const sections = p.descriptor.sections.filter((s) => check(s.visibleIf, values));
  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.id} className="space-y-4">
              {s.label && <h3 className="text-lg font-semibold">{p.t(s.label)}</h3>}
              {renderSection(s, p, values)}
            </section>
          ))}
        </div>
      </div>
      <Footer {...p} />
    </>
  );
}
