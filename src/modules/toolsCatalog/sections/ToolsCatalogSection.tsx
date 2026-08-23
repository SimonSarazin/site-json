// Side-effect : enregistre le bundle i18n FR/EN dès que la section lazy est chargée.
import "../i18n/i18n";
import { cn } from "@/lib/utils";
import type { ToolsCatalogSectionProps } from "../schema";
import { ToolsCatalog } from "../components/ToolsCatalog";

const BG_MAP: Record<string, string> = {
  card: "bg-card",
  muted: "bg-muted",
  primary: "bg-primary/10",
  secondary: "bg-secondary",
  accent: "bg-accent/10",
  transparent: "bg-transparent",
};

interface ToolsCatalogSectionWrapperProps {
  id?: string;
  props: ToolsCatalogSectionProps;
}

/** Wrapper de la section `toolsCatalog` (habillage bg/largeur + composant générique). */
export default function ToolsCatalogSection({ id, props }: ToolsCatalogSectionWrapperProps) {
  // `container mx-auto px-4 sm:px-6` reproduit la largeur du contenu de la topbar
  // (HeaderMegaMenu) ; le padding est porté par le bloc interne pour matcher ses bords.
  const widthClass =
    props.width === "full" ? "w-full px-4 sm:px-6" : "container mx-auto px-4 sm:px-6";
  const sectionBg = props.bg && props.bg !== "default" ? (BG_MAP[props.bg] ?? "") : "";

  return (
    <section id={id} className={cn("py-8", sectionBg)}>
      <div className={widthClass}>
        <ToolsCatalog props={props} />
      </div>
    </section>
  );
}
