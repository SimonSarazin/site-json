import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { useLocalization } from "@/hooks/useLocalization";

interface ComparisonSectionProps {
  id?: string;
  props: {
    beforeImage: string;
    afterImage: string;
    beforeLabel?: Record<string, string>;
    afterLabel?: Record<string, string>;
    orientation?: 'horizontal' | 'vertical';
  };
}

export function ComparisonSection({ id, props }: ComparisonSectionProps) {
  const { t } = useLocalization();
  const { beforeImage, afterImage, beforeLabel, afterLabel, orientation = 'horizontal' } = props;
  const [position, setPosition] = useState([50]);

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
            {/* Before Image */}
            <div className="absolute inset-0">
              <img
                src={beforeImage}
                alt={beforeLabel ? t(beforeLabel) : 'Before'}
                className="w-full h-full object-cover"
              />
              {beforeLabel && (
                <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded text-sm">
                  {t(beforeLabel)}
                </div>
              )}
            </div>

            {/* After Image */}
            <div 
              className="absolute inset-0 overflow-hidden"
              style={{
                clipPath: orientation === 'horizontal' 
                  ? `inset(0 ${100 - position[0]}% 0 0)`
                  : `inset(${position[0]}% 0 0 0)`
              }}
            >
              <img
                src={afterImage}
                alt={afterLabel ? t(afterLabel) : 'After'}
                className="w-full h-full object-cover"
              />
              {afterLabel && (
                <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded text-sm">
                  {t(afterLabel)}
                </div>
              )}
            </div>

            {/* Divider Line */}
            <div 
              className="absolute bg-white shadow-lg"
              style={{
                [orientation === 'horizontal' ? 'left' : 'top']: `${position[0]}%`,
                [orientation === 'horizontal' ? 'width' : 'height']: '2px',
                [orientation === 'horizontal' ? 'height' : 'width']: '100%',
                transform: orientation === 'horizontal' ? 'translateX(-50%)' : 'translateY(-50%)'
              }}
            />

            {/* Handle */}
            <div 
              className="absolute w-8 h-8 bg-white rounded-full shadow-lg border-2 border-primary cursor-pointer flex items-center justify-center"
              style={{
                [orientation === 'horizontal' ? 'left' : 'top']: `${position[0]}%`,
                [orientation === 'horizontal' ? 'top' : 'left']: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="w-1 h-4 bg-primary rounded" />
            </div>
          </div>

          {/* Slider Control */}
          <div className="mt-6">
            <Slider
              value={position}
              onValueChange={setPosition}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}