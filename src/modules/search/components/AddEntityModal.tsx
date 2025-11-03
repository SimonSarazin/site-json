import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";

interface AddEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string | null;
  defaultTypes?: string[];
}

const AddEntityModal: React.FC<AddEntityModalProps> = ({
  isOpen,
  onClose,
  entityType
}) => {
  const t = useT("modules/search");

  /* ------------------------------------------------------------------ */
  /* Déterminer le titre de la modal basé sur le type d'entité          */
  /* ------------------------------------------------------------------ */
  const getModalTitle = (): string => {
    const titleMap: Record<string, string> = {
      'poi': 'Ajouter un Point d\'Intérêt',
      'projects': 'Ajouter un Projet',
      'citoyens': 'Ajouter un Membre',
      'NGO': 'Ajouter une Organisation',
      'LocalBusiness': 'Ajouter une Entreprise',
      'Group': 'Ajouter un Groupe',
      'GovernmentOrganization': 'Ajouter une Organisation Gouvernementale',
      'Cooperative': 'Ajouter une Coopérative',
      'organizations': 'Ajouter une Organisation'
    };

    return entityType ? titleMap[entityType] || 'Ajouter un élément' : 'Ajouter un élément';
  };

  /* ------------------------------------------------------------------ */
  /* Déterminer la description de la modal                              */
  /* ------------------------------------------------------------------ */
  const getModalDescription = (): string => {
    const descriptionMap: Record<string, string> = {
      'poi': 'Créez un nouveau point d\'intérêt pour votre communauté',
      'projects': 'Lancez un nouveau projet collaboratif',
      'citoyens': 'Ajoutez un nouveau membre à votre communauté',
      'NGO': 'Enregistrez une nouvelle association ou organisation',
      'LocalBusiness': 'Ajoutez une entreprise locale',
      'Group': 'Créez un nouveau groupe communautaire',
      'GovernmentOrganization': 'Ajoutez une organisation gouvernementale',
      'Cooperative': 'Enregistrez une nouvelle coopérative',
      'organizations': 'Ajoutez une nouvelle organisation'
    };

    return entityType ? descriptionMap[entityType] || 'Créez un nouvel élément pour votre communauté' : 'Créez un nouvel élément pour votre communauté';
  };

  /* ------------------------------------------------------------------ */
  /* Obtenir l'URL de redirection pour le type d'entité                 */
  /* ------------------------------------------------------------------ */
  const getRedirectUrl = (): string => {
    const urlMap: Record<string, string> = {
      'poi': '/add-poi',
      'projects': '/add-project',
      'citoyens': '/register',
      'NGO': '/add-organization',
      'LocalBusiness': '/add-organization',
      'Group': '/add-organization',
      'GovernmentOrganization': '/add-organization',
      'Cooperative': '/add-organization',
      'organizations': '/add-organization'
    };

    return entityType ? urlMap[entityType] || '/add' : '/add';
  };

  const handleRedirect = () => {
    const url = getRedirectUrl();
    window.location.href = url;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getModalTitle()}</DialogTitle>
          <DialogDescription>
            {getModalDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>Les formulaires d'ajout sont configurés via le fichier config.prod.json.</p>
            <p>Vous serez redirigé vers le formulaire approprié.</p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              {t("Annuler")}
            </Button>
            <Button onClick={handleRedirect}>
              {t("Continuer")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddEntityModal;
