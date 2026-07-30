import { HTMLSection } from "site-forge";

// Usage réel : blocs HTML classés Tailwind (config sport-sante-bien-etre,
// page /espace-professionnels). Le composant ne pose ni padding ni conteneur.
export const BlocMission = () => (
  <HTMLSection
    props={{
      html:
        '<section class="py-16 px-4"><div class="container mx-auto max-w-4xl space-y-6">' +
        '<span class="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">Notre mission</span>' +
        '<h2 class="text-3xl md:text-4xl font-bold text-foreground">Le Sport Santé Bien-Être à La Réunion</h2>' +
        '<p class="text-lg text-muted-foreground leading-relaxed">La Réunion fait face à des enjeux de santé publique majeurs : <b>diabète, obésité, maladies cardiovasculaires et sédentarité</b> touchent une part importante de la population. Le dispositif Sport Santé Bien-Être mobilise les professionnels du sport et de la santé autour d\'une offre d\'activité physique adaptée, encadrée et accessible à tous.</p>' +
        '<p class="text-muted-foreground leading-relaxed">Le réseau fédère aujourd\'hui <strong class="text-foreground">247 structures</strong>, <strong class="text-foreground">856 professionnels formés</strong> et accompagne plus de 12 500 bénéficiaires chaque année.</p>' +
        "</div></section>",
    }}
  />
);

// Usage réel : encart en dégradé avec styles inline (config.prod.json, /showcase).
export const EncartDegrade = () => (
  <HTMLSection
    props={{
      html: {
        fr:
          '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 3rem; border-radius: 1rem; text-align: center; color: white; margin: 2rem;">' +
          '<h2 style="margin: 0 0 1rem 0; font-size: 2rem; font-weight: 700;">La fête du réseau, le 14 juin</h2>' +
          '<p style="margin: 0; opacity: 0.9;">Ateliers, spectacles et village associatif — une journée gratuite et ouverte à toutes les familles, au parc de la Glissoire à Avion.</p>' +
          '<a href="/agenda" style="display: inline-block; margin-top: 1.25rem; padding: 0.6rem 1.4rem; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); border-radius: 0.5rem; color: white; font-weight: 600;">Voir le programme</a>' +
          "</div>",
      },
    }}
  />
);
