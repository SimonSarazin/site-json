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
  currentPage: Page,
  locale: string = 'en'
): SEOData {
  const getLocalizedText = (text: any) => {
    if (typeof text === 'string') return text;
    if (typeof text === 'object' && text !== null) {
      return text[locale] || text['en'] || Object.values(text)[0] || '';
    }
    return '';
  };

  const title = currentPage?.seo?.title 
    ? getLocalizedText(currentPage.seo.title)
    : getLocalizedText(currentPage?.title || config.meta.title);
    
  const description = currentPage?.seo?.description
    ? getLocalizedText(currentPage.seo.description)
    : getLocalizedText(config.meta.description || {});

  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.SITE_URL || 'http://localhost:5173';
    
  const canonical = currentPage?.seo?.canonical || `${baseUrl}${currentPage?.path || '/'}`;

  return {
    title,
    description,
    keywords: currentPage?.seo?.keywords,
    ogImage: currentPage?.seo?.ogImage,
    ogType: currentPage?.seo?.ogType || 'website',
    twitterCard: currentPage?.seo?.twitterCard,
    canonical,
    noIndex: currentPage?.seo?.noIndex,
    noFollow: currentPage?.seo?.noFollow,
    structuredData: currentPage?.seo?.structuredData,
  };
}