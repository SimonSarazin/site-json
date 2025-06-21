import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SEOData } from '@/lib/seo';

interface SEOHeadProps {
  seoData: SEOData;
}

export function SEOHead({ seoData }: SEOHeadProps) {
  const robotsContent = [];
  if (seoData.noIndex) robotsContent.push('noindex');
  if (seoData.noFollow) robotsContent.push('nofollow');

  return (
    <Helmet>
      <title>{seoData.title}</title>
      
      {seoData.description && (
        <meta name="description" content={seoData.description} />
      )}
      
      {seoData.keywords && seoData.keywords.length > 0 && (
        <meta name="keywords" content={seoData.keywords.join(', ')} />
      )}
      
      {seoData.canonical && (
        <link rel="canonical" href={seoData.canonical} />
      )}
      
      {robotsContent.length > 0 && (
        <meta name="robots" content={robotsContent.join(', ')} />
      )}
      
      {/* Open Graph */}
      <meta property="og:title" content={seoData.title} />
      {seoData.description && (
        <meta property="og:description" content={seoData.description} />
      )}
      {seoData.canonical && (
        <meta property="og:url" content={seoData.canonical} />
      )}
      <meta property="og:type" content={seoData.ogType || 'website'} />
      {seoData.ogImage && (
        <meta property="og:image" content={seoData.ogImage} />
      )}
      
      {/* Twitter Card */}
      {seoData.twitterCard && (
        <meta name="twitter:card" content={seoData.twitterCard} />
      )}
      
      {/* Structured Data */}
      {seoData.structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(seoData.structuredData)}
        </script>
      )}
    </Helmet>
  );
}