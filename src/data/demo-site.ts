import { SiteConfig } from '@/types/site';

export const demoSiteConfig: SiteConfig = {
  version: "1.0.0",
  generated: new Date().toISOString(),
  meta: {
    title: { 
      fr: "SiteForge - Générateur de Sites JSON", 
      en: "SiteForge - JSON Site Generator" 
    },
    description: { 
      fr: "Créez des sites web magnifiques à partir de simple configurations JSON", 
      en: "Create beautiful websites from simple JSON configurations" 
    },
    defaultLang: "en",
    languages: ["fr", "en"],
    favicon: "/favicon.ico",
    themeColor: "#3b82f6",
  },
  header: {
    logo: "https://images.pexels.com/photos/17171481/pexels-photo-17171481/free-photo-of-abstract-blue-and-purple-gradient-background.jpeg?auto=compress&cs=tinysrgb&w=60&h=60&dpr=2",
    logoAlt: { fr: "Logo SiteForge", en: "SiteForge Logo" },
    nav: [
      { 
        path: "/", 
        label: { fr: "Accueil", en: "Home" },
        icon: "home"
      },
      { 
        path: "/features", 
        label: { fr: "Fonctionnalités", en: "Features" },
        icon: "zap"
      },
      { 
        path: "/pricing", 
        label: { fr: "Tarifs", en: "Pricing" },
        icon: "creditCard"
      },
      {
        label: { fr: "Ressources", en: "Resources" },
        icon: "book",
        children: [
          { 
            path: "/docs", 
            label: { fr: "Documentation", en: "Documentation" },
            icon: "fileText"
          },
          { 
            path: "/examples", 
            label: { fr: "Exemples", en: "Examples" },
            icon: "code"
          },
          { 
            href: "https://github.com", 
            label: { fr: "GitHub", en: "GitHub" },
            icon: "github"
          },
        ],
      },
      { 
        path: "/contact", 
        label: { fr: "Contact", en: "Contact" },
        icon: "mail"
      },
    ],
    sticky: true,
    utilities: {
      themeSwitch: true,
      langSwitch: true,
      search: false,
      auth: true,
    },
  },
  pages: [
    {
      path: "/",
      title: { fr: "Accueil - SiteForge", en: "Home - SiteForge" },
      seo: {
        title: { fr: "SiteForge - Générateur de Sites JSON", en: "SiteForge - JSON Site Generator" },
        description: { fr: "Créez des sites web magnifiques à partir de simple configurations JSON. Rapide, moderne et entièrement personnalisable.", en: "Create beautiful websites from simple JSON configurations. Fast, modern and fully customizable." },
        ogImage: "https://images.pexels.com/photos/17171481/pexels-photo-17171481/free-photo-of-abstract-blue-and-purple-gradient-background.jpeg?auto=compress&cs=tinysrgb&w=1200&h=630&dpr=2",
      },
      layout: "default",
      sections: [
        {
          type: "hero",
          id: "hero",
          props: {
            headline: { 
              fr: "Créez des Sites Web Magnifiques avec JSON", 
              en: "Create Beautiful Websites with JSON" 
            },
            subhead: { 
              fr: "SiteForge transforme vos configurations JSON en sites web modernes, responsive et optimisés. Aucun code requis.", 
              en: "SiteForge transforms your JSON configurations into modern, responsive and optimized websites. No coding required." 
            },
            backgroundImage: "https://images.pexels.com/photos/17171481/pexels-photo-17171481/free-photo-of-abstract-blue-and-purple-gradient-background.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&dpr=2",
            overlay: true,
            align: "center",
            cta: [
              { 
                label: { fr: "Commencer Gratuitement", en: "Start Free" }, 
                href: "#features",
                variant: "default"
              },
              { 
                label: { fr: "Voir la Démo", en: "View Demo" }, 
                href: "#demo",
                variant: "secondary"
              },
            ],
            scrollTo: "#features",
          },
        },
        {
          type: "cards",
          id: "features",
          props: {
            columns: 3,
            layout: "grid",
            items: [
              {
                icon: "zap",
                title: { fr: "Ultra Rapide", en: "Lightning Fast" },
                text: { fr: "Génération instantanée de sites avec HMR et optimisations automatiques", en: "Instant site generation with HMR and automatic optimizations" },
              },
              {
                icon: "palette",
                title: { fr: "Design Moderne", en: "Modern Design" },
                text: { fr: "Composants UI modernes avec thèmes sombre/clair et animations fluides", en: "Modern UI components with dark/light themes and smooth animations" },
              },
              {
                icon: "smartphone",
                title: { fr: "Responsive", en: "Responsive" },
                text: { fr: "Design adaptatif qui fonctionne parfaitement sur tous les appareils", en: "Adaptive design that works perfectly on all devices" },
              },
              {
                icon: "globe",
                title: { fr: "Multi-langue", en: "Multi-language" },
                text: { fr: "Support natif pour plusieurs langues avec basculement automatique", en: "Native support for multiple languages with automatic switching" },
              },
              {
                icon: "shield",
                title: { fr: "Sécurisé", en: "Secure" },
                text: { fr: "Validation de schéma et protection contre les erreurs de configuration", en: "Schema validation and protection against configuration errors" },
              },
              {
                icon: "puzzle",
                title: { fr: "Extensible", en: "Extensible" },
                text: { fr: "Architecture modulaire permettant l'ajout facile de nouveaux composants", en: "Modular architecture allowing easy addition of new components" },
              },
            ],
          },
        },
        {
          type: "stats",
          id: "stats",
          props: {
            items: [
              {
                value: "10,000+",
                label: { fr: "Sites créés", en: "Sites created" },
                description: { fr: "Sites web générés avec succès", en: "Websites successfully generated" },
                icon: "globe"
              },
              {
                value: "99.9%",
                label: { fr: "Disponibilité", en: "Uptime" },
                description: { fr: "Garantie de service", en: "Service guarantee" },
                icon: "shield"
              },
              {
                value: "50ms",
                label: { fr: "Temps de réponse", en: "Response time" },
                description: { fr: "Performance ultra-rapide", en: "Ultra-fast performance" },
                icon: "zap"
              },
              {
                value: "24/7",
                label: { fr: "Support", en: "Support" },
                description: { fr: "Assistance disponible", en: "Available assistance" },
                icon: "headphones"
              }
            ],
            layout: "horizontal",
            animated: true
          }
        },
        {
          type: "logoCloud",
          id: "partners",
          props: {
            title: { fr: "Ils nous font confiance", en: "They trust us" },
            logos: [
              {
                src: "https://images.pexels.com/photos/267350/pexels-photo-267350.jpeg?auto=compress&cs=tinysrgb&w=120&h=60&dpr=2",
                alt: { fr: "Partenaire 1", en: "Partner 1" }
              },
              {
                src: "https://images.pexels.com/photos/267350/pexels-photo-267350.jpeg?auto=compress&cs=tinysrgb&w=120&h=60&dpr=2",
                alt: { fr: "Partenaire 2", en: "Partner 2" }
              },
              {
                src: "https://images.pexels.com/photos/267350/pexels-photo-267350.jpeg?auto=compress&cs=tinysrgb&w=120&h=60&dpr=2",
                alt: { fr: "Partenaire 3", en: "Partner 3" }
              },
              {
                src: "https://images.pexels.com/photos/267350/pexels-photo-267350.jpeg?auto=compress&cs=tinysrgb&w=120&h=60&dpr=2",
                alt: { fr: "Partenaire 4", en: "Partner 4" }
              }
            ],
            grayscale: true,
            animated: false
          }
        },
        {
          type: "testimonials",
          id: "testimonials",
          props: {
            style: "carousel",
            autoplay: true,
            items: [
              {
                quote: { 
                  fr: "SiteForge a révolutionné notre façon de créer des sites web. Plus besoin de développeurs pour les sites simples !", 
                  en: "SiteForge has revolutionized how we create websites. No need for developers for simple sites anymore!" 
                },
                author: { fr: "Marie Dubois", en: "Marie Dubois" },
                role: { fr: "Directrice Marketing", en: "Marketing Director" },
                avatar: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2",
              },
              {
                quote: { 
                  fr: "L'interface est intuitive et les résultats sont professionnels. Je recommande vivement !", 
                  en: "The interface is intuitive and the results are professional. I highly recommend it!" 
                },
                author: { fr: "Thomas Martin", en: "Thomas Martin" },
                role: { fr: "Entrepreneur", en: "Entrepreneur" },
                avatar: "https://images.pexels.com/photos/1300402/pexels-photo-1300402.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2",
              },
              {
                quote: { 
                  fr: "Parfait pour prototyper rapidement et tester des idées. La configuration JSON est géniale !", 
                  en: "Perfect for rapid prototyping and testing ideas. The JSON configuration is brilliant!" 
                },
                author: { fr: "Sarah Johnson", en: "Sarah Johnson" },
                role: { fr: "Designer UX", en: "UX Designer" },
                avatar: "https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2",
              },
            ],
          },
        },
        {
          type: "pricing",
          id: "pricing",
          props: {
            currency: "€",
            highlight: 1,
            plans: [
              {
                name: { fr: "Gratuit", en: "Free" },
                price: "0",
                period: "mois",
                features: [
                  { fr: "1 site web", en: "1 website" },
                  { fr: "Templates de base", en: "Basic templates" },
                  { fr: "Support communautaire", en: "Community support" },
                  { fr: "Hébergement gratuit", en: "Free hosting" },
                ],
                cta: {
                  label: { fr: "Commencer", en: "Get Started" },
                  href: "/signup",
                },
              },
              {
                name: { fr: "Pro", en: "Pro" },
                price: "29",
                period: "mois",
                badge: { fr: "Populaire", en: "Popular" },
                features: [
                  { fr: "Sites illimités", en: "Unlimited websites" },
                  { fr: "Templates premium", en: "Premium templates" },
                  { fr: "Support prioritaire", en: "Priority support" },
                  { fr: "Domaine personnalisé", en: "Custom domain" },
                  { fr: "Analytics avancées", en: "Advanced analytics" },
                ],
                cta: {
                  label: { fr: "Choisir Pro", en: "Choose Pro" },
                  href: "/signup?plan=pro",
                },
              },
              {
                name: { fr: "Entreprise", en: "Enterprise" },
                price: "99",
                period: "mois",
                features: [
                  { fr: "Tout du plan Pro", en: "Everything in Pro" },
                  { fr: "Support dédié", en: "Dedicated support" },
                  { fr: "Intégrations personnalisées", en: "Custom integrations" },
                  { fr: "SLA garantie", en: "SLA guarantee" },
                  { fr: "Formation équipe", en: "Team training" },
                ],
                cta: {
                  label: { fr: "Nous Contacter", en: "Contact Us" },
                  href: "/contact",
                },
              },
            ],
          },
        },
        {
          type: "faq",
          id: "faq",
          props: {
            accordion: true,
            items: [
              {
                q: { fr: "Qu'est-ce que SiteForge ?", en: "What is SiteForge?" },
                a: { fr: "SiteForge est un générateur de sites web qui transforme des configurations JSON en sites web modernes et responsive. Il permet de créer des sites professionnels sans connaissances techniques.", en: "SiteForge is a website generator that transforms JSON configurations into modern and responsive websites. It allows you to create professional sites without technical knowledge." },
              },
              {
                q: { fr: "Ai-je besoin de connaissances techniques ?", en: "Do I need technical knowledge?" },
                a: { fr: "Non ! SiteForge est conçu pour être utilisé par tous, même sans connaissances en programmation. Il suffit de configurer votre site en JSON et SiteForge s'occupe du reste.", en: "No! SiteForge is designed to be used by everyone, even without programming knowledge. Just configure your site in JSON and SiteForge takes care of the rest." },
              },
              {
                q: { fr: "Puis-je personnaliser le design ?", en: "Can I customize the design?" },
                a: { fr: "Absolument ! SiteForge offre de nombreuses options de personnalisation, des thèmes, des couleurs, des typographies et des composants. Vous pouvez créer un site unique qui correspond à votre marque.", en: "Absolutely! SiteForge offers many customization options, themes, colors, typography and components. You can create a unique site that matches your brand." },
              },
              {
                q: { fr: "Le support multi-langue est-il inclus ?", en: "Is multi-language support included?" },
                a: { fr: "Oui ! SiteForge supporte nativement plusieurs langues. Vous pouvez facilement créer des sites multilingues avec basculement automatique selon les préférences de l'utilisateur.", en: "Yes! SiteForge natively supports multiple languages. You can easily create multilingual sites with automatic switching according to user preferences." },
              },
            ],
          },
        },
        {
          type: "cta",
          id: "cta-bottom",
          props: {
            headline: { fr: "Prêt à commencer ?", en: "Ready to get started?" },
            subhead: { fr: "Créez votre premier site en quelques minutes", en: "Create your first site in minutes" },
            backgroundImage: "https://images.pexels.com/photos/17171481/pexels-photo-17171481/free-photo-of-abstract-blue-and-purple-gradient-background.jpeg?auto=compress&cs=tinysrgb&w=1920&h=600&dpr=2",
            buttons: [
              {
                label: { fr: "Commencer gratuitement", en: "Start for free" },
                href: "/register",
                variant: "default"
              },
              {
                label: { fr: "Voir les tarifs", en: "View pricing" },
                href: "/pricing",
                variant: "outline"
              }
            ],
            align: "center"
          }
        },
      ],
    },
    {
      path: "/features",
      title: { fr: "Fonctionnalités - SiteForge", en: "Features - SiteForge" },
      seo: {
        title: { fr: "Fonctionnalités - SiteForge", en: "Features - SiteForge" },
        description: { fr: "Découvrez toutes les fonctionnalités puissantes de SiteForge pour créer des sites web exceptionnels.", en: "Discover all the powerful features of SiteForge to create exceptional websites." },
      },
      layout: "default",
      sections: [
        {
          type: "hero",
          id: "features-hero",
          props: {
            headline: { 
              fr: "Fonctionnalités Puissantes", 
              en: "Powerful Features" 
            },
            subhead: { 
              fr: "Tout ce dont vous avez besoin pour créer des sites web professionnels", 
              en: "Everything you need to create professional websites" 
            },
            align: "center",
          },
        },
        {
          type: "cards",
          id: "features-grid",
          props: {
            columns: 2,
            layout: "grid",
            items: [
              {
                icon: "code",
                title: { fr: "Configuration JSON", en: "JSON Configuration" },
                text: { fr: "Définissez votre site entier avec un simple fichier JSON. Aucun code HTML/CSS requis.", en: "Define your entire site with a simple JSON file. No HTML/CSS code required." },
              },
              {
                icon: "palette",
                title: { fr: "Thèmes Personnalisables", en: "Customizable Themes" },
                text: { fr: "Choisissez parmi de nombreux thèmes ou créez le vôtre avec notre système de design tokens.", en: "Choose from many themes or create your own with our design token system." },
              },
              {
                icon: "smartphone",
                title: { fr: "Design Responsive", en: "Responsive Design" },
                text: { fr: "Tous les sites sont automatiquement optimisés pour mobile, tablette et desktop.", en: "All sites are automatically optimized for mobile, tablet and desktop." },
              },
              {
                icon: "zap",
                title: { fr: "Performance Optimale", en: "Optimal Performance" },
                text: { fr: "Sites ultra-rapides avec lazy loading, optimisation d'images et code splitting.", en: "Ultra-fast sites with lazy loading, image optimization and code splitting." },
              },
              {
                icon: "globe",
                title: { fr: "Internationalisation", en: "Internationalization" },
                text: { fr: "Support natif pour plusieurs langues avec détection automatique de la locale.", en: "Native support for multiple languages with automatic locale detection." },
              },
              {
                icon: "shield",
                title: { fr: "Sécurité Avancée", en: "Advanced Security" },
                text: { fr: "Protection CSRF, validation de schéma et sanitisation automatique du contenu.", en: "CSRF protection, schema validation and automatic content sanitization." },
              },
            ],
          },
        },
      ],
    },
    {
      path: "/pricing",
      title: { fr: "Tarifs - SiteForge", en: "Pricing - SiteForge" },
      seo: {
        title: { fr: "Tarifs - SiteForge", en: "Pricing - SiteForge" },
        description: { fr: "Choisissez le plan qui vous convient. Commencez gratuitement ou optez pour nos plans premium.", en: "Choose the plan that suits you. Start for free or opt for our premium plans." },
      },
      layout: "default",
      sections: [
        {
          type: "hero",
          id: "pricing-hero",
          props: {
            headline: { 
              fr: "Tarifs Simples et Transparents", 
              en: "Simple and Transparent Pricing" 
            },
            subhead: { 
              fr: "Commencez gratuitement, évoluez selon vos besoins", 
              en: "Start free, scale as you grow" 
            },
            align: "center",
          },
        },
        {
          type: "pricing",
          id: "pricing-plans",
          props: {
            currency: "€",
            highlight: 1,
            plans: [
              {
                name: { fr: "Gratuit", en: "Free" },
                price: "0",
                period: "mois",
                features: [
                  { fr: "1 site web", en: "1 website" },
                  { fr: "Templates de base", en: "Basic templates" },
                  { fr: "Support communautaire", en: "Community support" },
                  { fr: "Hébergement gratuit", en: "Free hosting" },
                  { fr: "SSL inclus", en: "SSL included" },
                ],
                cta: {
                  label: { fr: "Commencer", en: "Get Started" },
                  href: "/signup",
                },
              },
              {
                name: { fr: "Pro", en: "Pro" },
                price: "29",
                period: "mois",
                badge: { fr: "Populaire", en: "Popular" },
                features: [
                  { fr: "Sites illimités", en: "Unlimited websites" },
                  { fr: "Templates premium", en: "Premium templates" },
                  { fr: "Support prioritaire", en: "Priority support" },
                  { fr: "Domaine personnalisé", en: "Custom domain" },
                  { fr: "Analytics avancées", en: "Advanced analytics" },
                  { fr: "Intégrations API", en: "API integrations" },
                  { fr: "Sauvegarde automatique", en: "Automatic backup" },
                ],
                cta: {
                  label: { fr: "Choisir Pro", en: "Choose Pro" },
                  href: "/signup?plan=pro",
                },
              },
              {
                name: { fr: "Entreprise", en: "Enterprise" },
                price: "99",
                period: "mois",
                features: [
                  { fr: "Tout du plan Pro", en: "Everything in Pro" },
                  { fr: "Support dédié", en: "Dedicated support" },
                  { fr: "Intégrations personnalisées", en: "Custom integrations" },
                  { fr: "SLA garantie", en: "SLA guarantee" },
                  { fr: "Formation équipe", en: "Team training" },
                  { fr: "Audit de sécurité", en: "Security audit" },
                  { fr: "Déploiement on-premise", en: "On-premise deployment" },
                ],
                cta: {
                  label: { fr: "Nous Contacter", en: "Contact Us" },
                  href: "/contact",
                },
              },
            ],
          },
        },
        {
          type: "faq",
          id: "pricing-faq",
          props: {
            accordion: true,
            items: [
              {
                q: { fr: "Puis-je changer de plan à tout moment ?", en: "Can I change plans anytime?" },
                a: { fr: "Oui, vous pouvez upgrader ou downgrader votre plan à tout moment. Les changements prennent effet immédiatement.", en: "Yes, you can upgrade or downgrade your plan anytime. Changes take effect immediately." },
              },
              {
                q: { fr: "Y a-t-il des frais cachés ?", en: "Are there any hidden fees?" },
                a: { fr: "Non, nos tarifs sont transparents. Le prix affiché est le prix que vous payez, sans frais cachés.", en: "No, our pricing is transparent. The displayed price is what you pay, with no hidden fees." },
              },
              {
                q: { fr: "Puis-je annuler à tout moment ?", en: "Can I cancel anytime?" },
                a: { fr: "Oui, vous pouvez annuler votre abonnement à tout moment. Aucun engagement à long terme.", en: "Yes, you can cancel your subscription anytime. No long-term commitment." },
              },
            ],
          },
        },
      ],
    },
    {
      path: "/contact",
      title: { fr: "Contact - SiteForge", en: "Contact - SiteForge" },
      seo: {
        title: { fr: "Contact - SiteForge", en: "Contact - SiteForge" },
        description: { fr: "Contactez notre équipe pour toute question ou demande de support.", en: "Contact our team for any questions or support requests." },
      },
      layout: "default",
      sections: [
        {
          type: "hero",
          id: "contact-hero",
          props: {
            headline: { 
              fr: "Contactez-Nous", 
              en: "Contact Us" 
            },
            subhead: { 
              fr: "Notre équipe est là pour vous aider", 
              en: "Our team is here to help you" 
            },
            align: "center",
          },
        },
        {
          type: "contactForm",
          id: "contact-form",
          props: {
            fields: [
              {
                name: "name",
                label: { fr: "Nom complet", en: "Full name" },
                type: "text",
                required: true,
                placeholder: { fr: "Votre nom", en: "Your name" }
              },
              {
                name: "email",
                label: { fr: "Adresse e-mail", en: "Email address" },
                type: "email",
                required: true,
                placeholder: { fr: "votre@email.com", en: "your@email.com" },
                validation: "email"
              },
              {
                name: "subject",
                label: { fr: "Sujet", en: "Subject" },
                type: "select",
                required: true,
                options: [
                  { fr: "Question générale", en: "General question" },
                  { fr: "Support technique", en: "Technical support" },
                  { fr: "Demande commerciale", en: "Sales inquiry" },
                  { fr: "Partenariat", en: "Partnership" }
                ]
              },
              {
                name: "message",
                label: { fr: "Message", en: "Message" },
                type: "textarea",
                required: true,
                placeholder: { fr: "Décrivez votre demande...", en: "Describe your request..." }
              },
              {
                name: "newsletter",
                label: { fr: "Je souhaite recevoir la newsletter", en: "I want to receive the newsletter" },
                type: "checkbox"
              }
            ],
            submitLabel: { fr: "Envoyer le message", en: "Send message" },
            action: "/api/contact",
            method: "POST",
            successMessage: { fr: "Votre message a été envoyé avec succès !", en: "Your message has been sent successfully!" },
            errorMessage: { fr: "Une erreur est survenue lors de l'envoi", en: "An error occurred while sending" }
          }
        },
        {
          type: "cards",
          id: "contact-info",
          props: {
            columns: 3,
            layout: "grid",
            items: [
              {
                icon: "mail",
                title: { fr: "Email", en: "Email" },
                text: { fr: "support@siteforge.com\nRéponse sous 24h", en: "support@siteforge.com\nResponse within 24h" },
              },
              {
                icon: "phone",
                title: { fr: "Téléphone", en: "Phone" },
                text: { fr: "+33 1 23 45 67 89\nLun-Ven 9h-18h", en: "+33 1 23 45 67 89\nMon-Fri 9am-6pm" },
              },
              {
                icon: "messageCircle",
                title: { fr: "Chat", en: "Chat" },
                text: { fr: "Chat en direct disponible\n24h/24 7j/7", en: "Live chat available\n24/7" },
              },
            ],
          },
        },
      ],
    },
    {
      path: "/blog",
      title: { fr: "Blog - SiteForge", en: "Blog - SiteForge" },
      seo: {
        title: { fr: "Blog - SiteForge", en: "Blog - SiteForge" },
        description: { fr: "Découvrez nos derniers articles et conseils", en: "Discover our latest articles and tips" },
      },
      layout: "default",
      sections: [
        {
          type: "hero",
          id: "blog-hero",
          props: {
            headline: { 
              fr: "Notre Blog", 
              en: "Our Blog" 
            },
            subhead: { 
              fr: "Conseils, actualités et guides pour créer des sites exceptionnels", 
              en: "Tips, news and guides to create exceptional websites" 
            },
            align: "center",
          },
        },
        {
          type: "blogList",
          id: "blog-posts",
          props: {
            posts: [
              {
                id: "1",
                title: { fr: "Comment créer un site web moderne en 2025", en: "How to create a modern website in 2025" },
                excerpt: { fr: "Découvrez les dernières tendances et meilleures pratiques pour créer des sites web qui se démarquent.", en: "Discover the latest trends and best practices for creating websites that stand out." },
                slug: "site-web-moderne-2025",
                publishedAt: "2025-01-15",
                author: {
                  name: { fr: "Marie Dubois", en: "Marie Dubois" },
                  avatar: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2"
                },
                featuredImage: "https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&dpr=2",
                tags: [
                  { fr: "Web Design", en: "Web Design" },
                  { fr: "Tendances", en: "Trends" }
                ],
                readTime: 8
              },
              {
                id: "2",
                title: { fr: "Optimiser les performances de votre site", en: "Optimize your website performance" },
                excerpt: { fr: "Techniques avancées pour améliorer la vitesse et l'expérience utilisateur de votre site web.", en: "Advanced techniques to improve the speed and user experience of your website." },
                slug: "optimiser-performances-site",
                publishedAt: "2025-01-10",
                author: {
                  name: { fr: "Thomas Martin", en: "Thomas Martin" },
                  avatar: "https://images.pexels.com/photos/1300402/pexels-photo-1300402.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2"
                },
                featuredImage: "https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&dpr=2",
                tags: [
                  { fr: "Performance", en: "Performance" },
                  { fr: "SEO", en: "SEO" }
                ],
                readTime: 12
              },
              {
                id: "3",
                title: { fr: "Guide complet du responsive design", en: "Complete guide to responsive design" },
                excerpt: { fr: "Tout ce que vous devez savoir pour créer des sites qui s'adaptent parfaitement à tous les écrans.", en: "Everything you need to know to create sites that adapt perfectly to all screens." },
                slug: "guide-responsive-design",
                publishedAt: "2025-01-05",
                author: {
                  name: { fr: "Sarah Johnson", en: "Sarah Johnson" },
                  avatar: "https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2"
                },
                featuredImage: "https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&dpr=2",
                tags: [
                  { fr: "Responsive", en: "Responsive" },
                  { fr: "CSS", en: "CSS" }
                ],
                readTime: 15
              }
            ],
            layout: "grid",
            columns: 3,
            pagination: true,
            postsPerPage: 6
          }
        }
      ],
    },
    {
      path: "/about",
      title: { fr: "À propos - SiteForge", en: "About - SiteForge" },
      seo: {
        title: { fr: "À propos - SiteForge", en: "About - SiteForge" },
        description: { fr: "Découvrez l'équipe et la mission de SiteForge", en: "Discover the team and mission of SiteForge" },
      },
      layout: "default",
      sections: [
        {
          type: "hero",
          id: "about-hero",
          props: {
            headline: { 
              fr: "Notre Mission", 
              en: "Our Mission" 
            },
            subhead: { 
              fr: "Démocratiser la création de sites web pour tous", 
              en: "Democratize website creation for everyone" 
            },
            align: "center",
          },
        },
        {
          type: "team",
          id: "team",
          props: {
            members: [
              {
                name: { fr: "Marie Dubois", en: "Marie Dubois" },
                role: { fr: "CEO & Fondatrice", en: "CEO & Founder" },
                bio: { fr: "Passionnée de technologie et d'innovation, Marie a créé SiteForge pour rendre la création web accessible à tous.", en: "Passionate about technology and innovation, Marie created SiteForge to make web creation accessible to everyone." },
                avatar: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&dpr=2",
                socials: [
                  { platform: "linkedin", url: "https://linkedin.com" },
                  { platform: "twitter", url: "https://twitter.com" }
                ]
              },
              {
                name: { fr: "Thomas Martin", en: "Thomas Martin" },
                role: { fr: "CTO", en: "CTO" },
                bio: { fr: "Expert en développement web avec plus de 10 ans d'expérience dans les technologies modernes.", en: "Web development expert with over 10 years of experience in modern technologies." },
                avatar: "https://images.pexels.com/photos/1300402/pexels-photo-1300402.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&dpr=2",
                socials: [
                  { platform: "github", url: "https://github.com" },
                  { platform: "linkedin", url: "https://linkedin.com" }
                ]
              },
              {
                name: { fr: "Sarah Johnson", en: "Sarah Johnson" },
                role: { fr: "Head of Design", en: "Head of Design" },
                bio: { fr: "Designer UX/UI créative, Sarah s'assure que chaque site créé avec SiteForge offre une expérience exceptionnelle.", en: "Creative UX/UI designer, Sarah ensures that every site created with SiteForge offers an exceptional experience." },
                avatar: "https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&dpr=2",
                socials: [
                  { platform: "instagram", url: "https://instagram.com" },
                  { platform: "linkedin", url: "https://linkedin.com" }
                ]
              }
            ],
            layout: "grid",
            columns: 3
          }
        },
        {
          type: "timeline",
          id: "timeline",
          props: {
            events: [
              {
                date: "2023-01-01",
                title: { fr: "Création de SiteForge", en: "SiteForge Creation" },
                text: { fr: "Lancement de l'idée et début du développement de la plateforme.", en: "Launch of the idea and start of platform development." }
              },
              {
                date: "2023-06-01",
                title: { fr: "Version Beta", en: "Beta Version" },
                text: { fr: "Sortie de la première version beta avec les fonctionnalités de base.", en: "Release of the first beta version with basic features." }
              },
              {
                date: "2024-01-01",
                title: { fr: "Lancement Public", en: "Public Launch" },
                text: { fr: "Ouverture officielle de SiteForge au grand public.", en: "Official opening of SiteForge to the general public." }
              },
              {
                date: "2024-06-01",
                title: { fr: "10,000 Sites Créés", en: "10,000 Sites Created" },
                text: { fr: "Franchissement du cap des 10,000 sites web créés sur la plateforme.", en: "Milestone of 10,000 websites created on the platform." }
              },
              {
                date: "2025-01-01",
                title: { fr: "Nouvelles Fonctionnalités", en: "New Features" },
                text: { fr: "Ajout de fonctionnalités avancées et amélioration de l'expérience utilisateur.", en: "Addition of advanced features and improvement of user experience." }
              }
            ],
            alternating: true
          }
        }
      ],
    },
    {
      path: "/login",
      title: { fr: "Connexion - SiteForge", en: "Login - SiteForge" },
      seo: {
        title: { fr: "Connexion - SiteForge", en: "Login - SiteForge" },
        description: { fr: "Connectez-vous à votre compte SiteForge", en: "Login to your SiteForge account" },
      },
      layout: "default",
      sections: [
        {
          type: "loginForm",
          id: "login-form",
          props: {}
        }
      ],
    },
    {
      path: "/register",
      title: { fr: "Inscription - SiteForge", en: "Register - SiteForge" },
      seo: {
        title: { fr: "Inscription - SiteForge", en: "Register - SiteForge" },
        description: { fr: "Créez votre compte SiteForge gratuitement", en: "Create your free SiteForge account" },
      },
      layout: "default",
      sections: [
        {
          type: "registerForm",
          id: "register-form",
          props: {}
        }
      ],
    },
    {
      path: "/recover-password",
      title: { fr: "Récupération de mot de passe - SiteForge", en: "Password Recovery - SiteForge" },
      seo: {
        title: { fr: "Récupération de mot de passe - SiteForge", en: "Password Recovery - SiteForge" },
        description: { fr: "Récupérez l'accès à votre compte SiteForge", en: "Recover access to your SiteForge account" },
      },
      layout: "default",
      sections: [
        {
          type: "recoverPasswordForm",
          id: "recover-password-form",
          props: {}
        }
      ],
    },
    {
      path: "/profile",
      title: { fr: "Profil - SiteForge", en: "Profile - SiteForge" },
      seo: {
        title: { fr: "Profil - SiteForge", en: "Profile - SiteForge" },
        description: { fr: "Gérez votre profil SiteForge", en: "Manage your SiteForge profile" },
      },
      layout: "default",
      sections: [
        {
          type: "hero",
          id: "profile-hero",
          props: {
            headline: { 
              fr: "Mon Profil", 
              en: "My Profile" 
            },
            subhead: { 
              fr: "Gérez vos informations personnelles", 
              en: "Manage your personal information" 
            },
            align: "center",
          },
        },
      ],
    },
  ],
  footer: {
    columns: [
      {
        title: { fr: "Produit", en: "Product" },
        links: [
          { href: "/features", label: { fr: "Fonctionnalités", en: "Features" } },
          { href: "/pricing", label: { fr: "Tarifs", en: "Pricing" } },
          { href: "/templates", label: { fr: "Templates", en: "Templates" } },
          { href: "/integrations", label: { fr: "Intégrations", en: "Integrations" } },
        ],
      },
      {
        title: { fr: "Ressources", en: "Resources" },
        links: [
          { href: "/docs", label: { fr: "Documentation", en: "Documentation" } },
          { href: "/examples", label: { fr: "Exemples", en: "Examples" } },
          { href: "/blog", label: { fr: "Blog", en: "Blog" } },
          { href: "/changelog", label: { fr: "Changelog", en: "Changelog" } },
        ],
      },
      {
        title: { fr: "Support", en: "Support" },
        links: [
          { href: "/help", label: { fr: "Centre d'aide", en: "Help Center" } },
          { href: "/contact", label: { fr: "Contact", en: "Contact" } },
          { href: "/status", label: { fr: "Statut", en: "Status" } },
          { href: "/community", label: { fr: "Communauté", en: "Community" } },
        ],
      },
      {
        title: { fr: "Légal", en: "Legal" },
        links: [
          { href: "/privacy", label: { fr: "Confidentialité", en: "Privacy" } },
          { href: "/terms", label: { fr: "Conditions", en: "Terms" } },
          { href: "/cookies", label: { fr: "Cookies", en: "Cookies" } },
          { href: "/security", label: { fr: "Sécurité", en: "Security" } },
        ],
      },
    ],
    socials: [
      { platform: "github", url: "https://github.com" },
      { platform: "twitter", url: "https://twitter.com" },
      { platform: "linkedin", url: "https://linkedin.com" },
    ],
    newsletter: {
      type: "newsletter",
      props: {
        headline: { fr: "Restez Informé", en: "Stay Updated" },
        subhead: { fr: "Recevez les dernières nouvelles et mises à jour de SiteForge", en: "Get the latest news and updates from SiteForge" },
        formAction: "/api/newsletter",
        emailPlaceholder: { fr: "Votre email...", en: "Your email..." },
        submitLabel: { fr: "S'abonner", en: "Subscribe" },
        successMessage: { fr: "Merci pour votre inscription !", en: "Thank you for subscribing!" },
      },
    },
    copyright: { fr: "© 2025 SiteForge. Tous droits réservés.", en: "© 2025 SiteForge. All rights reserved." },
  },
  integrations: {
    analytics: { provider: "ga4", id: "G-XXXXXXX" },
  },
  features: [
    { key: "betaFeatures", enabled: false },
    { key: "darkMode", enabled: true },
  ],
};