import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { useLocalization } from '@/contexts/LocalizationContext';
import { cn } from '@/lib/utils';

interface PricingSectionProps {
  id?: string;
  props: {
    currency?: string;
    plans: Array<{
      sku?: string;
      name: Record<string, string>;
      price: string;
      period?: string;
      features: Array<Record<string, string>>;
      badge?: Record<string, string>;
      cta: {
        label: Record<string, string>;
        href: string;
      };
    }>;
    highlight?: number;
  };
}

export function PricingSection({ id, props }: PricingSectionProps) {
  const { t } = useLocalization();
  const { currency = '€', plans, highlight } = props;

  return (
    <section id={id} className="py-16 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index}
              className={cn(
                "relative transition-all duration-200 hover:shadow-lg",
                highlight === index && "border-primary shadow-lg scale-105"
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    {t(plan.badge)}
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl font-bold">
                  {t(plan.name)}
                </CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {currency}{plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-muted-foreground">
                      /{plan.period}
                    </span>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {plan.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{t(feature)}</span>
                  </div>
                ))}
              </CardContent>
              
              <CardFooter>
                <Button 
                  className="w-full" 
                  variant={highlight === index ? "default" : "outline"}
                  size="lg"
                  asChild
                >
                  <a href={plan.cta.href}>
                    {t(plan.cta.label)}
                  </a>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}