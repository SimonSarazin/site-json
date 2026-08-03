import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Badge,
  Button,
} from "site-forge";

// Fiche annuaire : un tiers-lieu du réseau, avec action dans l'en-tête.
export const FicheTiersLieu = () => (
  <Card style={{ maxWidth: 420 }}>
    <CardHeader>
      <CardTitle>La Fabrique du Marais</CardTitle>
      <CardDescription>Tiers-lieu numérique — Saint-Omer</CardDescription>
      <CardAction>
        <Badge variant="secondary">Ouvert</Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p className="text-sm">
        Espace de coworking, fablab et café associatif. Accueil des porteurs de
        projets du Pays de Saint-Omer, ateliers d'initiation au numérique tous
        les mercredis.
      </p>
    </CardContent>
    <CardFooter style={{ gap: 8 }}>
      <Button size="sm">Voir la fiche</Button>
      <Button size="sm" variant="outline">
        Itinéraire
      </Button>
    </CardFooter>
  </Card>
);

// Carte compacte : en-tête + contenu seulement (résumé d'atelier).
export const CarteSimple = () => (
  <Card style={{ maxWidth: 380 }}>
    <CardHeader>
      <CardTitle>Atelier « Parents d'ados »</CardTitle>
      <CardDescription>Jeudi 12 mars · 18h30 · Maison des parents, Arras</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Un temps d'échange animé par une médiatrice familiale autour des écrans
        et du dialogue au quotidien. Gratuit, sur inscription.
      </p>
    </CardContent>
  </Card>
);

// Carte avec pied bordé : récapitulatif d'adhésion au réseau.
export const AvecPiedBorde = () => (
  <Card style={{ maxWidth: 380 }}>
    <CardHeader className="border-b">
      <CardTitle>Adhésion 2026</CardTitle>
      <CardDescription>Réseau des tiers-lieux du Pas-de-Calais</CardDescription>
    </CardHeader>
    <CardContent>
      <div style={{ display: "flex", justifyContent: "space-between" }} className="text-sm">
        <span className="text-muted-foreground">Cotisation annuelle</span>
        <span className="font-medium">60 €</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }} className="text-sm">
        <span className="text-muted-foreground">Structures adhérentes</span>
        <span className="font-medium">47</span>
      </div>
    </CardContent>
    <CardFooter className="border-t" style={{ justifyContent: "flex-end" }}>
      <Button size="sm">Renouveler l'adhésion</Button>
    </CardFooter>
  </Card>
);
