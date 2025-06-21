import React from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useLocalization } from '@/contexts/LocalizationContext';
import { cn } from '@/lib/utils';

interface StepsSectionProps {
  id?: string;
  props: {
    steps: Array<{
      title: Record<string, string>;
      description: Record<string, string>;
      icon?: string;
      completed?: boolean;
    }>;
    orientation?: 'horizontal' | 'vertical';
    showProgress?: boolean;
  };
}

export function StepsSection({ id, props }: StepsSectionProps) {
  const { t } = useLocalization();
  const { steps, orientation = 'horizontal', showProgress = true } = props;

  const completedSteps = steps.filter(step => step.completed).length;
  const progressPercentage = (completedSteps / steps.length) * 100;

  const renderIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    return IconComponent ? <IconComponent className="w-6 h-6" /> : null;
  };

  const StepIndicator = ({ step, index, isLast }: { step: any; index: number; isLast: boolean }) => (
    <div className={cn(
      "flex items-center",
      orientation === 'vertical' ? "flex-col" : "flex-row"
    )}>
      {/* Step Circle */}
      <div className={cn(
        "relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-200",
        step.completed 
          ? "bg-primary border-primary text-primary-foreground" 
          : "bg-background border-muted-foreground text-muted-foreground"
      )}>
        {step.completed ? (
          <CheckCircle className="w-6 h-6" />
        ) : step.icon ? (
          renderIcon(step.icon)
        ) : (
          <span className="font-semibold">{index + 1}</span>
        )}
      </div>

      {/* Connector Line */}
      {!isLast && (
        <div className={cn(
          "bg-muted-foreground/30",
          orientation === 'horizontal' 
            ? "h-0.5 flex-1 mx-4" 
            : "w-0.5 h-16 my-4"
        )} />
      )}
    </div>
  );

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Progress Bar */}
          {showProgress && (
            <div className="mb-12">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-foreground">Progression</span>
                <span className="text-sm text-muted-foreground">
                  {completedSteps}/{steps.length} étapes
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}

          {/* Steps */}
          <div className={cn(
            "flex",
            orientation === 'horizontal' 
              ? "flex-row items-start justify-between" 
              : "flex-col space-y-8"
          )}>
            {steps.map((step, index) => (
              <div 
                key={index}
                className={cn(
                  "flex",
                  orientation === 'horizontal' 
                    ? "flex-col items-center text-center max-w-xs" 
                    : "flex-row items-start gap-6"
                )}
              >
                <StepIndicator 
                  step={step} 
                  index={index} 
                  isLast={index === steps.length - 1} 
                />
                
                <div className={cn(
                  orientation === 'horizontal' ? "mt-4" : "flex-1"
                )}>
                  <h3 className={cn(
                    "font-semibold mb-2",
                    step.completed ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {t(step.title)}
                  </h3>
                  
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(step.description)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}