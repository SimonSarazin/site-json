import type { AgendaSectionProps } from "../schema";
import Agenda from "../Agenda";

/**
 * Section config-driven `agenda` (rendue par SectionRenderer). Shell + délègue à `<Agenda>`.
 */
export default function AgendaSection({ id, props }: { id?: string; props: AgendaSectionProps }) {
  return (
    <section id={id} className="bg-background text-foreground">
      <Agenda props={props} />
    </section>
  );
}
