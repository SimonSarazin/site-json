import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import type { SectionPropsMap } from "@/types/site";

export function TitleSection({ 
  id, 
  props 
}: { 
  id?: string; 
  props: SectionPropsMap["title"] 
}) {
  const { t } = useLocalization();
  const { title, subtitle, className, align = "center", size = "lg" } = props;

  const sizeClasses = {
    sm: "text-2xl",
    md: "text-3xl",
    lg: "text-4xl",
    xl: "text-5xl",
  };

  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <section id={id} className={cn("py-8", className)}>
      <div className="container mx-auto px-6">
        <h2 className={cn(
          sizeClasses[size],
          alignClasses[align],
          "font-bold mb-2"
        )}>
          {t(title)}
        </h2>
        
        {subtitle && (
          <h3 className={cn(
            sizeClasses[size],
            alignClasses[align],
            "font-bold mb-12"
          )}>
            {t(subtitle)}
          </h3>
        )}
      </div>
    </section>
  );
}