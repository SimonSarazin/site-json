import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ShoppingCart, Eye } from 'lucide-react';
import { useLocalization } from '@/contexts/LocalizationContext';
import { cn } from '@/lib/utils';

interface ProductShowcaseSectionProps {
  id?: string;
  props: {
    products: Array<{
      id: string;
      name: Record<string, string>;
      description: Record<string, string>;
      price?: string;
      images: string[];
      features?: Array<Record<string, string>>;
      cta?: {
        label: Record<string, string>;
        href: string;
      };
    }>;
    layout?: 'grid' | 'carousel' | 'featured';
    showPrices?: boolean;
  };
}

export function ProductShowcaseSection({ id, props }: ProductShowcaseSectionProps) {
  const { t } = useLocalization();
  const { products, layout = 'grid', showPrices = true } = props;
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<string, number>>({});

  const nextImage = (productId: string, totalImages: number) => {
    setCurrentImageIndex(prev => ({
      ...prev,
      [productId]: ((prev[productId] || 0) + 1) % totalImages
    }));
  };

  const prevImage = (productId: string, totalImages: number) => {
    setCurrentImageIndex(prev => ({
      ...prev,
      [productId]: ((prev[productId] || 0) - 1 + totalImages) % totalImages
    }));
  };

  const ProductCard = ({ product, featured = false }: { product: any; featured?: boolean }) => {
    const currentIndex = currentImageIndex[product.id] || 0;
    
    return (
      <Card className={cn(
        "transition-all duration-200 hover:shadow-lg",
        featured && "lg:col-span-2 lg:row-span-2"
      )}>
        {/* Product Images */}
        <div className={cn(
          "relative overflow-hidden rounded-t-lg bg-muted",
          featured ? "h-64 md:h-96" : "h-48"
        )}>
          <img
            src={product.images[currentIndex]}
            alt={t(product.name)}
            className="w-full h-full object-cover"
          />
          
          {product.images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                onClick={() => prevImage(product.id, product.images.length)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                onClick={() => nextImage(product.id, product.images.length)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              
              {/* Image Indicators */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {product.images.map((_, index) => (
                  <button
                    key={index}
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      index === currentIndex ? "bg-white" : "bg-white/50"
                    )}
                    onClick={() => setCurrentImageIndex(prev => ({ ...prev, [product.id]: index }))}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className={cn(
              "text-foreground",
              featured ? "text-2xl" : "text-xl"
            )}>
              {t(product.name)}
            </CardTitle>
            {showPrices && product.price && (
              <Badge variant="secondary" className="shrink-0 text-lg font-bold">
                {product.price}
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className={cn(
            "text-muted-foreground leading-relaxed",
            featured && "text-lg"
          )}>
            {t(product.description)}
          </p>
          
          {/* Features */}
          {product.features && product.features.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Caractéristiques :</h4>
              <ul className="space-y-1">
                {product.features.slice(0, featured ? 6 : 3).map((feature, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                    {t(feature)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* CTA Buttons */}
          <div className="flex gap-2 pt-2">
            {product.cta && (
              <Button asChild className="flex-1">
                <a href={product.cta.href}>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {t(product.cta.label)}
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {layout === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {layout === 'carousel' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {layout === 'featured' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {products.map((product, index) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  featured={index === 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}