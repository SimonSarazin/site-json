import { SocialFeedSection } from "site-forge";

// Type "socialFeed" : le composant rend des posts MOCK déterministes (aucun
// appel réseau au flux) — seuls platform/limit/layout pilotent le rendu.
// Les avatars mock pointent vers des URLs cassées → fallback initiale (attendu).

export const Twitter = () => (
  <SocialFeedSection
    props={{
      platform: "twitter",
      feedId: "reseauparent62",
      limit: 3,
      layout: "grid",
    }}
  />
);

export const Facebook = () => (
  <SocialFeedSection
    props={{
      platform: "facebook",
      feedId: "reseauparent62",
      limit: 3,
      layout: "masonry",
    }}
  />
);
