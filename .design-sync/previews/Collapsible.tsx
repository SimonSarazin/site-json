import { Collapsible, CollapsibleTrigger, CollapsibleContent, Button, Badge } from "site-forge";

// Bloc replié/déplié — état OUVERT (defaultOpen) : filtres avancés de l'annuaire.
export const FiltresAvances = () => (
  <div style={{ maxWidth: 380 }}>
    <Collapsible defaultOpen>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h4 className="text-sm font-medium">Filtres avancés</h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            Réduire
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="m18 15-6-6-6 6" />
            </svg>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
          <div className="rounded-md border text-sm" style={{ padding: "8px 12px" }}>
            Thématique : <span className="font-medium">Parentalité</span>
          </div>
          <div className="rounded-md border text-sm" style={{ padding: "8px 12px" }}>
            Territoire : <span className="font-medium">Communauté d'agglo de Lens-Liévin</span>
          </div>
          <div className="rounded-md border text-sm" style={{ padding: "8px 12px" }}>
            Accessibilité : <span className="font-medium">PMR uniquement</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
);

// État FERMÉ : seul l'en-tête et le déclencheur sont visibles.
export const EtatFerme = () => (
  <div style={{ maxWidth: 380 }}>
    <Collapsible>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h4 className="text-sm font-medium">Anciennes éditions du forum</h4>
          <Badge variant="secondary">8</Badge>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm">
            Afficher
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <p className="text-sm text-muted-foreground" style={{ paddingTop: 8 }}>
          Forums 2018 à 2025 — comptes rendus et photothèques.
        </p>
      </CollapsibleContent>
    </Collapsible>
  </div>
);
