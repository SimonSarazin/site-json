import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from '@/lib/utils';
import type { SectionPropsMap } from '@/types/site';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';

export function CardsSection({ id, props }: { id?: string; props: SectionPropsMap["cards"] }) {
  const { t } = useLocalization();
  const { items, columns = 3, layout = 'grid', variant = 'default', className } = props;

  const getGridCols = (cols: number) => {
    const colsMap: Record<number, string> = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 md:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
      5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
      6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
    };
    return colsMap[cols as keyof typeof colsMap];
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
        <a
          href={href}
          target={target || '_self'}
          rel={target === '_blank' ? 'noopener noreferrer' : undefined}
          className="block"
        >
          {children}
        </a>
      );
    }
    return <>{children}</>;
  };

  // Variante Event
  if (variant === 'event') {
    return (
      <section id={id} className={cn("bg-background", className)}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
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
      <section id={id} className={cn("bg-background", className)}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
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
        </div>
      </section>
    );
  }

  // Variante par défaut
  return (
    <section id={id} className={cn("bg-background text-foreground", className)}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={cn(
          "grid gap-6",
          layout === 'grid' && getGridCols(columns),
          layout === 'masonry' && `columns-1 md:columns-${Math.min(columns, 2)} lg:columns-${columns} gap-6`,
          layout === 'carousel' && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 overflow-x-auto"
        )}>
          {items.map((item, index) => (
            <CardWrapper key={index} href={item.href} target={item.target}>
              <Card className={cn(
                "h-full transition-all duration-200",
                item.href && "hover:shadow-lg hover:-translate-y-1 cursor-pointer",
                layout === 'masonry' && "break-inside-avoid mb-6"
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
      </div>
    </section>
  );
}