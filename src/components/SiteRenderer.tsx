import React, { useEffect } from 'react';
import { SiteHeader } from './layout/SiteHeader';
import { SiteFooter } from './layout/SiteFooter';
import { SectionRenderer } from './sections/SectionRenderer';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useSite } from '@/contexts/SiteContext';
import { useRouterContext } from '@/contexts/RouterContext';

export function SiteRenderer() {
  const { config } = useSite();
  const { t } = useLocalization();
  const { currentPath } = useRouterContext();

  // Find the current page
  const currentPage = config.pages.find(page => page.path === currentPath) || config.pages[0];

  // Update document title and meta tags
  useEffect(() => {
    if (currentPage) {
      document.title = currentPage.seo?.title 
        ? t(currentPage.seo.title)
        : t(currentPage.title);
      
      // Update meta description
      if (currentPage.seo?.description) {
        let metaDescription = document.querySelector('meta[name="description"]');
        if (!metaDescription) {
          metaDescription = document.createElement('meta');
          metaDescription.setAttribute('name', 'description');
          document.head.appendChild(metaDescription);
        }
        metaDescription.setAttribute('content', t(currentPage.seo.description));
      }

      // Update OG image
      if (currentPage.seo?.ogImage) {
        let ogImage = document.querySelector('meta[property="og:image"]');
        if (!ogImage) {
          ogImage = document.createElement('meta');
          ogImage.setAttribute('property', 'og:image');
          document.head.appendChild(ogImage);
        }
        ogImage.setAttribute('content', currentPage.seo.ogImage);
      }
    }
  }, [currentPage, t]);

  if (!currentPage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">404</h1>
          <p className="text-muted-foreground">Page not found</p>
          <p className="text-sm text-muted-foreground mt-2">
            Path: {currentPath}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {!currentPage.hideHeader && <SiteHeader />}
      
      <main className="flex-1">
        {currentPage.sections.map((section, index) => (
          <SectionRenderer key={index} section={section} />
        ))}
      </main>
      
      {!currentPage.hideFooter && <SiteFooter />}
    </div>
  );
}