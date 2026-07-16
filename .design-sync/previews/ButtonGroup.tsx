import {
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "site-forge";
import { CalendarDays, ChevronDown, Download, Printer, Share2 } from "lucide-react";

// Le collage des bordures repose sur des enfants avec bordure (variant outline).

export const Horizontal = () => (
  <ButtonGroup>
    <Button variant="outline">Jour</Button>
    <Button variant="outline">Semaine</Button>
    <Button variant="outline">Mois</Button>
  </ButtonGroup>
);

export const AvecLibelleEtSeparateur = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
    <ButtonGroup>
      <ButtonGroupText>
        <CalendarDays />
        Agenda
      </ButtonGroupText>
      <Button variant="outline">Exporter</Button>
      <Button variant="outline" size="icon" aria-label="Plus d'options">
        <ChevronDown />
      </Button>
    </ButtonGroup>
    <ButtonGroup>
      <Button variant="secondary">
        <Share2 />
        Partager
      </Button>
      <ButtonGroupSeparator />
      <Button variant="secondary" size="icon" aria-label="Imprimer">
        <Printer />
      </Button>
      <Button variant="secondary" size="icon" aria-label="Télécharger">
        <Download />
      </Button>
    </ButtonGroup>
  </div>
);

export const Vertical = () => (
  <ButtonGroup orientation="vertical" className="w-44">
    <Button variant="outline">Toutes les structures</Button>
    <Button variant="outline">Associations</Button>
    <Button variant="outline">Lieux d'accueil</Button>
  </ButtonGroup>
);
