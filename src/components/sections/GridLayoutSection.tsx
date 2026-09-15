import { SectionRenderer } from "./SectionRenderer";
import type { Section, GridLayoutSectionProps } from "@/types/site";
import { cn } from "@/lib/utils";

export function GridLayoutSection({
  id,
  props
}: {
  id?: string;
  props: GridLayoutSectionProps;
}) {
  const { leftColumns = 1, rightColumns = 3, gap = 8, align = "start", from = "lg", className, leftWrapperClass, rightWrapperClass } = props;
  // `stretch` : les colonnes prennent la hauteur de la plus haute, et la SECTION fille est étirée
  // avec elles — sans quoi le wrapper s'allonge mais la section garde sa hauteur de contenu, et le
  // vide reste, simplement déplacé d'un cran.
  // Deux niveaux ciblés parce que `SectionRenderer` intercale un `div` (Suspense/ErrorBoundary)
  // entre le wrapper et la `section` : `[&>*]` étire cet intermédiaire — ou la section elle-même si
  // un jour il disparaît —, `[&>*>section]` la section qu'il enveloppe.
  const stretchClass = align === "stretch" ? "h-full [&>*]:h-full [&>*>section]:h-full" : "";
  // Cast nécessaire car z.lazy() infère unknown (même pattern que TabsSection)
  const leftSection = props.leftSection as Section | undefined;
  const rightSection = props.rightSection as Section | undefined;

  // Classes LITTÉRALES par palier : le JIT Tailwind ne génère pas une classe construite dynamiquement.
  const COL_SPAN = {
    lg: { 1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3", 4: "lg:col-span-4" },
    md: { 1: "md:col-span-1", 2: "md:col-span-2", 3: "md:col-span-3", 4: "md:col-span-4" },
  } as const;
  const getColSpan = (cols: number) => COL_SPAN[from][cols as 1 | 2 | 3 | 4];

  return (
    <section id={id} className={cn("py-4", className)}>
      <div className="container mx-auto px-6">
        <div
          className={cn(
            "grid grid-cols-1",
            from === "md" ? "md:grid-cols-4" : "lg:grid-cols-4",
            align === "stretch" ? "items-stretch" : "items-start",
          )}
          style={{ gap: `${gap * 0.25}rem` }}
        >
          {leftSection && (
            <div className={cn(getColSpan(leftColumns), stretchClass, leftWrapperClass)}>
              <SectionRenderer section={leftSection} />
            </div>
          )}
          {rightSection && (
            <div className={cn(getColSpan(rightColumns), stretchClass, rightWrapperClass)}>
              <SectionRenderer section={rightSection} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
export default GridLayoutSection;
