import { SectionRenderer } from "./SectionRenderer";
import type { Section } from "@/types/site";
import { cn } from "@/lib/utils";

export function GridLayoutSection({ 
  id, 
  props 
}: { 
  id?: string; 
  props: {
    leftSection: Section;
    rightSection: Section;
    leftColumns?: 1 | 2 | 3 | 4;
    rightColumns?: 1 | 2 | 3 | 4;
    gap?: number;
    className?: string;
  };
}) {
  const { leftSection, rightSection, leftColumns = 1, rightColumns = 3, gap = 8, className } = props;

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
          className={cn("grid grid-cols-1 lg:grid-cols-4")}
          style={{ gap: `${gap * 0.25}rem` }}
        >
          <div className={getColSpan(leftColumns)}>
            <SectionRenderer section={leftSection} />
          </div>
          <div className={getColSpan(rightColumns)}>
            <SectionRenderer section={rightSection} />
          </div>
        </div>
      </div>
    </section>
  );
}