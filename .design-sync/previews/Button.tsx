import { Button } from "site-forge";

export const Variants = () => (
  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
    <Button>Enregistrer</Button>
    <Button variant="secondary">Annuler</Button>
    <Button variant="outline">En savoir plus</Button>
    <Button variant="ghost">Ignorer</Button>
    <Button variant="destructive">Supprimer</Button>
    <Button variant="link">Voir le détail</Button>
  </div>
);

export const Tailles = () => (
  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
    <Button size="sm">Petit</Button>
    <Button size="default">Normal</Button>
    <Button size="lg">Grand</Button>
  </div>
);

export const Etats = () => (
  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
    <Button disabled>Désactivé</Button>
    <Button variant="outline" disabled>Désactivé (outline)</Button>
  </div>
);
