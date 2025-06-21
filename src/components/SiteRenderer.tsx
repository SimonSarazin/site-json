import React, { useEffect } from 'react';
import { SiteHeader } from './layout/SiteHeader';
import { SiteFooter } from './layout/SiteFooter';
import { SectionRenderer } from './sections/SectionRenderer';
import { SEOHead } from './SEOHead';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useSite } from '@/contexts/SiteContext';
import { useRouterContext } from '@/contexts/RouterContext';
import { useCocolight } from '@/hooks/useCocolight';
import { useMiddleware } from '@/hooks/useMiddleware';
import { generateSEOData } from '@/lib/seo';

export function SiteRenderer() {
  const { config } = useSite();
  const { t, currentLocale } = useLocalization();
  const { currentPath } = useRouterContext();
  const { me, loading } = useCocolight();

  // Find the current page
  const currentPage = config.pages.find(page => page.path === currentPath) || config.pages[0];

  // Run middleware if defined
  useMiddleware(currentPage?.middleware || []);

  // Generate SEO data
  const seoData = generateSEOData(config, currentPage, currentLocale);

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

  // Handle custom CSS and JS injection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Inject custom CSS
    if (currentPage?.customCSS) {
      let customStyle = document.querySelector('#custom-page-css');
      if (!customStyle) {
        customStyle = document.createElement('style');
        customStyle.id = 'custom-page-css';
        document.head.appendChild(customStyle);
      }
      customStyle.textContent = currentPage.customCSS;
    }

    // Inject custom JS
    if (currentPage?.customJS) {
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
  }, [currentPage]);

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
    }
    // Default, fullwidth, and landing layouts
    return (
      <div className={currentPage.layout === 'fullwidth' || currentPage.layout === 'landing' ? 'w-full' : ''}>
        {currentPage.sections.map((section, index) => (
          <SectionRenderer key={index} section={section} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead seoData={seoData} />
      {!currentPage.hideHeader && <SiteHeader />}
      
      <main className={`flex-1 ${currentPage.layout === 'fullwidth' || currentPage.layout === 'landing' ? '' : 'py-8'}`}>
        {renderContent()}
      </main>
      
      {!currentPage.hideFooter && <SiteFooter />}
    </div>
  );
}