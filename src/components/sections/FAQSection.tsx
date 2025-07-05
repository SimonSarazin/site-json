import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLocalization } from "@/hooks/useLocalization";
import { FAQSectionProps } from '@/types/site-schema';

export function FAQSection({ id, props }: { id?: string; props: FAQSectionProps }) {
  const { t } = useLocalization();
  const { items, accordion = true } = props;

  if (accordion) {
    return (
      <section id={id} className="py-16 bg-muted/30 text-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full space-y-4">
              {items.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="bg-background rounded-lg px-6 border"
                >
                  <AccordionTrigger className="text-left hover:no-underline py-4">
                    <span className="font-semibold text-foreground">{t(item.q)}</span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 text-muted-foreground">
                    {t(item.a)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id={id} className="py-16 bg-muted/30 text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-8">
          {items.map((item, index) => (
            <div key={index} className="bg-background rounded-lg p-6 border">
              <h3 className="font-semibold text-lg mb-3 text-foreground">{t(item.q)}</h3>
              <p className="text-muted-foreground leading-relaxed">{t(item.a)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}