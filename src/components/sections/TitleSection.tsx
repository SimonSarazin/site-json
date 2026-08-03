import { T } from "@/components/ui/T";
import { cn } from "@/lib/utils";
import type { SectionPropsMap } from "@/types/site";

export function TitleSection({
  id,
  props
}: {
  id?: string;
  props: SectionPropsMap["title"]
}) {
  const { title, subtitle, className, align = "center", size = "lg" } = props;

  const sizeClasses = {
    sm: "text-2xl",
    md: "text-3xl",
    lg: "text-4xl",
    xl: "text-5xl",
  };

  // Le sous-titre reste subordonné au titre quelle que soit la taille.
  const subtitleSizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-lg md:text-xl",
    xl: "text-xl",
  };

  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <section id={id} className={cn("py-8", className)}>
      <div className="container mx-auto px-6">
        <T
          k={title}
          as="h2"
          className={cn(
            sizeClasses[size],
            alignClasses[align],
            "font-bold mb-2"
          )}
        />

        {subtitle && (
          <T
            k={subtitle}
            as="p"
            className={cn(
              subtitleSizeClasses[size],
              alignClasses[align],
              align === "center" && "mx-auto",
              "max-w-3xl font-normal text-muted-foreground leading-relaxed"
            )}
          />
        )}
      </div>
    </section>
  );
}
export default TitleSection;
