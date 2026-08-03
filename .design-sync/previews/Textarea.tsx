import { Label, Textarea } from "site-forge";

// Zone de texte multiligne — formulaire de contact d'un centre social.

export const Vide = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="ta-demande">Votre demande</Label>
    <Textarea id="ta-demande" placeholder="Décrivez votre demande en quelques lignes…" />
  </div>
);

export const Remplie = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="ta-motiv">Pourquoi souhaitez-vous devenir bénévole ?</Label>
    <Textarea
      id="ta-motiv"
      defaultValue="Je viens d'emménager dans le quartier et j'aimerais donner un coup de main à l'accompagnement scolaire le mardi soir. J'ai déjà encadré des ateliers de lecture en médiathèque."
    />
    <p className="text-muted-foreground text-sm">Quelques phrases suffisent, l'équipe vous recontactera.</p>
  </div>
);

export const Erreur = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="ta-err">Description de l'activité</Label>
    <Textarea id="ta-err" defaultValue="Atelier cuisine" aria-invalid />
    <p className="text-destructive text-sm">La description doit contenir au moins 50 caractères.</p>
  </div>
);

export const Desactivee = () => (
  <div className="max-w-sm space-y-2">
    <Label htmlFor="ta-off">Commentaire de la modération</Label>
    <Textarea
      id="ta-off"
      defaultValue="Annonce validée le 12 juin — visible dans l'agenda du quartier."
      disabled
    />
  </div>
);
