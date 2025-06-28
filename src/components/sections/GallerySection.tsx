import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from '@/lib/utils';

interface GallerySectionProps {
  id?: string;
  props: {
    images: Array<GalleryImage>;
    columns?: 1 | 2 | 3 | 4 | 5 | 6;
    lightbox?: boolean;
  };
}

interface GalleryImage {
  src: string;
  alt?: Record<string, string>;
  caption?: Record<string, string>;
}

export function GallerySection({ id, props }: GallerySectionProps) {
  const { t } = useLocalization();
  const { images, columns = 3, lightbox = true } = props;
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  const getGridCols = (cols: number) => {
    const colsMap: Record<number, string> = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 md:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
      5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
      6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
    };
    return colsMap[cols as 1|2|3|4|5|6];
  };

  const nextImage = () => {
    setSelectedImage((prev) => 
      prev !== null ? (prev + 1) % images.length : 0
    );
  };

  const prevImage = () => {
    setSelectedImage((prev) => 
      prev !== null ? (prev - 1 + images.length) % images.length : 0
    );
  };

  const ImageItem = ({ image, index }: { image: GalleryImage; index: number }) => {
    const content = (
      <div className="group relative aspect-square overflow-hidden rounded-lg bg-muted cursor-pointer">
        <img
          src={image.src}
          alt={image.alt ? t(image.alt) : `Gallery image ${index + 1}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
        {image.caption && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-linear-to-t from-black/60 to-transparent">
            <p className="text-white text-sm">{t(image.caption)}</p>
          </div>
        )}
      </div>
    );

    if (lightbox) {
      return (
        <div key={index} onClick={() => setSelectedImage(index)}>
          {content}
        </div>
      );
    }

    return <div key={index}>{content}</div>;
  };

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={cn("grid gap-4", getGridCols(columns))}>
          {images.map((image, index) => (
            <ImageItem key={index} image={image} index={index} />
          ))}
        </div>

        {/* Lightbox */}
        {lightbox && selectedImage !== null && (
          <Dialog open={selectedImage !== null} onOpenChange={() => setSelectedImage(null)}>
            <DialogContent className="max-w-4xl w-full h-full max-h-[90vh] p-0">
              <DialogHeader>
                <DialogTitle className="sr-only">Image Gallery</DialogTitle>
              </DialogHeader>
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Fermer la galerie"
                  className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                  onClick={() => setSelectedImage(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Image précédente"
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={prevImage}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Image suivante"
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={nextImage}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>

                <img
                  src={images[selectedImage].src}
                  alt={images[selectedImage].alt ? t(images[selectedImage].alt!) : `Gallery image ${selectedImage + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
                
                {images[selectedImage].caption && (
                  <div className="absolute bottom-4 left-4 right-4 text-center">
                    <p className="text-white bg-black/50 px-4 py-2 rounded">
                      {t(images[selectedImage].caption!)}
                    </p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </section>
  );
}