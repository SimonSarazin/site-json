import { useState } from "react";
import { useForm, type UseFormReturn, type FieldValues } from "react-hook-form";
import { Loader2, Building2, MapPin, FileText, ChevronLeft, ChevronRight, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EditLocationTab } from "../profile-edit/EditLocationTab";
import type { ModalProps } from "./ModalRegistry";
import { cn } from "@/lib/utils";

interface RegisterCyberReunionFormData {
  email: string;
  name: string;
  siren: string;
  actorType: string;
  domains: string;
  specialties: string;
  offers: string;
  phone: string;
  partnerships: string;
  website: string;
  verificationDate: string;
  addressCountry: string;
  addressLocality: string;
  localityId: string;
  postalCode: string;
  streetAddress: string;
}

const STEPS = [
  {
    id: 1,
    title: "Qui êtes-vous ?",
    description: "Commençons par quelques informations de base",
    icon: Building2,
  },
  {
    id: 2,
    title: "Détails de l'organisation",
    description: "Informations complémentaires sur votre activité",
    icon: FileText,
  },
  {
    id: 3,
    title: "Localisation",
    description: "Adresse postale complète de l'organisme",
    icon: MapPin,
  },
];

export function RegisterCyberReunionModal({ open, onOpenChange }: ModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegisterCyberReunionFormData>({
    defaultValues: {
      email: "",
      name: "",
      siren: "",
      actorType: "",
      domains: "",
      specialties: "",
      offers: "",
      phone: "",
      partnerships: "",
      website: "",
      verificationDate: "",
      addressCountry: "",
      addressLocality: "",
      localityId: "",
      postalCode: "",
      streetAddress: "",
    },
  });

  const onSubmit = async (data: RegisterCyberReunionFormData) => {
    setIsSubmitting(true);
    try {
      console.log("Form data:", data);
      form.reset();
      setCurrentStep(1);
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset();
    setCurrentStep(1);
    onOpenChange(false);
  };

  const goToNextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepConfig = STEPS[currentStep - 1];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Inscrire mon organisation
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 px-4">
          <div className="flex items-start justify-center">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center" style={{ width: "100px" }}>
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                      currentStep > step.id
                        ? "bg-primary border-primary text-primary-foreground"
                        : currentStep === step.id
                        ? "border-primary text-primary"
                        : "border-muted text-muted-foreground"
                    )}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <step.icon className="h-5 w-5" />
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-xs font-medium text-center",
                      currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </p>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-12 -mt-6",
                      currentStep > step.id ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-1 py-4">
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold">{currentStepConfig.title}</h3>
                    <p className="text-sm text-muted-foreground">{currentStepConfig.description}</p>
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="contact@organisation.com"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de l'organisation</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Nom de votre organisation"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold">{currentStepConfig.title}</h3>
                    <p className="text-sm text-muted-foreground">{currentStepConfig.description}</p>
                  </div>

                  <FormField
                    control={form.control}
                    name="siren"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SIREN</FormLabel>
                        <FormControl>
                          <Input placeholder="123 456 789" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="actorType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type d'acteur</FormLabel>
                        <FormControl>
                          <Input placeholder="Entreprise, Association, Startup..." {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="domains"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Domaines / sous-domaines</FormLabel>
                        <FormControl>
                          <Input placeholder="Cybersécurité, Cloud, IA..." {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="specialties"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Spécialités</FormLabel>
                        <FormControl>
                          <Input placeholder="Audit, Pentest, SOC..." {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="offers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Offre (matériels/logiciels/services)</FormLabel>
                        <FormControl>
                          <Input placeholder="Consulting, Formation, Logiciels..." {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="+262 692 00 00 00" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="partnerships"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Partenariats / affiliations</FormLabel>
                        <FormControl>
                          <Input placeholder="ANSSI, Campus Cyber..." {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Site web</FormLabel>
                        <FormControl>
                          <Input placeholder="https://www.exemple.com" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="verificationDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de vérification</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold">{currentStepConfig.title}</h3>
                    <p className="text-sm text-muted-foreground">{currentStepConfig.description}</p>
                  </div>

                  <EditLocationTab form={form as unknown as UseFormReturn<FieldValues>} />
                </div>
              )}
            </div>

            <DialogFooter className="mt-6 pt-4 border-t border-border flex-row justify-between">
              <div>
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToPreviousStep}
                    disabled={isSubmitting}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Précédent
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                {currentStep < STEPS.length ? (
                  <Button type="button" onClick={goToNextStep} disabled={isSubmitting}>
                    Suivant
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Inscription...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Inscrire mon organisation
                      </>
                    )}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
