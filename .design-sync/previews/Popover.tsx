import {
  Button,
  Checkbox,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "site-forge";

export const PartagerLien = () => (
  <div style={{ padding: 32, minHeight: 300 }}>
    <Popover open>
      <PopoverTrigger asChild>
        <Button variant="outline">Partager la fiche</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="grid gap-3">
          <div className="space-y-1">
            <h4 className="font-medium leading-none">Lien de partage</h4>
            <p className="text-muted-foreground text-sm">
              Toute personne avec ce lien peut voir la fiche.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input readOnly value="https://tierslieux.re/profil/la-fabrique" />
            <Button size="sm" className="shrink-0">
              Copier
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
);

export const FiltreThematiques = () => (
  <div style={{ padding: 32, minHeight: 340 }}>
    <Popover open>
      <PopoverTrigger asChild>
        <Button variant="outline">Thématiques (2)</Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="grid gap-3">
          <p className="text-sm font-medium">Filtrer par thématique</p>
          <div className="flex items-center gap-2">
            <Checkbox id="pop-alim" defaultChecked />
            <Label htmlFor="pop-alim">Alimentation durable</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="pop-mob" defaultChecked />
            <Label htmlFor="pop-mob">Mobilité douce</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="pop-num" />
            <Label htmlFor="pop-num">Inclusion numérique</Label>
          </div>
          <Button size="sm" variant="ghost" className="justify-start px-0">
            Réinitialiser
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  </div>
);
