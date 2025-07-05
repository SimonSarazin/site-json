import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from '@/lib/utils';
import { TabsSectionProps } from '@/types/site-schema';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';

export function TabsSection({ id, props }: { id?: string; props: TabsSectionProps }) {
  const { t } = useLocalization();
  const { tabs, defaultTab, orientation = 'horizontal' } = props;

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
                  {tab.icon && 
                  <DynamicIcon
                    name={tab.icon as IconName}
                    className="w-4 h-4"
                  />
                  }
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