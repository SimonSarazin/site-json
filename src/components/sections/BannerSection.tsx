import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { T } from "@/components/ui/T";
import { cn } from '@/lib/utils';
import { BannerSectionProps } from '@/types/site-schema';

export function BannerSection({ id, props }: { id?: string; props: BannerSectionProps }) {
  const { text, variant = 'info', dismissible = false } = props;
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800';
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
            <T k={text} as="p" className="text-sm font-medium" />
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
export default BannerSection;
