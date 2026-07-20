import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "site-forge";

const FondPage = () => (
  <div style={{ minHeight: 420, padding: 32 }}>
    <h2 className="text-xl font-semibold">Agenda du tiers-lieu</h2>
    <p className="text-muted-foreground mt-2 max-w-md text-sm">
      Atelier « Réparation vélo » — samedi 26 juillet, 14 h — 8 inscrits.
    </p>
  </div>
);

export const SuppressionAtelier = () => (
  <>
    <FondPage />
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Supprimer l&apos;atelier « Réparation vélo » ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est définitive. Les 8 personnes inscrites seront
            prévenues par e-mail et l&apos;atelier disparaîtra de
            l&apos;agenda du tiers-lieu.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Conserver</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90">
            Supprimer définitivement
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
);

export const DesinscriptionEvenement = () => (
  <>
    <FondPage />
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Se désinscrire de la Fête des possibles ?</AlertDialogTitle>
          <AlertDialogDescription>
            Votre place sera libérée pour une personne en liste
            d&apos;attente. Vous pourrez vous réinscrire tant qu&apos;il
            reste des places.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Rester inscrit·e</AlertDialogCancel>
          <AlertDialogAction>Me désinscrire</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
);
