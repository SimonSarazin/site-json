import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as Icons from 'lucide-react';
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from '@/lib/utils';

interface TabsSectionProps {
  id?: string;
  props: {
    tabs: Array<{
      id: string;
      label: Record<string, string>;
      content: Record<string, string>;
      icon?: string;
    }>;
    defaultTab?: string;
    orientation?: 'horizontal' | 'vertical';
  };
}

export function TabsSection({ id, props }: TabsSectionProps) {
  const { t } = useLocalization();
  const { tabs, defaultTab, orientation = 'horizontal' } = props;

  const renderIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    return IconComponent ? <IconComponent className="w-4 h-4" /> : null;
  };

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <Tabs 
            defaultValue={defaultTab || tabs[0]?.id} 
            orientation={orientation}
            className={cn(
              "w-full",
              orientation === 'vertical' && "flex gap-8"
            )}
          >
            <TabsList className={cn(
              "grid w-full",
              orientation === 'horizontal' && `grid-cols-${Math.min(tabs.length, 4)}`,
              orientation === 'vertical' && "flex-col h-fit w-64"
            )}>
              {tabs.map((tab) => (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className={cn(
                    "flex items-center gap-2",
                    orientation === 'vertical' && "justify-start"
                  )}
                >
                  {tab.icon && renderIcon(tab.icon)}
                  {t(tab.label)}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <div className={cn(
              orientation === 'vertical' && "flex-1"
            )}>
              {tabs.map((tab) => (
                <TabsContent 
                  key={tab.id} 
                  value={tab.id}
                  className="mt-6 p-6 bg-card rounded-lg border"
                >
                  <div 
                    className="prose prose-gray dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: t(tab.content) }} 
                  />
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      </div>
    </section>
  );
}