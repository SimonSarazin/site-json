import { Label, MultipleSelector } from "site-forge";

// Sélecteur multiple à badges (cmdk) — tags de compétences et publics d'une
// fiche annuaire. La liste déroulante ne s'ouvre qu'au focus (inline, pas de
// portal) : on montre les états fermés — vide, rempli, options fixes,
// désactivé.

export const Vide = () => (
  <div className="max-w-sm space-y-2">
    <Label>Compétences proposées</Label>
    <MultipleSelector
      defaultOptions={[
        { value: "cuisine", label: "Cuisine" },
        { value: "couture", label: "Couture" },
        { value: "informatique", label: "Informatique" },
      ]}
      placeholder="Ajouter une compétence…"
    />
    <p className="text-muted-foreground text-sm">Tapez pour rechercher, Entrée pour ajouter.</p>
  </div>
);

export const AvecSelection = () => (
  <div className="max-w-sm space-y-2">
    <Label>Compétences proposées</Label>
    <MultipleSelector
      value={[
        { value: "jardinage", label: "Jardinage" },
        { value: "bricolage", label: "Bricolage" },
        { value: "informatique", label: "Aide informatique" },
      ]}
      defaultOptions={[
        { value: "cuisine", label: "Cuisine" },
        { value: "couture", label: "Couture" },
      ]}
      placeholder="Ajouter…"
    />
  </div>
);

export const AvecOptionsFixes = () => (
  <div className="max-w-sm space-y-2">
    <Label>Publics accueillis</Label>
    <MultipleSelector
      value={[
        { value: "tous", label: "Tout public", fixed: true },
        { value: "enfants", label: "Enfants" },
        { value: "seniors", label: "Seniors" },
      ]}
      defaultOptions={[
        { value: "ados", label: "Adolescents" },
        { value: "adultes", label: "Adultes" },
      ]}
      placeholder="Ajouter un public…"
    />
    <p className="text-muted-foreground text-sm">« Tout public » est imposé par la charte du réseau.</p>
  </div>
);

export const Desactive = () => (
  <div className="max-w-sm space-y-2">
    <Label>Thématiques validées</Label>
    <MultipleSelector
      value={[
        { value: "alimentation", label: "Alimentation durable" },
        { value: "culture", label: "Culture" },
      ]}
      disabled
      placeholder=""
    />
    <p className="text-muted-foreground text-sm">Modifiables après validation par la modération.</p>
  </div>
);
