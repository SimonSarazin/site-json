import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { T } from "@/components/ui/T";
import { cn } from '@/lib/utils';
import { FeatureComparisonSectionProps } from '@/types/site-schema';

export function FeatureComparisonSection({ id, props }: { id?: string; props: FeatureComparisonSectionProps }) {
  const { features, plans } = props;

  const renderFeatureValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="w-5 h-5 text-green-500 mx-auto" />
      ) : (
        <X className="w-5 h-5 text-red-500 mx-auto" />
      );
    }
    return <span className="text-sm">{value}</span>;
  };

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3">Fonctionnalités</TableHead>
                  {plans.map((plan, index) => (
                    <TableHead key={index} className="text-center relative">
                      <div className={cn(
                        "p-4 rounded-t-lg",
                        plan.highlighted && "bg-primary/10 border-primary"
                      )}>
                        {plan.highlighted && (
                          <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary">
                            Populaire
                          </Badge>
                        )}
                        <T k={plan.name} as="div" className="font-semibold" />
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((feature, featureIndex) => (
                  <TableRow key={featureIndex}>
                    <TableCell className="font-medium">
                      <div>
                        <T k={feature.name} as="div" className="font-semibold" />
                        {feature.description && (
                          <T k={feature.description} as="div" className="text-sm text-muted-foreground mt-1" />
                        )}
                      </div>
                    </TableCell>
                    {plans.map((plan, planIndex) => (
                      <TableCell
                        key={planIndex}
                        className={cn(
                          "text-center",
                          plan.highlighted && "bg-primary/5"
                        )}
                      >
                        {renderFeatureValue(plan.features[featureIndex])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </section>
  );
}
export default FeatureComparisonSection;
