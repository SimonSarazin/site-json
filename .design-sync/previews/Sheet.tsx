import {
  Button,
  Checkbox,
  Label,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "site-forge";

const FondPage = () => (
  <div style={{ minHeight: 520, padding: 32 }}>
    <h2 className="text-xl font-semibold">Annuaire des acteurs</h2>
    <p className="text-muted-foreground mt-2 max-w-md text-sm">
      128 structures référencées sur le territoire — associations,
      tiers-lieux, collectifs citoyens.
    </p>
  </div>
);

export const PanneauFiltres = () => (
  <>
    <FondPage />
    <Sheet open>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Filtrer l&apos;annuaire</SheetTitle>
          <SheetDescription>
            Affinez la liste des structures affichées sur la carte.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 px-4">
          <p className="text-sm font-medium">Type de structure</p>
          <div className="flex items-center gap-2">
            <Checkbox id="f-asso" defaultChecked />
            <Label htmlFor="f-asso">Associations</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="f-tl" defaultChecked />
            <Label htmlFor="f-tl">Tiers-lieux</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="f-collectif" />
            <Label htmlFor="f-collectif">Collectifs citoyens</Label>
          </div>
          <Separator className="my-2" />
          <p className="text-sm font-medium">Thématiques</p>
          <div className="flex items-center gap-2">
            <Checkbox id="f-alim" defaultChecked />
            <Label htmlFor="f-alim">Alimentation durable</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="f-num" />
            <Label htmlFor="f-num">Inclusion numérique</Label>
          </div>
        </div>
        <SheetFooter>
          <Button>Appliquer les filtres</Button>
          <Button variant="ghost">Tout réinitialiser</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  </>
);

export const MenuMobile = () => (
  <>
    <FondPage />
    <Sheet open>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Réseau des Tiers-Lieux</SheetTitle>
          <SheetDescription>Menu de navigation</SheetDescription>
        </SheetHeader>
        <nav className="grid gap-1 px-4 text-sm">
          <a href="#" className="rounded-md px-3 py-2 font-medium bg-muted">
            Accueil
          </a>
          <a href="#" className="rounded-md px-3 py-2">
            Annuaire
          </a>
          <a href="#" className="rounded-md px-3 py-2">
            Agenda
          </a>
          <a href="#" className="rounded-md px-3 py-2">
            Actualités
          </a>
          <a href="#" className="rounded-md px-3 py-2">
            Contact
          </a>
        </nav>
        <SheetFooter>
          <Button>Se connecter</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  </>
);
