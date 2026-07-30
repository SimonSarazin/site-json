import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "site-forge";

const FondPage = () => (
  <div style={{ minHeight: 520, padding: 32 }}>
    <h2 className="text-xl font-semibold">Fête des possibles</h2>
    <p className="text-muted-foreground mt-2 max-w-md text-sm">
      Samedi 20 septembre · Place de la mairie · Village associatif,
      concerts et ateliers ouverts à toutes et tous.
    </p>
  </div>
);

export const ActionsEvenement = () => (
  <>
    <FondPage />
    <Drawer open>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Fête des possibles</DrawerTitle>
          <DrawerDescription>
            Samedi 20 septembre, 10 h – 18 h · Place de la mairie
          </DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-2 px-4">
          <Button>S&apos;inscrire à l&apos;événement</Button>
          <Button variant="outline">Ajouter à mon agenda</Button>
          <Button variant="outline">Partager</Button>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="ghost">Fermer</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  </>
);

export const PanneauLateral = () => (
  <>
    <FondPage />
    <Drawer open direction="right">
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Programme de la journée</DrawerTitle>
          <DrawerDescription>3 temps forts à ne pas manquer</DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-3 px-4 text-sm">
          <div className="rounded-md border p-3">
            <p className="font-medium">10 h — Ouverture du village</p>
            <p className="text-muted-foreground">Stands des 24 associations</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-medium">14 h — Atelier réparation vélo</p>
            <p className="text-muted-foreground">Avec la Ressourcerie</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-medium">17 h — Concert de clôture</p>
            <p className="text-muted-foreground">Fanfare du quartier</p>
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Fermer</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  </>
);
