import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from "sonner";
import { useLocalization } from "@/hooks/useLocalization";
import { useCocolight } from "@/hooks/useCocolight";
import { getSlug } from "@/lib/constant/common";
import { buildContactPayload } from "@/lib/contactPayload";
import { ContactFormSectionProps } from '@/types/site-schema';

/** Valeur manipulée pour chaque champ du formulaire */
type FieldValue = string | boolean | number | File | undefined | null;
type FormState = Record<string, FieldValue>;

export function ContactFormSection({ id, props }: { id?: string; props: ContactFormSectionProps }) {
  const { t } = useLocalization();
  const { api } = useCocolight();

  // `action`/`method` restent acceptés par le schéma mais sont IGNORÉS : le message part par la lib
  // (`CONTACT_SEND` → `/co2/mailmanagement/createandsend`), pas vers une URL déclarée en config.
  // L'ancien fil postait du JSON sur `/api/contact`, une route qui n'a jamais existé.
  const { fields, submitLabel, successMessage, errorMessage } = props;

  const [formData, setFormData] = useState<FormState>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (name: string, value: FieldValue) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateField = (field: ContactFormSectionProps['fields'][number], value: FieldValue) => {
    if (field.required && (value === undefined || value === null || value === '')) {
      return `${t(field.label)} est requis`;
    }

    if (field.validation && value) {
      switch (field.validation) {
        case 'email': {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (typeof value !== 'string' || !emailRegex.test(value)) {
            return 'Adresse e-mail invalide';
          }
          break;
        }
        case 'tel': {
          const phoneRegex = /^[\d\s()+-]+$/; // chiffres, espaces, + ( ) -
          if (typeof value !== 'string' || !phoneRegex.test(value)) {
            return 'Numéro de téléphone invalide';
          }
          break;
        }
        default:
          // Validation regex custom
          try {
            const regex = new RegExp(field.validation);
            if (typeof value !== 'string' || !regex.test(value)) {
              return `Format invalide pour ${t(field.label)}`;
            }
          } catch {
            console.warn('Invalid regex pattern:', field.validation);
          }
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validation
    const errors: string[] = [];
    fields.forEach(field => {
      const error = validateField(field, formData[field.name]);
      if (error) errors.push(error);
    });

    if (errors.length > 0) {
      toast.error("Erreurs de validation", {
        description: errors.join(', ')
      });
      setIsSubmitting(false);
      return;
    }

    // Destinataire : JAMAIS choisi par le client. Le serveur le résout depuis `costum.admin.email`
    // du costum porteur — d'où `costumSlug` comme seul paramètre d'adressage (cf. CONTACT_SEND).
    const payload = buildContactPayload(fields, formData, getSlug());
    if (!payload || !api) {
      toast.error("Erreur", {
        description: errorMessage ? t(errorMessage) : "Une erreur est survenue lors de l'envoi du formulaire"
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await api.endpointApi.contactSend(payload);
      // Le legacy répond {result:true, msg:"Ok : webhook handdled"} ; un refus rend result:false.
      if (res && (res as { result?: unknown }).result === false) throw new Error("Envoi refusé");
      toast.success("Succès", {
        description: successMessage ? t(successMessage) : "Votre message a été envoyé avec succès"
      });
      setFormData({});
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err: unknown) {
      toast.error("Erreur", {
        description: errorMessage ? t(errorMessage) : "Une erreur est survenue lors de l'envoi du formulaire"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: ContactFormSectionProps['fields'][number]) => {
    const value = formData[field.name] as FieldValue ?? '';

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            id={field.name}
            name={field.name}
            placeholder={field.placeholder ? t(field.placeholder) : ''}
            value={value as string}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
            className="min-h-[120px]"
          />
        );

      case 'select':
        return (
          <Select
            value={value as string}
            onValueChange={(val) => handleInputChange(field.name, val)}
            required={field.required}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder ? t(field.placeholder) : `Sélectionner ${t(field.label)}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option, index) => (
                <SelectItem key={index} value={Object.values(option)[0]}>
                  {t(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.name}
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleInputChange(field.name, Boolean(checked))}
              required={field.required}
            />
            <Label htmlFor={field.name} className="text-sm">
              {t(field.label)}
            </Label>
          </div>
        );

      case 'radio':
        return (
          <RadioGroup
            value={value as string}
            onValueChange={(val) => handleInputChange(field.name, val)}
            required={field.required}
          >
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={Object.values(option)[0]} id={`${field.name}-${index}`} />
                <Label htmlFor={`${field.name}-${index}`} className="text-sm">
                  {t(option)}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'file':
        return (
          <Input
            id={field.name}
            name={field.name}
            type="file"
            onChange={(e) => handleInputChange(field.name, e.target.files?.[0] ?? null)}
            required={field.required}
          />
        );

      default:
        return (
          <Input
            id={field.name}
            name={field.name}
            type={field.type || 'text'}
            placeholder={field.placeholder ? t(field.placeholder) : ''}
            value={value as string}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
          />
        );
    }
  };

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {fields.map((field, index) => (
              <div key={index} className="space-y-2">
                {field.type !== 'checkbox' && (
                  <Label htmlFor={field.name} className="text-sm font-medium">
                    {t(field.label)}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                )}
                {renderField(field)}
              </div>
            ))}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? 'Envoi en cours...' : t(submitLabel)}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}

export default ContactFormSection;
