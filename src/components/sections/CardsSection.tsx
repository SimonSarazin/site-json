import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { T } from "@/components/ui/T";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from '@/lib/utils';
import type { SectionPropsMap } from '@/types/site';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { Grid, List } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

export function CardsSection({ id, props }: { id?: string; props: SectionPropsMap["cards"] }) {
  const { t } = useLocalization();
  const {
    items,
    columns = 3,
    layout: defaultLayout = 'grid',
    variant = 'default',
    className,
    showHeader = false,
    showResultCount = false,
    showViewToggle = false,
  } = props;

  const [currentLayout, setCurrentLayout] = useState<'grid' | 'list'>(defaultLayout as 'grid' | 'list');

  const getGridCols = (cols: number) => {
    const colsMap: Record<number, string> = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 md:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
      5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
      6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
    };
    return colsMap[cols as keyof typeof colsMap] || colsMap[3];
  };

  const getAvatarColorClasses = (color?: string) => {
    const colorMap: Record<string, string> = {
      orange: 'bg-orange-50 text-orange-500',
      blue: 'bg-blue-50 text-blue-500',
      green: 'bg-green-50 text-green-500',
      purple: 'bg-purple-50 text-purple-500',
      red: 'bg-red-50 text-red-500',
      yellow: 'bg-yellow-50 text-yellow-500',
      teal: 'bg-primary/10 text-primary',
    };
    return colorMap[color || 'teal'] || colorMap.teal;
  };

  const CardWrapper = ({ children, href, target }: { children: React.ReactNode; href?: string; target?: string }) => {
    if (href) {
      return (
        <Link
          to={href}
          target={target || '_self'}
          rel={target === '_blank' ? 'noopener noreferrer' : undefined}
          className="block"
        >
          {children}
        </Link>
      );
    }
    return <>{children}</>;
  };

  // Header Section (affiché si showHeader est true)
  const HeaderSection = () => {
    if (!showHeader) return null;

    return (
      <div className="mb-8 flex items-center justify-between">
        <div>
          {props.headerTitle && (
            <T k={props.headerTitle} as="h2" className="text-2xl font-bold text-foreground" />
          )}

          {showResultCount && (
            <p className="font-semibold text-foreground mt-1">
              {items.length} {items.length === 1 ? 'résultat' : 'résultats'}
            </p>
          )}
        </div>

        {showViewToggle && (
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentLayout('grid')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                currentLayout === 'grid'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              aria-label="Vue grille"
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentLayout('list')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                currentLayout === 'list'
                  ? "bg-gray-900 dark:bg-slate-700 text-white"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
              )}
              aria-label="Vue liste"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  if (variant === 'event') {
    return (
      <section id={id} className={cn("py-8 sm:py-12 md:py-16 bg-background", className)}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <HeaderSection />
          <div className={cn("grid gap-4 sm:gap-6", getGridCols(columns))}>
            {items.map((item, index) => (
              <CardWrapper key={index} href={item.href} target={item.target}>
                <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-xl overflow-hidden shadow-lg group cursor-pointer">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.eventTitle ? t(item.eventTitle) : t(item.title)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}

                  <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex flex-col gap-1 sm:gap-2 z-10">
                    {item.date && (
                      <div className="bg-white dark:bg-slate-800 w-auto px-2 sm:px-3 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-semibold shadow text-gray-900 dark:text-white flex items-center gap-1">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate max-w-[120px] sm:max-w-none">{item.date}</span>
                      </div>
                    )}
                    {item.eventTitle && (
                      <T k={item.eventTitle} as="div" className="text-white font-semibold text-xs sm:text-sm drop-shadow-lg" />
                    )}
                  </div>

                  <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 right-2 sm:right-3 bg-white bg-opacity-90 rounded-xl p-2 sm:p-4 flex items-start gap-2 sm:gap-3 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all">
                    {item.avatarIcon && (
                      <div className={cn(
                        "w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full shadow-sm flex-shrink-0",
                        getAvatarColorClasses(item.avatarColor)
                      )}>
                        <DynamicIcon name={item.avatarIcon as IconName} className="w-3 h-3 sm:w-4 sm:h-4" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm mb-0.5 sm:mb-1 truncate">
                        <T k={item.organizerName || item.title} />
                      </h3>
                      {item.location && (
                        <T k={item.location} as="p" className="text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs truncate" />
                      )}
                    </div>
                  </div>
                </div>
              </CardWrapper>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'tiers-lieux') {
    return (
      <section id={id} className={cn("py-8 sm:py-12 md:py-16 bg-background", className)}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <HeaderSection />

          {currentLayout === 'list' ? (
            <div className="space-y-3 sm:space-y-4">
              {items.map((item, index) => (
                <CardWrapper key={index} href={item.href} target={item.target}>
                  <div className="relative bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow hover:shadow-lg transition cursor-pointer">
                    <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 p-3 sm:p-4">
                      {item.image && (
                        <div className="w-full sm:w-48 h-32 sm:h-32 flex-shrink-0 rounded-lg overflow-hidden">
                          <img
                            src={item.image}
                            alt={t(item.title)}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3 mb-2">
                          {item.avatarIcon && (
                            <div className={cn(
                              "w-8 h-8 flex items-center justify-center rounded-full shadow-sm flex-shrink-0",
                              getAvatarColorClasses(item.avatarColor)
                            )}>
                              <DynamicIcon name={item.avatarIcon as IconName} className="w-4 h-4" />
                            </div>
                          )}

                          <div className="flex-1">
                            <T k={item.title} as="h3" className="font-bold text-gray-900 dark:text-white text-base mb-1" />
                            {item.location && (
                              <T k={item.location} as="p" className="text-gray-500 dark:text-gray-400 text-sm" />
                            )}
                          </div>

                          {item.badges && item.badges.length > 0 && (
                            <div className="flex gap-2">
                              {item.badges.map((badge, idx) => (
                                <button
                                  key={idx}
                                  className="w-8 h-8 bg-gray-100 dark:bg-slate-700 rounded-full shadow-sm flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-600 transition"
                                  aria-label={badge.label}
                                >
                                  <DynamicIcon name={badge.icon as IconName} className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardWrapper>
              ))}
            </div>
          ) : (
            <div className={cn("grid gap-6", getGridCols(columns))}>
              {items.map((item, index) => (
                <CardWrapper key={index} href={item.href} target={item.target}>
                  <div className="relative bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow hover:shadow-lg transition group cursor-pointer">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={t(item.title)}
                        className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}

                    {item.badges && item.badges.length > 0 && (
                      <div className="absolute top-3 right-3 flex gap-2 z-10">
                        {item.badges.map((badge, idx) => (
                          <button
                            key={idx}
                            className="w-8 h-8 bg-white dark:bg-slate-700 rounded-full shadow flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-600 transition"
                            aria-label={badge.label}
                          >
                            <DynamicIcon name={badge.icon as IconName} className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3 right-3 bg-white dark:bg-slate-700 rounded-xl p-3 px-4 mb-2 flex items-start gap-3 shadow-lg">
                      {item.avatarIcon && (
                        <div className={cn(
                          "w-8 h-8 flex items-center justify-center rounded-full shadow-sm flex-shrink-0",
                          getAvatarColorClasses(item.avatarColor)
                        )}>
                          <DynamicIcon name={item.avatarIcon as IconName} className="w-4 h-4" />
                        </div>
                      )}

                      <div>
                        <T k={item.title} as="h3" className="font-bold text-gray-900 dark:text-white text-sm mb-1" />
                        {item.location && (
                          <T k={item.location} as="p" className="text-gray-500 dark:text-gray-400 text-xs" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardWrapper>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  // Variante Icon-Card avec support pour iconImage et iconClipPath
  if (variant === 'icon-card') {
    return (
      <section id={id} className={cn("py-16 bg-background", className)}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <HeaderSection />
          <div className={cn("grid gap-6", getGridCols(columns))}>
            {items.map((item, index) => (
              <CardWrapper key={index} href={item.href} target={item.target}>
                <div className="group cursor-pointer bg-card rounded-2xl shadow-md hover:shadow-xl transition p-6 border border-border hover:border-primary">
                  <div className={cn(
                    "w-24 h-24 mx-auto mb-4 flex items-center justify-center text-6xl group-hover:scale-110 transition-transform duration-300",
                    item.iconColor || "text-primary"
                  )}>
                    {/* Support pour iconImage avec clipPath */}
                    {item.iconImage ? (
                      <div
                        className="w-full h-full"
                        style={{
                          clipPath: item.iconClipPath || 'none',
                          WebkitClipPath: item.iconClipPath || 'none'
                        }}
                      >
                        <img
                          src={item.iconImage}
                          alt={t(item.title)}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : item.iconSvg ? (
                      <div dangerouslySetInnerHTML={{ __html: item.iconSvg }} suppressHydrationWarning />
                    ) : item.icon ? (
                      <DynamicIcon name={item.icon as IconName} className="w-16 h-16" />
                    ) : null}
                  </div>

                  <T k={item.title} as="h4" className="font-bold mb-2 text-gray-900 dark:text-white text-sm group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors text-center" />

                  <T k={item.text} as="p" className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 text-center" />
                </div>
              </CardWrapper>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id={id} className={cn("py-16 bg-background text-foreground", className)}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <HeaderSection />

        {currentLayout === 'list' ? (
          <div className="space-y-4">
            {items.map((item, index) => (
              <CardWrapper key={index} href={item.href} target={item.target}>
                <Card className={cn(
                  "transition-all duration-200",
                  item.href && "hover:shadow-lg cursor-pointer"
                )}>
                  <div className="flex items-start gap-4 p-6">
                    {item.image && (
                      <div className="w-32 h-32 shrink-0 rounded-lg overflow-hidden">
                        <img
                          src={item.image}
                          alt={t(item.title)}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {item.icon && !item.image && (
                      <div className="w-12 h-12 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <DynamicIcon name={item.icon as IconName} className="w-6 h-6" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <T k={item.title} as="h3" className="text-xl font-semibold mb-2 text-foreground" />
                      <T k={item.text} as="p" className="text-base text-muted-foreground" />
                    </div>
                  </div>
                </Card>
              </CardWrapper>
            ))}
          </div>
        ) : (
          /* Vue Grille */
          <div className={cn(
            "grid gap-6",
            defaultLayout === 'grid' && getGridCols(columns),
            defaultLayout === 'masonry' && `columns-1 md:columns-${Math.min(columns, 2)} lg:columns-${columns} gap-6`,
            defaultLayout === 'carousel' && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 overflow-x-auto"
          )}>
            {items.map((item, index) => (
              <CardWrapper key={index} href={item.href} target={item.target}>
                <Card className={cn(
                  "h-full transition-all duration-200",
                  item.href && "hover:shadow-lg hover:-translate-y-1 cursor-pointer",
                  defaultLayout === 'masonry' && "break-inside-avoid mb-6"
                )}>
                  <CardHeader>
                    {item.image && (
                      <div className="w-full h-48 mb-4 rounded-lg overflow-hidden">
                        <img
                          src={item.image}
                          alt={t(item.title)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}

                    {item.icon && (
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
                        <DynamicIcon name={item.icon as IconName} className="w-6 h-6" />
                      </div>
                    )}

                    <CardTitle className="text-xl mb-2 text-foreground">
                      <T k={item.title} />
                    </CardTitle>
                  </CardHeader>

                  <CardContent>
                    <CardDescription className="text-base leading-relaxed text-muted-foreground">
                      <T k={item.text} />
                    </CardDescription>
                  </CardContent>
                </Card>
              </CardWrapper>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
export default CardsSection;
