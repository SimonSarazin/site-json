import type { ReactNode } from "react";
import { SectionRenderer } from "./SectionRenderer";
import type { Section, GridLayoutSectionProps } from "@/types/site";
import { cn } from "@/lib/utils";
import { buildGridColsClass } from "./responsiveGridCols";
import { sectionBgClass } from "./sectionBg";
import { sectionMaxWidthClass } from "./sectionWidth";

export function GridLayoutSection({
  id,
  props
}: {
  id?: string;
  props: GridLayoutSectionProps;
}) {
  const { leftColumns = 1, rightColumns = 3, gap = 8, align = "start", from = "lg", className, leftWrapperClass, rightWrapperClass, innerWrapperClass, bg, maxWidth } = props;
  // Fond de bande : sans `bg`, `py-4` et le fond hérité — le rendu historique de toutes les grilles du parc.
  const bandeau = cn(sectionBgClass(bg), "py-4");
  // Largeur du contenu : toute celle du `container` par défaut (rendu historique).
  const largeur = cn("container mx-auto px-6", sectionMaxWidthClass(maxWidth));
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
  const sections = props.sections as Section[] | undefined;
  const topSection = props.topSection as Section | undefined;
  // En tête de bande, pleine largeur, séparée de la grille par le même écart que ses colonnes.
  const top = topSection ? (
    <div style={{ marginBottom: `${gap * 0.25}rem` }}>
      <SectionRenderer section={topSection} />
    </div>
  ) : null;
  // Panneau optionnel autour de l'en-tête et de la grille. Absent : AUCUNE boîte — le DOM des grilles
  // existantes reste identique (leurs sélecteurs `[&>…]` en dépendent).
  const panneau = (contenu: ReactNode) =>
    innerWrapperClass ? <div className={innerWrapperClass}>{contenu}</div> : contenu;

  // Classes LITTÉRALES par palier : le JIT Tailwind ne génère pas une classe construite dynamiquement.
  const COL_SPAN = {
    lg: { 1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3", 4: "lg:col-span-4" },
    md: { 1: "md:col-span-1", 2: "md:col-span-2", 3: "md:col-span-3", 4: "md:col-span-4" },
  } as const;
  const getColSpan = (cols: number) => COL_SPAN[from][cols as 1 | 2 | 3 | 4];

  // Mode « rangée » : N colonnes de MÊME largeur — 3 colonnes égales ne se découpent pas en quarts,
  // donc `grid-cols-N` et non des `col-span` sur une base de 4. Les classes viennent du mapping
  // statique partagé `buildGridColsClass`, déjà utilisé par `stats`, `action-tiles` et `cta` : une
  // seule table de classes littérales à tenir pour tout le parc (le JIT ne génère pas une classe
  // construite). Palier intermédiaire à 2 colonnes : à 3 blocs, `sm` en empilerait un tout seul.
  if (sections && sections.length > 0) {
    const nb = props.columns ?? Math.min(sections.length, 4);
    return (
      <section id={id} className={cn(bandeau, className)}>
        <div className={largeur}>
          {panneau(<>
          {top}
          <div
            className={cn(
              "grid",
              buildGridColsClass(from === "md" ? { sm: 2, md: nb } : { sm: 2, lg: nb }),
              align === "stretch" ? "items-stretch" : "items-start",
            )}
            style={{ gap: `${gap * 0.25}rem` }}
          >
            {sections.map((sec, i) => (
              <div key={sec.id ?? `${sec.type}-${i}`} className={cn(stretchClass, leftWrapperClass)}>
                <SectionRenderer section={sec} />
              </div>
            ))}
          </div>
          </>)}
        </div>
      </section>
    );
  }

  return (
    <section id={id} className={cn(bandeau, className)}>
      <div className={largeur}>
        {panneau(<>
        {top}
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
        </>)}
      </div>
    </section>
  );
}
export default GridLayoutSection;
