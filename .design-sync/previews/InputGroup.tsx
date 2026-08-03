import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
  Label,
} from "site-forge";
import { Euro, Mail, Search, Send } from "lucide-react";

// Champs composés (addons, boutons, préfixes) — annuaire et messagerie
// d'un réseau associatif local.

export const Recherche = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="ig-search">Rechercher une association</Label>
    <InputGroup>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput id="ig-search" placeholder="Nom, ville, activité…" />
      <InputGroupAddon align="inline-end">
        <kbd className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">⌘K</kbd>
      </InputGroupAddon>
    </InputGroup>
  </div>
);

export const AvecBouton = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="ig-news">Lettre d'information du quartier</Label>
    <InputGroup>
      <InputGroupAddon>
        <Mail />
      </InputGroupAddon>
      <InputGroupInput id="ig-news" type="email" defaultValue="camille.robert@exemple.fr" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="sm" variant="secondary">
          S'abonner
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  </div>
);

export const PrefixeSuffixe = () => (
  <div className="max-w-sm space-y-4">
    <div className="space-y-2">
      <Label htmlFor="ig-site">Site de l'association</Label>
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput id="ig-site" defaultValue="lestilleuls-nantes" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>.fr</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
    <div className="space-y-2">
      <Label htmlFor="ig-cotis">Cotisation annuelle</Label>
      <InputGroup>
        <InputGroupInput id="ig-cotis" type="number" defaultValue={15} />
        <InputGroupAddon align="inline-end">
          <Euro />
        </InputGroupAddon>
      </InputGroup>
    </div>
  </div>
);

export const ZoneDeTexte = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="ig-msg">Message à l'équipe d'animation</Label>
    <InputGroup>
      <InputGroupTextarea
        id="ig-msg"
        defaultValue="Bonjour, ma fille souhaite rejoindre l'atelier théâtre du mercredi. Reste-t-il des places pour ce trimestre ?"
      />
      <InputGroupAddon align="block-end" className="border-t justify-between">
        <InputGroupText>128 caractères</InputGroupText>
        <InputGroupButton size="sm" variant="default">
          <Send /> Envoyer
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  </div>
);

export const Erreur = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="ig-err">Adresse e-mail</Label>
    <InputGroup>
      <InputGroupAddon>
        <Mail />
      </InputGroupAddon>
      <InputGroupInput id="ig-err" type="email" defaultValue="camille.robert@" aria-invalid />
    </InputGroup>
    <p className="text-destructive text-sm">Cette adresse e-mail est invalide.</p>
  </div>
);
