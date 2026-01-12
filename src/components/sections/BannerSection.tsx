import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from '@/lib/utils';
import { BannerSectionProps } from '@/types/site-schema';

export function BannerSection({ id, props }: { id?: string; props: BannerSectionProps }) {
  const { t } = useLocalization();
  const { text, variant = 'info', dismissible = false } = props;
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'bg-success/10 text-success border-success/30';
      case 'warning':
        return 'bg-warning/10 text-warning border-warning/30';
      case 'error':
        return 'bg-error/10 text-error border-error/30';
      default:
        return 'bg-info/10 text-info border-info/30';
    }
  };

  const getIcon = () => {
    switch (variant) {
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  return (
    <section id={id} className={cn('border-b', getVariantStyles())}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            {getIcon()}
            <p className="text-sm font-medium">
              {t(text)}
            </p>
          </div>
          
          {dismissible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="h-auto p-1 hover:bg-transparent"
            >
              <X className="w-4 h-4" />
              <span className="sr-only">Fermer</span>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}