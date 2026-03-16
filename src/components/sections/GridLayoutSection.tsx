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
  const { leftColumns = 1, rightColumns = 3, gap = 8, className, leftWrapperClass, rightWrapperClass } = props as any;
  // Cast nécessaire car z.lazy() infère unknown (même pattern que TabsSection)
  const leftSection = props.leftSection as Section | undefined;
  const rightSection = props.rightSection as Section | undefined;

  const getColSpan = (cols: number) => {
    const colSpanMap: Record<number, string> = {
      1: "lg:col-span-1",
      2: "lg:col-span-2",
      3: "lg:col-span-3",
      4: "lg:col-span-4",
    };
    return colSpanMap[cols];
  };

  return (
    <section id={id} className={cn("py-4", className)}>
      <div className="container mx-auto px-6">
        <div
          className={cn("grid grid-cols-1 lg:grid-cols-4 items-start")}
          style={{ gap: `${gap * 0.25}rem` }}
        >
          {leftSection && (
            <div className={cn(getColSpan(leftColumns), leftWrapperClass)}>
              <SectionRenderer section={leftSection} />
            </div>
          )}
          {rightSection && (
            <div className={cn(getColSpan(rightColumns), rightWrapperClass)}>
              <SectionRenderer section={rightSection} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
export default GridLayoutSection;
