import "../i18n"; // side-effect : enregistre le namespace i18n "modules/agenda"
import type { AgendaSectionProps } from "../schema";
import { sectionBgClass } from "@/components/sections/sectionBg";
import Agenda from "../Agenda";

/**
 * Section config-driven `agenda` (rendue par SectionRenderer). Shell + délègue à `<Agenda>`.
 */
export default function AgendaSection({ id, props }: { id?: string; props: AgendaSectionProps }) {
  return (
    // `bg` était déclaré au schéma mais ignoré ici : le fond restait `bg-background` quoi qu'en dise la
    // config. Aucun site ne le posait, le rendu du parc est donc inchangé.
    <section id={id} className={`text-foreground ${sectionBgClass(props.bg) || "bg-background"}`}>
      <Agenda props={props} />
    </section>
  );
}
