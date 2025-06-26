import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from '@/lib/utils';
import { DynamicIcon, IconName } from 'lucide-react/dynamic';

interface CardsSectionProps {
  id?: string;
  props: {
    items: Array<{
      icon?: string;
      image?: string;
      title: Record<string, string>;
      text: Record<string, string>;
      href?: string;
      target?: '_self' | '_blank';
    }>;
    columns?: 1 | 2 | 3 | 4 | 5 | 6;
    layout?: 'grid' | 'masonry' | 'carousel';
  };
}

export function CardsSection({ id, props }: CardsSectionProps) {
  const { t } = useLocalization();
  const { items, columns = 3, layout = 'grid' } = props;

  const getGridCols = (cols: number) => {
    const colsMap = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 md:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
      5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
      6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
    };
    return colsMap[cols];
  };

  const CardWrapper = ({ children, href, target }: { children: React.ReactNode; href?: string; target?: string }) => {
    if (href) {
      return (
        <a 
          href={href} 
          target={target || '_self'}
          rel={target === '_blank' ? 'noopener noreferrer' : undefined}
          className="block group"
        >
          {children}
        </a>
      );
    }
    return <>{children}</>;
  };

  return (
    <section id={id} className="py-16 bg-background text-foreground">
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