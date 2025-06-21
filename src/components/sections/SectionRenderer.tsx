import React from 'react';
import { Section } from '@/types/site';
import { HeroSection } from './HeroSection';
import { CardsSection } from './CardsSection';
import { TestimonialsSection } from './TestimonialsSection';
import { PricingSection } from './PricingSection';
import { FAQSection } from './FAQSection';
import { BlogPostSection } from './BlogPostSection';
import { BlogListSection } from './BlogListSection';
import { TeamSection } from './TeamSection';
import { StatsSection } from './StatsSection';
import { CTASection } from './CTASection';
import { LogoCloudSection } from './LogoCloudSection';
import { AccordionSection } from './AccordionSection';
import { TabsSection } from './TabsSection';
import { StepsSection } from './StepsSection';
import { TimelineSection } from './TimelineSection';
import { BannerSection } from './BannerSection';
import { ContactFormSection } from './ContactFormSection';
import { MarkdownSection } from './MarkdownSection';
import { GallerySection } from './GallerySection';
import { VideoSection } from './VideoSection';
import { TableSection } from './TableSection';
import { ChartSection } from './ChartSection';
import { MapSection } from './MapSection';
import { NewsletterSection } from './NewsletterSection';
import { ComparisonSection } from './ComparisonSection';
import { FeatureComparisonSection } from './FeatureComparisonSection';
import { SocialFeedSection } from './SocialFeedSection';
import { SearchSection } from './SearchSection';
import { EventListSection } from './EventListSection';
import { ProductShowcaseSection } from './ProductShowcaseSection';
import { BreadcrumbSection } from './BreadcrumbSection';
import { CookieConsentSection } from './CookieConsentSection';
import { HTMLSection } from './HTMLSection';
import LoginForm from '../auth/LoginForm';
import RegisterForm from '../auth/RegisterForm';
import RecoverPasswordForm from '../auth/RecoverPasswordForm';

interface SectionRendererProps {
  section: Section;
}

export function SectionRenderer({ section }: SectionRendererProps) {
  switch (section.type) {
    case 'hero':
      return <HeroSection id={section.id} props={section.props} />;
    
    case 'markdown':
      return <MarkdownSection id={section.id} props={section.props} />;
    
    case 'cards':
      return <CardsSection id={section.id} props={section.props} />;
    
    case 'gallery':
      return <GallerySection id={section.id} props={section.props} />;
    
    case 'video':
      return <VideoSection id={section.id} props={section.props} />;
    
    case 'testimonials':
      return <TestimonialsSection id={section.id} props={section.props} />;
    
    case 'pricing':
      return <PricingSection id={section.id} props={section.props} />;
    
    case 'faq':
      return <FAQSection id={section.id} props={section.props} />;
    
    case 'table':
      return <TableSection id={section.id} props={section.props} />;
    
    case 'blogPost':
      return <BlogPostSection id={section.id} props={section.props} />;
    
    case 'blogList':
      return <BlogListSection id={section.id} props={section.props} />;
    
    case 'team':
      return <TeamSection id={section.id} props={section.props} />;
    
    case 'stats':
      return <StatsSection id={section.id} props={section.props} />;
    
    case 'cta':
      return <CTASection id={section.id} props={section.props} />;
    
    case 'logoCloud':
      return <LogoCloudSection id={section.id} props={section.props} />;
    
    case 'chart':
      return <ChartSection id={section.id} props={section.props} />;
    
    case 'accordion':
      return <AccordionSection id={section.id} props={section.props} />;
    
    case 'tabs':
      return <TabsSection id={section.id} props={section.props} />;
    
    case 'steps':
      return <StepsSection id={section.id} props={section.props} />;
    
    case 'timeline':
      return <TimelineSection id={section.id} props={section.props} />;
    
    case 'banner':
      return <BannerSection id={section.id} props={section.props} />;
    
    case 'map':
      return <MapSection id={section.id} props={section.props} />;
    
    case 'newsletter':
      return <NewsletterSection id={section.id} props={section.props} />;
    
    case 'contactForm':
      return <ContactFormSection id={section.id} props={section.props} />;
    
    case 'comparison':
      return <ComparisonSection id={section.id} props={section.props} />;
    
    case 'featureComparison':
      return <FeatureComparisonSection id={section.id} props={section.props} />;
    
    case 'socialFeed':
      return <SocialFeedSection id={section.id} props={section.props} />;
    
    case 'search':
      return <SearchSection id={section.id} props={section.props} />;
    
    case 'eventList':
      return <EventListSection id={section.id} props={section.props} />;
    
    case 'productShowcase':
      return <ProductShowcaseSection id={section.id} props={section.props} />;
    
    case 'breadcrumb':
      return <BreadcrumbSection id={section.id} props={section.props} />;
    
    case 'cookieConsent':
      return <CookieConsentSection id={section.id} props={section.props} />;
    
    case 'html':
      return <HTMLSection id={section.id} props={section.props} />;
    
    case 'loginForm':
      return (
        <section id={section.id} className="py-16 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
              <LoginForm />
            </div>
          </div>
        </section>
      );
    
    case 'registerForm':
      return (
        <section id={section.id} className="py-16 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
              <RegisterForm />
            </div>
          </div>
        </section>
      );
    
    case 'recoverPasswordForm':
      return (
        <section id={section.id} className="py-16 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
              <RecoverPasswordForm />
            </div>
          </div>
        </section>
      );
    
    default:
      return (
        <section id={section.id} className="py-16 bg-muted/30 text-foreground">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-muted-foreground">
                Section type "{(section as any).type}" not implemented yet
              </p>
            </div>
          </div>
        </section>
      );
  }
}