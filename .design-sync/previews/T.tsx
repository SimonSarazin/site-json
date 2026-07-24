import { T } from "site-forge";

// Texte localisé : k accepte un LocalizedString ({fr: …}, résolu par la locale
// du LocalizationProvider — fr dans le DsProvider) ou une clé i18next string
// (fallback affiché quand la clé est absente des bundles).

export const ContenuLocalise = () => (
  <div className="max-w-lg space-y-2">
    <T
      k={{ fr: "Bienvenue sur le réseau parentalité" }}
      as="h2"
      className="text-2xl font-semibold tracking-tight"
    />
    <T
      k={{ fr: "Trouvez les ateliers, permanences et lieux d'accueil près de chez vous." }}
      as="p"
      className="text-muted-foreground"
    />
  </div>
);

export const BalisesEtStyles = () => (
  <div className="max-w-lg space-y-3">
    <T k={{ fr: "Prochain café des parents" }} as="h3" className="text-lg font-medium" />
    <p className="text-sm">
      <T k={{ fr: "Samedi 18 juillet à 10 h — " }} />
      <T k={{ fr: "Maison de la Petite Enfance, Perpignan" }} as="strong" className="font-semibold" />
    </p>
    <T
      k={{ fr: "Entrée libre, sans inscription." }}
      as="small"
      className="block text-xs text-muted-foreground"
    />
    <T
      k={{ fr: "38 familles déjà inscrites cette saison" }}
      as="div"
      className="w-fit rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground"
    />
  </div>
);

export const CleAvecFallback = () => (
  <div className="max-w-lg space-y-1">
    <T
      k="pages.accueil.titreIntrouvable"
      fallback="Texte de repli affiché quand la clé i18next est absente"
      as="p"
      className="text-sm"
    />
    <p className="font-mono text-xs text-muted-foreground">
      k="pages.accueil.titreIntrouvable" + fallback
    </p>
  </div>
);
