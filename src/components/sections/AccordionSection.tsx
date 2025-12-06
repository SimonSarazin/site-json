import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLocalization } from "@/hooks/useLocalization";
import { AccordionSectionProps } from "@/types/site-schema";
import { type AccordionMultipleProps, type AccordionSingleProps } from "@radix-ui/react-accordion";

export function AccordionSection({ id, props }: { id?: string; props: AccordionSectionProps }): React.ReactNode {
  const { t } = useLocalization();
  const { items, allowMultiple = false } = props;

  /* ------------------------------------------------------------------ */
  /* Valeurs par défaut ouvertes -------------------------------------- */
  const defaultValues = items
    .map((item, idx) => (item.defaultOpen ? `item-${idx}` : null))
    .filter(Boolean) as string[];

  /* ------------------------------------------------------------------ */
  /* « Narrowing » des props pour root -------------------------------- */
  const accordionRootProps: (AccordionSingleProps | AccordionMultipleProps) & {
    className: string;
  } = allowMultiple
    ? {
        type: "multiple",
        defaultValue: defaultValues,
        className: "w-full space-y-4",
      }
    : {
        type: "single",
        collapsible: true,
        defaultValue: defaultValues[0] ?? undefined,
        className: "w-full space-y-4",
      };

  /* ------------------------------------------------------------------ */
  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <Accordion {...accordionRootProps}>
            {items.map((item, idx) => (
              <AccordionItem
                key={idx}
                value={`item-${idx}`}
                className="bg-card rounded-lg px-6 border"
              >
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="font-semibold text-foreground">
                    {t(item.title)}
                  </span>
                </AccordionTrigger>

                <AccordionContent className="pb-4 text-muted-foreground">
                  <div
                    dangerouslySetInnerHTML={{ __html: t(item.content) }}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
