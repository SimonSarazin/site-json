import React, { useEffect, useState } from 'react';
import { SiteHeader } from './layout/SiteHeader';
import { SiteFooter } from './layout/SiteFooter';
import { SectionRenderer } from './sections/SectionRenderer';
import { useSite } from '@/contexts/SiteContext';
import { useRouterContext } from '@/contexts/RouterContext';
import { Seo } from './layout/Seo';

export function SiteRenderer() {
  const { config } = useSite();
  const { currentPath } = useRouterContext();

  // Find the current page
  const currentPage = config.pages.find(page => page.path === currentPath) || config.pages[0];

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
    <>
    <Seo page={currentPage} /> 
    <div className="min-h-screen flex flex-col">
      {!currentPage.hideHeader && <SiteHeader />}
      
      <main className="flex-1">
        {currentPage.sections.map((section, index) => (
          <SectionRenderer key={index} section={section} />
        ))}
      </main>
      
      {!currentPage.hideFooter && <SiteFooter />}
    </div>
    </>
  );
}