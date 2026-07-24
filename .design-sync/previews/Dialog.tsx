import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "site-forge";

const FondPage = () => (
  <div style={{ minHeight: 480, padding: 32 }}>
    <h2 className="text-xl font-semibold">Jardin partagé des Lilas</h2>
    <p className="text-muted-foreground mt-2 max-w-md text-sm">
      12 membres · 3 événements à venir · dernière activité il y a 2 heures.
      Un projet porté par le collectif Quartier Nord.
    </p>
  </div>
);

export const InvitationMembre = () => (
  <>
    <FondPage />
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inviter un membre</DialogTitle>
          <DialogDescription>
            La personne recevra un e-mail d&apos;invitation à rejoindre le
            projet « Jardin partagé des Lilas ».
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="invite-email">Adresse e-mail</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="prenom.nom@exemple.org"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-message">Message (facultatif)</Label>
            <Input
              id="invite-message"
              placeholder="Rejoins-nous pour la saison des semis !"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Annuler</Button>
          <Button>Envoyer l&apos;invitation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
);

export const PartageEvenement = () => (
  <>
    <FondPage />
    <Dialog open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Partager l&apos;événement</DialogTitle>
          <DialogDescription>
            Toute personne disposant de ce lien pourra consulter la fiche de
            la Fête des possibles.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="share-link" className="sr-only">
              Lien
            </Label>
            <Input
              id="share-link"
              readOnly
              value="https://tierslieux.re/agenda/fete-des-possibles"
            />
          </div>
          <Button size="sm" className="shrink-0">
            Copier
          </Button>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button variant="ghost">Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
);
