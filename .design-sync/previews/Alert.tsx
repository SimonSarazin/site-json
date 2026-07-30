import { Alert, AlertTitle, AlertDescription } from "site-forge";

// Alerte informative avec icône (grille has-[>svg]).
export const Information = () => (
  <div style={{ maxWidth: 480 }}>
    <Alert>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
      <AlertTitle>Inscription confirmée</AlertTitle>
      <AlertDescription>
        <p>
          Votre place à l'atelier « Cuisine et petits budgets » du samedi 21 mars
          est réservée. Un courriel de rappel vous sera envoyé la veille.
        </p>
      </AlertDescription>
    </Alert>
  </div>
);

// Variante destructive : erreur bloquante.
export const Erreur = () => (
  <div style={{ maxWidth: 480 }}>
    <Alert variant="destructive">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <AlertTitle>Impossible d'enregistrer la structure</AlertTitle>
      <AlertDescription>
        <p>
          L'adresse renseignée n'a pas pu être géolocalisée. Vérifiez le code
          postal (62xxx) puis réessayez.
        </p>
      </AlertDescription>
    </Alert>
  </div>
);

// Sans icône : la colonne icône se replie (grid-cols-[0_1fr]).
export const SansIcone = () => (
  <div style={{ maxWidth: 480 }}>
    <Alert>
      <AlertTitle>Maintenance prévue</AlertTitle>
      <AlertDescription>
        <p>
          L'annuaire sera indisponible dimanche 22 mars de 6h à 8h pour une mise
          à jour des données cartographiques.
        </p>
      </AlertDescription>
    </Alert>
  </div>
);
