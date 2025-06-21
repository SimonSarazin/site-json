import React, { useEffect } from 'react';
import { SiteHeader } from './layout/SiteHeader';
import { SiteFooter } from './layout/SiteFooter';
import { SectionRenderer } from './sections/SectionRenderer';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useSite } from '@/contexts/SiteContext';
import { useRouterContext } from '@/contexts/RouterContext';
import { useCocolight } from '@/hooks/useCocolight';
import { useMiddleware } from '@/hooks/useMiddleware';

export function SiteRenderer() {
  const { config } = useSite();
  const { t } = useLocalization();
  const { currentPath } = useRouterContext();
  const { me, loading } = useCocolight();

  // Find the current page
  const currentPage = config.pages.find(page => page.path === currentPath) || config.pages[0];

  // Run middleware if defined
  useMiddleware(currentPage?.middleware || []);

  // Check authentication requirements
  useEffect(() => {
    if (!loading && currentPage?.auth?.required && !me?.isConnected) {
      // Redirect to login if authentication is required but user is not logged in
      window.location.href = '/login';
      return;
    }

    // Check role-based access
    if (!loading && currentPage?.auth?.roles && me?.isConnected) {
      const userRoles = me?.serverData?.roles || [];
      const hasRequiredRole = currentPage.auth.roles.some(role => userRoles.includes(role));
      
      if (!hasRequiredRole) {
        // Redirect to unauthorized page or home
        window.location.href = '/';
        return;
      }
    }
  }, [currentPage, me, loading]);
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

      // Update meta keywords
      if (currentPage.seo?.keywords) {
        let metaKeywords = document.querySelector('meta[name="keywords"]');
        if (!metaKeywords) {
          metaKeywords = document.createElement('meta');
          metaKeywords.setAttribute('name', 'keywords');
          document.head.appendChild(metaKeywords);
        }
        metaKeywords.setAttribute('content', currentPage.seo.keywords.join(', '));
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

      // Update OG type
      if (currentPage.seo?.ogType) {
        let ogType = document.querySelector('meta[property="og:type"]');
        if (!ogType) {
          ogType = document.createElement('meta');
          ogType.setAttribute('property', 'og:type');
          document.head.appendChild(ogType);
        }
        ogType.setAttribute('content', currentPage.seo.ogType);
      }

      // Update Twitter Card
      if (currentPage.seo?.twitterCard) {
        let twitterCard = document.querySelector('meta[name="twitter:card"]');
        if (!twitterCard) {
          twitterCard = document.createElement('meta');
          twitterCard.setAttribute('name', 'twitter:card');
          document.head.appendChild(twitterCard);
        }
        twitterCard.setAttribute('content', currentPage.seo.twitterCard);
      }

      // Update canonical URL
      if (currentPage.seo?.canonical) {
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
          canonical = document.createElement('link');
          canonical.setAttribute('rel', 'canonical');
          document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', currentPage.seo.canonical);
      }

      // Update robots meta
      if (currentPage.seo?.noIndex || currentPage.seo?.noFollow) {
        let robots = document.querySelector('meta[name="robots"]');
        if (!robots) {
          robots = document.createElement('meta');
          robots.setAttribute('name', 'robots');
          document.head.appendChild(robots);
        }
        
        const robotsContent = [];
        if (currentPage.seo.noIndex) robotsContent.push('noindex');
        if (currentPage.seo.noFollow) robotsContent.push('nofollow');
        robots.setAttribute('content', robotsContent.join(', '));
      }

      // Add structured data (JSON-LD)
      if (currentPage.seo?.structuredData) {
        // Remove existing structured data
        const existingScript = document.querySelector('script[type="application/ld+json"]');
        if (existingScript) {
          existingScript.remove();
        }
        
        // Add new structured data
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(currentPage.seo.structuredData);
        document.head.appendChild(script);
      }

      // Inject custom CSS
      if (currentPage.customCSS) {
        let customStyle = document.querySelector('#custom-page-css');
        if (!customStyle) {
          customStyle = document.createElement('style');
          customStyle.id = 'custom-page-css';
          document.head.appendChild(customStyle);
        }
        customStyle.textContent = currentPage.customCSS;
      }

      // Inject custom JS
      if (currentPage.customJS) {
        // Remove existing custom script
        const existingScript = document.querySelector('#custom-page-js');
        if (existingScript) {
          existingScript.remove();
        }
        
        // Add new custom script
        const script = document.createElement('script');
        script.id = 'custom-page-js';
        script.textContent = currentPage.customJS;
        document.body.appendChild(script);
      }
    }
  }, [currentPage, t]);

  // Show loading state during authentication check
  if (loading && currentPage?.auth?.required) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

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

  // Apply layout-specific classes
  const getLayoutClasses = () => {
    switch (currentPage.layout) {
      case 'fullwidth':
        return 'w-full';
      case 'sidebar-left':
        return 'grid grid-cols-1 lg:grid-cols-4 gap-8';
      case 'sidebar-right':
        return 'grid grid-cols-1 lg:grid-cols-4 gap-8';
      case 'landing':
        return 'w-full';
      default:
        return 'container mx-auto px-4 sm:px-6 lg:px-8';
    }
  };

  const renderContent = () => {
    if (currentPage.layout === 'sidebar-left') {
      return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <aside className="lg:col-span-1">
              <div className="bg-card rounded-lg border p-6">
                <h3 className="font-semibold mb-4">Navigation</h3>
                {/* Sidebar content would go here */}
                <p className="text-sm text-muted-foreground">Sidebar content</p>
              </div>
            </aside>
            <main className="lg:col-span-3">
              {currentPage.sections.map((section, index) => (
                <SectionRenderer key={index} section={section} />
              ))}
            </main>
          </div>
        </div>
      );
    }

    if (currentPage.layout === 'sidebar-right') {
      return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <main className="lg:col-span-3">
              {currentPage.sections.map((section, index) => (
                <SectionRenderer key={index} section={section} />
              ))}
            </main>
            <aside className="lg:col-span-1">
              <div className="bg-card rounded-lg border p-6">
                <h3 className="font-semibold mb-4">Informations</h3>
                {/* Sidebar content would go here */}
                <p className="text-sm text-muted-foreground">Sidebar content</p>
              </div>
            </aside>
          </div>
        </div>
      );
    // Default, fullwidth, and landing layouts
    return (
      <div className={currentPage.layout === 'fullwidth' || currentPage.layout === 'landing' ? 'w-full' : ''}>
        {currentPage.sections.map((section, index) => (
          <SectionRenderer key={index} section={section} />
        ))}
      </div>
    );
  };

    }
  return (
    <div className="min-h-screen flex flex-col">
      {!currentPage.hideHeader && <SiteHeader />}
      
      <main className={`flex-1 ${currentPage.layout === 'fullwidth' || currentPage.layout === 'landing' ? '' : 'py-8'}`}>
        {renderContent()}
      </main>
      
      {!currentPage.hideFooter && <SiteFooter />}
    </div>
  );
}