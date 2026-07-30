import { Tabs, TabsList, TabsTrigger, TabsContent } from "site-forge";

// Onglets d'une fiche tiers-lieu — onglet actif visible (defaultValue).
export const FicheStructure = () => (
  <Tabs defaultValue="presentation" style={{ maxWidth: 420 }}>
    <TabsList>
      <TabsTrigger value="presentation">Présentation</TabsTrigger>
      <TabsTrigger value="ateliers">Ateliers</TabsTrigger>
      <TabsTrigger value="contact">Contact</TabsTrigger>
    </TabsList>
    <TabsContent value="presentation">
      <p className="text-sm text-muted-foreground" style={{ paddingTop: 8 }}>
        La Fabrique du Marais est un tiers-lieu associatif installé dans une
        ancienne filature de Saint-Omer : coworking, fablab et café des parents,
        ouverts du mardi au samedi.
      </p>
    </TabsContent>
    <TabsContent value="ateliers">
      <p className="text-sm text-muted-foreground" style={{ paddingTop: 8 }}>
        Initiation à l'impression 3D, repair café mensuel, ateliers parentalité.
      </p>
    </TabsContent>
    <TabsContent value="contact">
      <p className="text-sm text-muted-foreground" style={{ paddingTop: 8 }}>
        3 rue des Tanneurs, 62500 Saint-Omer — contact@fabriquedumarais.fr
      </p>
    </TabsContent>
  </Tabs>
);

// Liste pleine largeur (TabsList étirée) + onglet désactivé.
export const PleineLargeur = () => (
  <Tabs defaultValue="agenda" style={{ maxWidth: 420 }}>
    <TabsList style={{ width: "100%" }}>
      <TabsTrigger value="agenda">Agenda</TabsTrigger>
      <TabsTrigger value="annuaire">Annuaire</TabsTrigger>
      <TabsTrigger value="cartographie" disabled>
        Cartographie
      </TabsTrigger>
    </TabsList>
    <TabsContent value="agenda">
      <p className="text-sm text-muted-foreground" style={{ paddingTop: 8 }}>
        Prochain rendez-vous : forum départemental de la parentalité, le
        4 avril 2026 à Lens.
      </p>
    </TabsContent>
    <TabsContent value="annuaire">
      <p className="text-sm text-muted-foreground" style={{ paddingTop: 8 }}>
        47 structures adhérentes recensées.
      </p>
    </TabsContent>
  </Tabs>
);
