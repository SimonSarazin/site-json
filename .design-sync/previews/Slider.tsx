import { Label, Slider } from "site-forge";

// Curseurs — filtres de recherche d'activités près de chez soi.

export const RayonDeRecherche = () => (
  <div className="max-w-sm space-y-3">
    <div className="flex items-center justify-between">
      <Label htmlFor="sl-rayon">Rayon de recherche</Label>
      <span className="text-muted-foreground text-sm">15 km</span>
    </div>
    <Slider id="sl-rayon" defaultValue={[15]} max={50} step={5} />
  </div>
);

export const PlageDeValeurs = () => (
  <div className="max-w-sm space-y-3">
    <div className="flex items-center justify-between">
      <Label htmlFor="sl-budget">Participation aux frais</Label>
      <span className="text-muted-foreground text-sm">5 € — 25 €</span>
    </div>
    <Slider id="sl-budget" defaultValue={[5, 25]} max={60} step={5} />
    <p className="text-muted-foreground text-sm">Tarif solidaire selon le quotient familial.</p>
  </div>
);

export const PasFin = () => (
  <div className="max-w-sm space-y-3">
    <div className="flex items-center justify-between">
      <Label htmlFor="sl-duree">Durée de l'atelier</Label>
      <span className="text-muted-foreground text-sm">1 h 30</span>
    </div>
    <Slider id="sl-duree" defaultValue={[90]} min={30} max={180} step={15} />
  </div>
);

export const Desactive = () => (
  <div className="max-w-sm space-y-3">
    <div className="flex items-center justify-between">
      <Label htmlFor="sl-places">Places disponibles</Label>
      <span className="text-muted-foreground text-sm">Complet</span>
    </div>
    <Slider id="sl-places" defaultValue={[12]} max={12} disabled />
  </div>
);
