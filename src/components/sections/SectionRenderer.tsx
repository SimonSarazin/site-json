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
    
    case 'cards':
      return <CardsSection id={section.id} props={section.props} />;
    
    case 'testimonials':
      return <TestimonialsSection id={section.id} props={section.props} />;
    
    case 'pricing':
      return <PricingSection id={section.id} props={section.props} />;
    
    case 'faq':
      return <FAQSection id={section.id} props={section.props} />;
    
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
    
    case 'contactForm':
      return <ContactFormSection id={section.id} props={section.props} />;
    
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
    
    case 'markdown':
      return (
        <section id={section.id} className="py-16 bg-background text-foreground">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto prose prose-gray dark:prose-invert">
              {section.props.sourceType === 'inline' ? (
                <div dangerouslySetInnerHTML={{ __html: section.props.md }} />
              ) : (
                <div>Content from: {section.props.md}</div>
              )}
            </div>
          </div>
        </section>
      );
    
    case 'gallery':
      return (
        <section id={section.id} className="py-16 bg-background text-foreground">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`grid grid-cols-1 md:grid-cols-${section.props.columns} gap-4`}>
              {section.props.images.map((image, index) => (
                <div key={index} className="aspect-square overflow-hidden rounded-lg">
                  <img
                    src={image.src}
                    alt={image.alt ? Object.values(image.alt)[0] : `Gallery image ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    
    case 'video':
      return (
        <section id={section.id} className="py-16 bg-background text-foreground">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className={`aspect-video rounded-lg overflow-hidden`}>
                {section.props.provider === 'youtube' && (
                  <iframe
                    src={`https://www.youtube.com/embed/${section.props.src}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
                {section.props.provider === 'local' && (
                  <video
                    src={section.props.src}
                    controls={section.props.controls}
                    autoPlay={section.props.autoplay}
                    loop={section.props.loop}
                    className="w-full h-full"
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      );
    
    case 'html':
      return (
        <section id={section.id}>
          <div dangerouslySetInnerHTML={{ __html: section.props.html }} />
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