import { SocialLinks } from "site-forge";

// Rangée de liens sociaux partagée par les footers. Style par défaut =
// icônes-boutons ghost ; variante pastilles rondes = classes réellement
// utilisées par FooterSidebarColumns (présentes dans le CSS compilé).
export const ParDefaut = () => (
  <div style={{ padding: 16 }}>
    <SocialLinks
      socials={[
        { platform: "facebook", url: "https://facebook.com/parents62" },
        { platform: "instagram", url: "https://instagram.com/parents62" },
        { platform: "linkedin", url: "https://linkedin.com/company/parents62" },
        { platform: "youtube", url: "https://youtube.com/@parents62" },
        { platform: "mail", url: "mailto:contact@parents62.fr" },
      ]}
    />
  </div>
);

export const PastillesRondes = () => (
  <div style={{ padding: 16 }}>
    <SocialLinks
      socials={[
        { platform: "facebook", url: "https://facebook.com/rezolamer" },
        { platform: "twitter", url: "https://x.com/rezolamer" },
        { platform: "github", url: "https://github.com/rezolamer" },
      ]}
      className="gap-3"
      itemClassName="p-2 rounded-full bg-secondary/30 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
      iconClassName="w-5 h-5"
    />
  </div>
);

export const PlateformeInconnue = () => (
  <div style={{ padding: 16 }}>
    {/* "website" et toute plateforme hors map → icône Globe de repli. */}
    <SocialLinks
      socials={[
        { platform: "website", url: "https://rezolamer.fr" },
        { platform: "mastodon", url: "https://mastodon.social/@rezolamer" },
        { platform: "facebook", url: "https://facebook.com/rezolamer" },
      ]}
    />
  </div>
);
