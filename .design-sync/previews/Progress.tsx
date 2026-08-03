import { Progress } from "site-forge";

// Plusieurs niveaux de remplissage (piste bg-primary/20, indicateur bg-primary).
export const Valeurs = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 360 }}>
    <div>
      <div className="text-sm text-muted-foreground" style={{ marginBottom: 6 }}>13 %</div>
      <Progress value={13} />
    </div>
    <div>
      <div className="text-sm text-muted-foreground" style={{ marginBottom: 6 }}>45 %</div>
      <Progress value={45} />
    </div>
    <div>
      <div className="text-sm text-muted-foreground" style={{ marginBottom: 6 }}>78 %</div>
      <Progress value={78} />
    </div>
    <div>
      <div className="text-sm text-muted-foreground" style={{ marginBottom: 6 }}>100 %</div>
      <Progress value={100} />
    </div>
  </div>
);

// Usage réel : avancement d'une cagnotte de tiers-lieu, avec libellés.
export const CagnotteEnCours = () => (
  <div style={{ maxWidth: 360 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
      <span className="text-sm font-medium">Rénovation du café des parents</span>
      <span className="text-sm text-muted-foreground">3 420 € / 5 000 €</span>
    </div>
    <Progress value={68} aria-label="Avancement de la cagnotte" />
    <p className="text-sm text-muted-foreground" style={{ marginTop: 6 }}>
      68 % de l'objectif atteint — 42 contributeurs.
    </p>
  </div>
);
