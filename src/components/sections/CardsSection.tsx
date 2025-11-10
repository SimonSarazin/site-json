import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      teal: 'bg-teal-50 text-teal-500',
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
          {
            props.headerTitle &&
            <h2 className="text-2xl font-bold text-gray-900">
              {props.headerTitle ? t(props.headerTitle) : 'Cards'}
            </h2>
          }

          {showResultCount && (
            <p className="font-semibold text-black mt-1">
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
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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

  // Variante Event
  if (variant === 'event') {
    return (
      <section id={id} className={cn("py-16 bg-background", className)}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <HeaderSection />
          <div className={cn("grid gap-6", getGridCols(columns))}>
            {items.map((item, index) => (
              <CardWrapper key={index} href={item.href} target={item.target}>
                <div className="relative w-full h-96 rounded-xl overflow-hidden shadow-lg group cursor-pointer">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.eventTitle ? t(item.eventTitle) : t(item.title)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}

                  <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
                    {item.date && (
                      <div className="bg-white w-1/2 px-3 py-1 rounded-md text-xs font-semibold shadow text-gray-900 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {item.date}
                      </div>
                    )}
                    {item.eventTitle && (
                      <div className="text-white font-semibold text-sm drop-shadow-lg">
                        {t(item.eventTitle)}
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 bg-white bg-opacity-90 rounded-xl p-4 flex items-start gap-3 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all">
                    {item.avatarIcon && (
                      <div className={cn(
                        "w-10 h-10 flex items-center justify-center rounded-full shadow-sm flex-shrink-0",
                        getAvatarColorClasses(item.avatarColor)
                      )}>
                        <DynamicIcon name={item.avatarIcon as IconName} className="w-4 h-4" />
                      </div>
                    )}

                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">
                        {item.organizerName ? t(item.organizerName) : t(item.title)}
                      </h3>
                      {item.location && (
                        <p className="text-gray-500 text-xs truncate">
                          {t(item.location)}
                        </p>
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

  // Variante Tiers-Lieux
  if (variant === 'tiers-lieux') {
    return (
      <section id={id} className={cn("py-16 bg-background", className)}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <HeaderSection />

          {/* Vue Liste */}
          {currentLayout === 'list' ? (
            <div className="space-y-4">
              {items.map((item, index) => (
                <CardWrapper key={index} href={item.href} target={item.target}>
                  <div className="relative bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition cursor-pointer">
                    <div className="flex items-start gap-4 p-4">
                      {item.image && (
                        <div className="w-48 h-32 flex-shrink-0 rounded-lg overflow-hidden">
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
                            <h3 className="font-bold text-gray-900 text-base mb-1">
                              {t(item.title)}
                            </h3>
                            {item.location && (
                              <p className="text-gray-500 text-sm">
                                {t(item.location)}
                              </p>
                            )}
                          </div>

                          {item.badges && item.badges.length > 0 && (
                            <div className="flex gap-2">
                              {item.badges.map((badge, idx) => (
                                <button
                                  key={idx}
                                  className="w-8 h-8 bg-gray-100 rounded-full shadow-sm flex items-center justify-center hover:bg-gray-200 transition"
                                  aria-label={badge.label}
                                >
                                  <DynamicIcon name={badge.icon as IconName} className="w-4 h-4 text-gray-700" />
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
            /* Vue Grille */
            <div className={cn("grid gap-6", getGridCols(columns))}>
              {items.map((item, index) => (
                <CardWrapper key={index} href={item.href} target={item.target}>
                  <div className="relative bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition group cursor-pointer">
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
                            className="w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-gray-100 transition"
                            aria-label={badge.label}
                          >
                            <DynamicIcon name={badge.icon as IconName} className="w-4 h-4 text-gray-700" />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3 right-3 bg-white rounded-xl p-3 px-4 mb-2 flex items-start gap-3 shadow-lg">
                      {item.avatarIcon && (
                        <div className={cn(
                          "w-8 h-8 flex items-center justify-center rounded-full shadow-sm flex-shrink-0",
                          getAvatarColorClasses(item.avatarColor)
                        )}>
                          <DynamicIcon name={item.avatarIcon as IconName} className="w-4 h-4" />
                        </div>
                      )}

                      <div>
                        <h3 className="font-bold text-gray-900 text-sm mb-1">
                          {t(item.title)}
                        </h3>
                        {item.location && (
                          <p className="text-gray-500 text-xs">
                            {t(item.location)}
                          </p>
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
                <div className="group cursor-pointer bg-white rounded-2xl shadow-md hover:shadow-xl transition p-6 border border-gray-100 hover:border-yellow-300">
                  <div className={cn(
                    "w-24 h-24 mx-auto mb-4 flex items-center justify-center text-6xl group-hover:scale-110 transition-transform duration-300",
                    item.iconColor || "text-yellow-500"
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
                      <div dangerouslySetInnerHTML={{ __html: item.iconSvg }} />
                    ) : item.icon ? (
                      <DynamicIcon name={item.icon as IconName} className="w-16 h-16" />
                    ) : null}
                  </div>

                  <h4 className="font-bold mb-2 text-gray-900 text-sm group-hover:text-yellow-600 transition-colors text-center">
                    {t(item.title)}
                  </h4>

                  <p className="text-xs text-gray-600 line-clamp-2 text-center">
                    {t(item.text)}
                  </p>
                </div>
              </CardWrapper>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Variante par défaut avec support pour vue liste
  return (
    <section id={id} className={cn("py-16 bg-background text-foreground", className)}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <HeaderSection />

        {/* Vue Liste */}
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
                      <div className="w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden">
                        <img
                          src={item.image}
                          alt={t(item.title)}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {item.icon && !item.image && (
                      <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <DynamicIcon name={item.icon as IconName} className="w-6 h-6" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold mb-2 text-foreground">
                        {t(item.title)}
                      </h3>
                      <p className="text-base text-muted-foreground">
                        {t(item.text)}
                      </p>
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
                      {t(item.title)}
                    </CardTitle>
                  </CardHeader>

                  <CardContent>
                    <CardDescription className="text-base leading-relaxed text-muted-foreground">
                      {t(item.text)}
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