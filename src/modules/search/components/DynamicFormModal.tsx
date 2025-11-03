import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { useSite } from "@/hooks/useSite";
import {
  TextInput,
  TextareaInput,
  SelectInput,
  CheckboxInput,
  RadioInput,
  FileInput,
} from "@/components/form";
import type { Page, Section } from "@/types/site-schema";

interface DynamicFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string | null;
  defaultTypes?: string[];
}

const DynamicFormModal: React.FC<DynamicFormModalProps> = ({
  isOpen,
  onClose,
  entityType
}) => {
  const t = useT("modules/search");
  const { config: site } = useSite();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

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
  /* Obtenir la configuration du formulaire depuis le site              */
  /* ------------------------------------------------------------------ */
  const getFormConfig = () => {
    if (!entityType || !site?.pages) return null;

    // Chercher la page d'ajout correspondante
    const addPage = site.pages.find((page: Page) => 
      page.path === `/add-${entityType}` || 
      (entityType === 'citoyens' && page.path === '/register') ||
      (entityType === 'projects' && page.path === '/add-project')
    );

    if (!addPage || !addPage.sections) return null;

    // Chercher la section contactForm
    const contactFormSection = addPage.sections.find(
      (section: Section) => section.type === 'contactForm'
    );

    return contactFormSection?.props;
  };

  const formConfig = getFormConfig();

  /* ------------------------------------------------------------------ */
  /* Gestion des changements de formulaire                              */
  /* ------------------------------------------------------------------ */
  const handleInputChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Effacer l'erreur quand l'utilisateur commence à taper
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  /* ------------------------------------------------------------------ */
  /* Validation du formulaire                                           */
  /* ------------------------------------------------------------------ */
  const validateForm = (): boolean => {
    if (!formConfig?.fields) return true;

    const newErrors: Record<string, string> = {};

    formConfig.fields.forEach((field: any) => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = t("Ce champ est obligatoire");
      }

      // Validation email
      if (field.type === 'email' && formData[field.name]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData[field.name])) {
          newErrors[field.name] = t("Veuillez entrer un email valide");
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* ------------------------------------------------------------------ */
  /* Soumission du formulaire                                           */
  /* ------------------------------------------------------------------ */
  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      // Ici, vous intégrerez l'appel API réel
      console.log('Données du formulaire:', formData);
      
      // Simuler une soumission réussie
      alert(formConfig?.successMessage?.['fr'] || 'Formulaire soumis avec succès!');
      onClose();
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      alert(formConfig?.errorMessage?.['fr'] || 'Une erreur est survenue');
    }
  };

  /* ------------------------------------------------------------------ */
  /* Soumission du formulaire par défaut                                */
  /* ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ */
  /* Rendu des champs de formulaire                                     */
  /* ------------------------------------------------------------------ */
  const renderFormField = (field: any) => {
    const commonProps = {
      name: field.name,
      label: field.label?.['fr'] || field.name,
      placeholder: field.placeholder?.['fr'],
      required: field.required,
      error: errors[field.name],
      value: formData[field.name],
    };

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
        return (
          <TextInput
            {...commonProps}
            type={field.type}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(field.name, e.target.value)}
          />
        );

      case 'textarea':
        return (
          <TextareaInput
            {...commonProps}
            rows={6}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange(field.name, e.target.value)}
          />
        );

      case 'select':
        return (
          <SelectInput
            {...commonProps}
            options={field.options?.map((opt: any) => ({
              value: opt['fr'] || opt,
              label: opt['fr'] || opt,
            })) || []}
            onChange={(value: string) => handleInputChange(field.name, value)}
          />
        );

      case 'checkbox':
        return (
          <CheckboxInput
            {...commonProps}
            checked={formData[field.name] || false}
            onChange={(checked: boolean) => handleInputChange(field.name, checked)}
          />
        );

      case 'radio':
        return (
          <RadioInput
            {...commonProps}
            options={field.options?.map((opt: any) => ({
              value: opt['fr'] || opt,
              label: opt['fr'] || opt,
            })) || []}
            onChange={(value: string) => handleInputChange(field.name, value)}
          />
        );

      case 'file':
        return (
          <FileInput
            {...commonProps}
            buttonText={field.placeholder?.['fr'] || "Choisir un fichier"}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(field.name, e.target.files)}
          />
        );

      default:
        return (
          <TextInput
            {...commonProps}
            type="text"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(field.name, e.target.value)}
          />
        );
    }
  };

  // Si aucun formulaire n'est configuré mais qu'on a un type d'entité, utiliser un formulaire par défaut
  if (!formConfig && entityType) {
    const getDefaultFormConfig = () => {
      switch (entityType) {
        case 'projects':
          return {
            fields: [
              {
                name: "nom",
                label: {
                  "fr": "Nom de votre projet",
                  "en": "Your project name"
                },
                type: "text",
                required: true,
                placeholder: {
                  "fr": "Nom de votre projet",
                  "en": "Your project name"
                }
              },
              {
                name: "porteur",
                label: {
                  "fr": "Qui porte le projet",
                  "en": "Project leader"
                },
                type: "text",
                required: true,
                placeholder: {
                  "fr": "Nom du porteur du projet",
                  "en": "Project leader name"
                }
              },
              {
                name: "visibilite",
                label: {
                  "fr": "Rendre le projet visible publiquement ?",
                  "en": "Make project publicly visible?"
                },
                type: "radio",
                required: true,
                options: [
                  {
                    "fr": "Oui",
                    "en": "Yes"
                  },
                  {
                    "fr": "Non",
                    "en": "No"
                  }
                ]
              },
              {
                name: "images",
                label: {
                  "fr": "Vos images ici",
                  "en": "Your images here"
                },
                type: "file",
                required: false,
                placeholder: {
                  "fr": "Télécharger des images",
                  "en": "Upload images"
                }
              },
              {
                name: "email",
                label: {
                  "fr": "E-mail principal",
                  "en": "Main email"
                },
                type: "email",
                required: true,
                placeholder: {
                  "fr": "contact@exemple.com",
                  "en": "contact@example.com"
                },
                validation: "email"
              },
              {
                name: "adresse",
                label: {
                  "fr": "Adresse",
                  "en": "Address"
                },
                type: "text",
                required: false,
                placeholder: {
                  "fr": "Adresse du projet",
                  "en": "Project address"
                }
              },
              {
                name: "description_courte",
                label: {
                  "fr": "Description courte",
                  "en": "Short description"
                },
                type: "textarea",
                required: true,
                placeholder: {
                  "fr": "Décrivez brièvement votre projet...",
                  "en": "Briefly describe your project..."
                }
              }
            ],
            submitLabel: {
              "fr": "Créer le projet",
              "en": "Create project"
            },
            successMessage: {
              "fr": "Votre projet a été créé avec succès ! Il sera visible après validation.",
              "en": "Your project has been created successfully! It will be visible after validation."
            },
            errorMessage: {
              "fr": "Une erreur s'est produite lors de la création du projet. Veuillez réessayer.",
              "en": "An error occurred while creating the project. Please try again."
            }
          };

        case 'poi':
          return {
            fields: [
              {
                name: "type",
                label: {
                  "fr": "Quel type de point souhaitez-vous localiser ?",
                  "en": "What type of point do you want to locate?"
                },
                type: "select",
                required: true,
                options: [
                  {
                    "fr": "Patrimoine",
                    "en": "Heritage"
                  },
                  {
                    "fr": "Nature",
                    "en": "Nature"
                  },
                  {
                    "fr": "Culture",
                    "en": "Culture"
                  },
                  {
                    "fr": "Loisirs",
                    "en": "Leisure"
                  },
                  {
                    "fr": "Services",
                    "en": "Services"
                  }
                ]
              },
              {
                name: "nom",
                label: {
                  "fr": "Nom de votre Point d'intérêt",
                  "en": "Your point of interest name"
                },
                type: "text",
                required: true,
                placeholder: {
                  "fr": "Nom du point d'intérêt",
                  "en": "Point of interest name"
                }
              },
              {
                name: "porteur",
                label: {
                  "fr": "Qui porte votre Point d'intérêt",
                  "en": "Who manages your point of interest"
                },
                type: "text",
                required: true,
                placeholder: {
                  "fr": "Nom du porteur",
                  "en": "Manager name"
                }
              },
              {
                name: "images",
                label: {
                  "fr": "Vos images ici",
                  "en": "Your images here"
                },
                type: "file",
                required: false,
                placeholder: {
                  "fr": "Télécharger des images",
                  "en": "Upload images"
                }
              },
              {
                name: "description_longue",
                label: {
                  "fr": "Description longue",
                  "en": "Long description"
                },
                type: "textarea",
                required: true,
                placeholder: {
                  "fr": "Décrivez votre point d'intérêt en détail...",
                  "en": "Describe your point of interest in detail..."
                }
              }
            ],
            submitLabel: {
              "fr": "Créer le POI",
              "en": "Create POI"
            },
            successMessage: {
              "fr": "Votre point d'intérêt a été créé avec succès !",
              "en": "Your point of interest has been created successfully!"
            },
            errorMessage: {
              "fr": "Une erreur s'est produite lors de la création du point d'intérêt.",
              "en": "An error occurred while creating the point of interest."
            }
          };

        case 'citoyens':
          return {
            fields: [
              {
                name: "email",
                label: {
                  "fr": "Email",
                  "en": "Email"
                },
                type: "email",
                required: true,
                placeholder: {
                  "fr": "votre@email.com",
                  "en": "your@email.com"
                },
                validation: "email"
              }
            ],
            submitLabel: {
              "fr": "S'inscrire",
              "en": "Register"
            },
            successMessage: {
              "fr": "Votre inscription a été prise en compte !",
              "en": "Your registration has been received!"
            },
            errorMessage: {
              "fr": "Une erreur s'est produite lors de l'inscription.",
              "en": "An error occurred during registration."
            }
          };

        case 'NGO':
        case 'LocalBusiness':
        case 'Group':
        case 'GovernmentOrganization':
        case 'Cooperative':
        case 'organizations':
          return {
            fields: [
              {
                name: "nom",
                label: {
                  "fr": "Nom de votre organisation",
                  "en": "Your organization name"
                },
                type: "text",
                required: true,
                placeholder: {
                  "fr": "Nom de l'organisation",
                  "en": "Organization name"
                }
              },
              {
                name: "type_organisation",
                label: {
                  "fr": "Type d'organisation",
                  "en": "Organization type"
                },
                type: "select",
                required: true,
                options: [
                  {
                    "fr": "Association",
                    "en": "Association"
                  },
                  {
                    "fr": "Entreprise",
                    "en": "Business"
                  },
                  {
                    "fr": "Collectivité",
                    "en": "Local authority"
                  },
                  {
                    "fr": "Groupe",
                    "en": "Group"
                  },
                  {
                    "fr": "Coopérative",
                    "en": "Cooperative"
                  }
                ]
              },
              {
                name: "role",
                label: {
                  "fr": "Votre rôle",
                  "en": "Your role"
                },
                type: "text",
                required: true,
                placeholder: {
                  "fr": "Votre rôle dans l'organisation",
                  "en": "Your role in the organization"
                }
              },
              {
                name: "images",
                label: {
                  "fr": "Vos images ici",
                  "en": "Your images here"
                },
                type: "file",
                required: false,
                placeholder: {
                  "fr": "Télécharger des images",
                  "en": "Upload images"
                }
              },
              {
                name: "email",
                label: {
                  "fr": "E-mail principal",
                  "en": "Main email"
                },
                type: "email",
                required: true,
                placeholder: {
                  "fr": "contact@exemple.com",
                  "en": "contact@example.com"
                },
                validation: "email"
              },
              {
                name: "description_courte",
                label: {
                  "fr": "Description courte",
                  "en": "Short description"
                },
                type: "textarea",
                required: true,
                placeholder: {
                  "fr": "Décrivez brièvement votre organisation...",
                  "en": "Briefly describe your organization..."
                }
              },
              {
                name: "url",
                label: {
                  "fr": "URL principale",
                  "en": "Main URL"
                },
                type: "text",
                required: false,
                placeholder: {
                  "fr": "https://votre-site.com",
                  "en": "https://your-website.com"
                }
              }
            ],
            submitLabel: {
              "fr": "Créer l'organisation",
              "en": "Create organization"
            },
            successMessage: {
              "fr": "Votre organisation a été créée avec succès !",
              "en": "Your organization has been created successfully!"
            },
            errorMessage: {
              "fr": "Une erreur s'est produite lors de la création de l'organisation.",
              "en": "An error occurred while creating the organization."
            }
          };

        default:
          return null;
      }
    };

    const defaultFormConfig = getDefaultFormConfig();
    if (!defaultFormConfig) {
      // Fallback à la redirection pour les types d'entité non supportés
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
    }

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getModalTitle()}</DialogTitle>
            <DialogDescription>
              {getModalDescription()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {defaultFormConfig.fields?.map((field: any, index: number) => (
              <div key={field.name || index}>
                {renderFormField(field)}
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              {t("Annuler")}
            </Button>
            <Button onClick={handleSubmit}>
              {defaultFormConfig.submitLabel?.['fr'] || t("Soumettre")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Si formConfig est null, on ne devrait pas arriver ici, mais au cas où
  if (!formConfig) {
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
              <p>Configuration du formulaire non disponible.</p>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={onClose}>
                {t("Annuler")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getModalTitle()}</DialogTitle>
          <DialogDescription>
            {getModalDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {formConfig.fields?.map((field: any, index: number) => (
            <div key={field.name || index}>
              {renderFormField(field)}
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            {t("Annuler")}
          </Button>
          <Button onClick={handleSubmit}>
            {formConfig.submitLabel?.['fr'] || t("Soumettre")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DynamicFormModal;
