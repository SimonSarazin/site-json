import { Spinner, Button } from "site-forge";

// Tailles : défaut (h-4), moyenne et grande via className.
export const Tailles = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
    <Spinner />
    <Spinner className="h-6 w-6" />
    <Spinner className="h-8 w-8" />
  </div>
);

// Avec libellé visible : chargement d'une liste.
export const AvecTexte = () => (
  <div className="text-sm text-muted-foreground" style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <Spinner label="Chargement des ateliers" />
    <span>Chargement des ateliers…</span>
  </div>
);

// Dans un bouton d'envoi (état soumission de formulaire).
export const DansUnBouton = () => (
  <div style={{ display: "flex", gap: 12 }}>
    <Button disabled>
      <Spinner className="h-4 w-4" label="Envoi en cours" />
      Envoi en cours…
    </Button>
    <Button variant="outline" disabled>
      <Spinner className="h-4 w-4" label="Recherche" />
      Recherche…
    </Button>
  </div>
);
