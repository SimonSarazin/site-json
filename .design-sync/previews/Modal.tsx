import {
  Button,
  Label,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Textarea,
} from "site-forge";

const FondPage = () => (
  <div style={{ minHeight: 460, padding: 32 }}>
    <h2 className="text-xl font-semibold">Actualités du réseau</h2>
    <p className="text-muted-foreground mt-2 max-w-md text-sm">
      « La Ressourcerie ouvre un deuxième atelier vélo » — brouillon
      enregistré il y a 5 minutes.
    </p>
  </div>
);

export const ConfirmationPublication = () => (
  <>
    <FondPage />
    <Modal open>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Publier l&apos;article ?</ModalTitle>
          <ModalDescription>
            « La Ressourcerie ouvre un deuxième atelier vélo » sera visible
            par tous les membres du réseau et dans le flux public
            d&apos;actualités.
          </ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <Button variant="outline">Garder en brouillon</Button>
          <Button>Publier maintenant</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  </>
);

export const SignalementContenu = () => (
  <>
    <FondPage />
    <Modal open>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Signaler ce contenu</ModalTitle>
          <ModalDescription>
            Votre signalement sera transmis aux personnes chargées de la
            modération du site.
          </ModalDescription>
        </ModalHeader>
        <div className="grid gap-2">
          <Label htmlFor="report-reason">Motif du signalement</Label>
          <Textarea
            id="report-reason"
            rows={4}
            placeholder="Décrivez le problème rencontré (contenu obsolète, propos inappropriés…)"
          />
        </div>
        <ModalFooter>
          <Button variant="outline">Annuler</Button>
          <Button variant="destructive">Envoyer le signalement</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  </>
);
