import { MarkdownSection } from "site-forge";

// Le conteneur `prose` du composant n'a pas le plugin typography : comme dans
// les configs réelles (page /showcase), on mêle HTML classé et markdown pour
// garder une hiérarchie lisible.
export const EditoReseau = () => (
  <MarkdownSection
    props={{
      sourceType: "inline",
      md: [
        '<h2 class="text-3xl font-bold mb-4">Un réseau au service des familles</h2>',
        "",
        "Depuis 2009, le réseau fédère **74 structures signataires** de la charte : centres sociaux, associations de parents, communes et institutions. Ensemble, elles animent des groupes de parole, des ateliers parents-enfants et des temps festifs sur l'ensemble du département.",
        "",
        '<ul class="list-disc pl-6 space-y-2 my-4">',
        "<li>10 territoires couverts, de la côte au bassin minier</li>",
        "<li>Plus de 300 actions organisées chaque année</li>",
        "<li>Des rencontres ouvertes et gratuites pour toutes les familles</li>",
        "</ul>",
        "",
        '<blockquote class="border-l-4 border-primary pl-4 italic text-muted-foreground my-6">« Être parent, ça ne s\'apprend pas dans les livres — ça se partage. »</blockquote>',
        "",
        "Envie de rejoindre la dynamique ? Contactez la coordination de votre territoire.",
      ].join("\n"),
    }}
  />
);

// Note courte : titres intermédiaires + lien stylé.
export const NotePratique = () => (
  <MarkdownSection
    props={{
      sourceType: "inline",
      md: [
        '<h3 class="text-2xl font-bold mb-3">Préparer sa première rencontre</h3>',
        "",
        "Les rencontres se tiennent le **premier mardi du mois**, de 18 h à 20 h, dans les locaux du centre social de votre commune. Aucune inscription n'est nécessaire — venez comme vous êtes, avec ou sans les enfants.",
        "",
        '<h4 class="text-lg font-semibold mt-6 mb-2">À apporter</h4>',
        "",
        '<ul class="list-disc pl-6 space-y-1">',
        "<li>Vos questions et vos idées d'ateliers</li>",
        "<li>Un plat à partager pour le buffet, si le cœur vous en dit</li>",
        "</ul>",
        "",
        '<p class="mt-6">Le programme complet est disponible sur <a class="text-primary underline" href="/agenda">la page agenda</a>.</p>',
      ].join("\n"),
    }}
  />
);
