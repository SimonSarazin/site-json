import type { ReactNode } from "react";
import { CookieConsentSection } from "site-forge";

// Bandeau cookies (type "cookieConsent") : overlay `position: fixed` affiché
// après hydratation quand localStorage n'a pas de consentement.
// CAPTURE : `fixed` se positionne sur le viewport → hors du cadre de la
// cellule. Le wrapper `transform` ci-dessous devient le containing block des
// descendants fixed (spec CSS) → le bandeau est capturé DANS la cellule.
function CadreViewport({ children }: { children: ReactNode }) {
  return (
    <div style={{ transform: "translateZ(0)", position: "relative", minHeight: 340 }}>
      {children}
    </div>
  );
}

export const Bandeau = () => (
  <CadreViewport>
    <CookieConsentSection
      props={{
        message: { fr: "Nous utilisons des cookies pour mesurer la fréquentation du site et améliorer votre expérience. Vous pouvez accepter, refuser ou régler vos préférences." },
        acceptLabel: { fr: "Accepter tout" },
        declineLabel: { fr: "Refuser" },
        settingsLabel: { fr: "Paramètres" },
        policyUrl: "/politique-confidentialite",
        position: "bottom",
        categories: [
          { id: "necessaires", label: { fr: "Nécessaires" }, description: { fr: "Indispensables au fonctionnement du site (session, sécurité)." }, required: true },
          { id: "mesure", label: { fr: "Mesure d'audience" }, description: { fr: "Statistiques anonymes de fréquentation des pages." }, required: false },
        ],
      }}
    />
  </CadreViewport>
);

export const EncartDroite = () => (
  <CadreViewport>
    <CookieConsentSection
      props={{
        message: { fr: "Ce site n'utilise que des cookies de mesure d'audience anonymisés." },
        acceptLabel: { fr: "D'accord" },
        declineLabel: { fr: "Non merci" },
        position: "bottom-right",
      }}
    />
  </CadreViewport>
);

// Panneau de préférences dans le flux (`inline: true`) : page « Politique de cookies », toujours
// visible, pour consulter et modifier son choix (droit d'opposition à une mesure exemptée).
export const Panneau = () => (
  <CookieConsentSection
    props={{
      message: { fr: "Vos choix pour ce site. La mesure d'audience sans cookie est active tant que vous ne vous y opposez pas." },
      acceptLabel: { fr: "Tout accepter" },
      position: "bottom",
      inline: true,
      categories: [
        { id: "necessary", label: { fr: "Fonctionnement du site" }, description: { fr: "Session, langue, mode d'affichage et mémorisation de vos choix." }, required: true },
        { id: "analytics", label: { fr: "Mesure d'audience (Matomo, sans cookie)" }, description: { fr: "Statistiques anonymes de fréquentation. IP anonymisée, aucun cookie." }, required: false, defaultOn: true },
      ],
    }}
  />
);
