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
      auth: false,
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