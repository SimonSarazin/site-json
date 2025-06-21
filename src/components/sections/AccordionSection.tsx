import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLocalization } from '@/contexts/LocalizationContext';

interface AccordionSectionProps {
  id?: string;
  props: {
    items: Array<{
      title: Record<string, string>;
      content: Record<string, string>;
      defaultOpen?: boolean;
    }>;
    allowMultiple?: boolean;
  };
}

export function AccordionSection({ id, props }: AccordionSectionProps) {
  const { t } = useLocalization();
  const { items, allowMultiple = false } = props;

  const defaultValues = items
    .map((item, index) => item.defaultOpen ? `item-${index}` : null)
    .filter(Boolean) as string[];

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <Accordion 
            type={allowMultiple ? "multiple" : "single"} 
            collapsible={!allowMultiple}
            defaultValue={allowMultiple ? defaultValues : defaultValues[0]}
            className="w-full space-y-4"
          >
            {items.map((item, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card rounded-lg px-6 border"
              >
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="font-semibold text-foreground">{t(item.title)}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-muted-foreground">
                  <div dangerouslySetInnerHTML={{ __html: t(item.content) }} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}