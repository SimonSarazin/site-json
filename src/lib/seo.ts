import { SiteConfig, Page } from '@/types/site';

export interface SEOData {
  title: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  canonical?: string;
  noIndex?: boolean;
  noFollow?: boolean;
  structuredData?: any;
}

export function generateSEOData(
  config: SiteConfig, 
  page: Page, 
  locale: string = 'en'
): SEOData {
  const title = page.seo?.title?.[locale] || page.title[locale] || config.meta.title[locale];
  const description = page.seo?.description?.[locale] || config.meta.description?.[locale];
  
  return {
    title,
    description,
    keywords: page.seo?.keywords || config.meta.keywords,
    ogImage: page.seo?.ogImage,
    ogType: page.seo?.ogType || 'website',
    twitterCard: page.seo?.twitterCard || 'summary_large_image',
    canonical: page.seo?.canonical,
    noIndex: page.seo?.noIndex,
    noFollow: page.seo?.noFollow,
    structuredData: page.seo?.structuredData
  };
}

export function generateStructuredData(config: SiteConfig, page: Page, locale: string = 'en') {
  const baseData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.meta.title[locale],
    description: config.meta.description?.[locale],
    url: typeof window !== 'undefined' ? window.location.origin : '',
  };

  // Add page-specific structured data
  if (page.seo?.structuredData) {
    return {
      ...baseData,
      ...page.seo.structuredData
    };
  }

  return baseData;
}

export function generateSitemap(config: SiteConfig): string {
  const baseUrl = process.env.SITE_URL || 'http://localhost:5173';
  
  const urls = config.pages.map(page => {
    const loc = `${baseUrl}${page.path}`;
    const lastmod = new Date().toISOString().split('T')[0];
    const priority = page.path === '/' ? '1.0' : '0.8';
    
    return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${priority}</priority>
  </url>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export function generateRobotsTxt(config: SiteConfig): string {
  const baseUrl = process.env.SITE_URL || 'http://localhost:5173';
  
  return `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;
}