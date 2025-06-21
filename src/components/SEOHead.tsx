import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SEOData } from '@/lib/seo';

interface SEOHeadProps {
  seo: SEOData;
}

export function SEOHead({ seo }: SEOHeadProps) {
  return (
    <Helmet>
      <title>{seo.title}</title>
      
      {seo.description && (
        <meta name="description" content={seo.description} />
      )}
      
      {seo.keywords && (
        <meta name="keywords" content={seo.keywords.join(', ')} />
      )}
      
      {/* Open Graph */}
      <meta property="og:title" content={seo.title} />
      {seo.description && (
        <meta property="og:description" content={seo.description} />
      )}
      {seo.ogImage && (
        <meta property="og:image" content={seo.ogImage} />
      )}
      <meta property="og:type" content={seo.ogType || 'website'} />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content={seo.twitterCard || 'summary_large_image'} />
      <meta name="twitter:title" content={seo.title} />
      {seo.description && (
        <meta name="twitter:description" content={seo.description} />
      )}
      {seo.ogImage && (
        <meta name="twitter:image" content={seo.ogImage} />
      )}
      
      {/* Canonical URL */}
      {seo.canonical && (
        <link rel="canonical" href={seo.canonical} />
      )}
      
      {/* Robots */}
      {(seo.noIndex || seo.noFollow) && (
        <meta 
          name="robots" 
          content={[
            seo.noIndex ? 'noindex' : '',
            seo.noFollow ? 'nofollow' : ''
          ].filter(Boolean).join(', ')} 
        />
      )}
      
      {/* Structured Data */}
      {seo.structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(seo.structuredData)}
        </script>
      )}
    </Helmet>
  );
}