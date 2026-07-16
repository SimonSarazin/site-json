import { Separator } from "site-forge";

// Séparation horizontale entre blocs de texte.
export const Horizontal = () => (
  <div style={{ maxWidth: 380 }}>
    <div>
      <h4 className="text-sm font-medium">Réseau parentalité 62</h4>
      <p className="text-sm text-muted-foreground">
        Coordination départementale des acteurs du soutien à la parentalité.
      </p>
    </div>
    <Separator style={{ marginTop: 16, marginBottom: 16 }} />
    <div>
      <h4 className="text-sm font-medium">Charte des valeurs</h4>
      <p className="text-sm text-muted-foreground">
        Participation, co-éducation et soutien à l'initiative locale.
      </p>
    </div>
  </div>
);

// Séparateurs verticaux dans une ligne de liens (nécessite une hauteur).
export const Vertical = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 16, height: 20 }} className="text-sm">
    <span>Annuaire</span>
    <Separator orientation="vertical" />
    <span>Agenda</span>
    <Separator orientation="vertical" />
    <span>Charte</span>
    <Separator orientation="vertical" />
    <span>Contact</span>
  </div>
);
