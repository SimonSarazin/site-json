import { T } from "@/components/ui/T";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import type { SectionPropsMap } from "@/types/site";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

export function ContentSection({ 
  id, 
  props 
}: { 
  id?: string; 
  props: SectionPropsMap["content"] 
}) {
  const { t } = useLocalization();
  const { 
    category, 
    title, 
    description, 
    tags, 
    image, 
    imagePosition = "right",
    links,
    iconCard,
    infoText,
    decorativeElements,
    className 
  } = props;

  const isImageLeft = imagePosition === "left";

  return (
    <section id={id} className={cn("py-16", className)}>
      <div className="container mx-auto px-6">
        {category && !isImageLeft && (
          <T k={category} as="p" className="text-muted-foreground text-sm font-medium mb-2" />
        )}
        
        <div className={cn(
          "grid lg:grid-cols-2 gap-16 items-center",
          isImageLeft && "direction-rtl"
        )}>
          {/* Content Column */}
          <div className={cn(isImageLeft && "lg:order-2")}>
            {category && isImageLeft && (
              <T k={category} as="p" className="text-muted-foreground text-sm font-medium mb-4" />
            )}
            
            <T k={title} as="h2" className="text-4xl font-bold text-primary mb-6 leading-tight" />

            <T k={description} as="p" className="text-muted-foreground mb-8 leading-relaxed" />

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-8">
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-full text-sm cursor-pointer transition"
                    suppressHydrationWarning
                  >
                    {t(tag)}
                  </span>
                ))}
              </div>
            )}

            {/* Icon Card with Links */}
            {iconCard && links && links.length > 0 && (
              <div className="flex items-start gap-4 mb-6">
                {/* Icon */}
                <div className="w-28 h-28 px-4 bg-card rounded-2xl border border-border flex items-center justify-center text-3xl shadow-lg flex-0">
                  <div dangerouslySetInnerHTML={{ __html: iconCard.svg }} suppressHydrationWarning />
                </div>

                {/* Links Card */}
                <div className="bg-card rounded-2xl shadow-lg p-6 border border-border flex-1">
                  <div className="space-y-4">
                    {links.map((link, idx) => (
                      <div key={idx} className="flex items-center space-x-3">
                        <svg className="w-3 h-3 text-foreground" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        <a
                          href={link.href}
                          className="font-semibold text-foreground hover:text-primary transition"
                          suppressHydrationWarning
                        >
                          {t(link.label)}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Info Text */}
            {infoText && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <svg className="w-5 h-5 text-foreground" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="mt-1" dangerouslySetInnerHTML={{ __html: t(infoText) }} suppressHydrationWarning />
              </div>
            )}
          </div>

          {/* Image Column */}
          <div className={cn("relative h-full", isImageLeft && "lg:order-1")}>
            <div className="h-full rounded-2xl overflow-hidden">
              {image && (
                <OptimizedImage
                  src={image}
                  alt={t(title)}
                  width={600}
                  className="w-full h-full object-cover rounded-xl"
                />
              )}
            </div>

            {/* Decorative Elements */}
            {decorativeElements && decorativeElements.type === "corner-icon" && (
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary rounded-tl-full flex items-center justify-center shadow-2xl">
                <div className="text-white text-4xl mb-4 ml-4">
                  <div className="flex space-x-2 mb-1">
                    <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
                    <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>
                  </div>
                  <div className="w-8 h-1 bg-primary-foreground rounded-full"></div>
                </div>
              </div>
            )}

            {decorativeElements && decorativeElements.type === "colored-squares" && (
              <div className="absolute bottom-8 left-8 flex gap-4">
                <div className="w-24 h-24 bg-chart-2 transform -rotate-12 shadow-2xl rounded-lg"></div>
                <div className="w-24 h-24 bg-chart-4 transform rotate-12 shadow-2xl rounded-lg"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContentSection;