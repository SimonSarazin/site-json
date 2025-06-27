import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLocalization } from "@/hooks/useLocalization";

interface ContactFormSectionProps {
  id?: string;
  props: {
    fields: Array<Field>;
    submitLabel: Record<string, string>;
    action: string;
    method?: 'GET' | 'POST';
    successMessage?: Record<string, string>;
    errorMessage?: Record<string, string>;
  };
}

interface Field {
  name: string;
  label: Record<string, string>;
  type?: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file';
  required?: boolean;
  placeholder?: Record<string, string>;
  options?: Array<Record<string, string>>;
  validation?: string;
}

export function ContactFormSection({ id, props }: ContactFormSectionProps) {
  const { t } = useLocalization();
  const { toast } = useToast();
  const { fields, submitLabel, action, method = 'POST', successMessage, errorMessage } = props;
  
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (name: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateField = (field: Field, value: any) => {
    if (field.required && (!value || value === '')) {
      return `${t(field.label)} est requis`;
    }

    if (field.validation && value) {
      switch (field.validation) {
        case 'email':
          { const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return 'Adresse e-mail invalide';
          }
          break; }
        case 'tel':
          { const phoneRegex = /^[\d\s\-\+\(\)]+$/;
          if (!phoneRegex.test(value)) {
            return 'Numéro de téléphone invalide';
          }
          break; }
        default:
          // Custom regex validation
          try {
            const regex = new RegExp(field.validation);
            if (!regex.test(value)) {
              return `Format invalide pour ${t(field.label)}`;
            }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (e) {
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
      if (error) {
        errors.push(error);
      }
    });

    if (errors.length > 0) {
      toast({
        variant: "destructive",
        title: "Erreurs de validation",
        description: errors.join(', ')
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(action, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: "Succès",
          description: successMessage ? t(successMessage) : "Votre message a été envoyé avec succès"
        });
        setFormData({});
      } else {
        throw new Error('Erreur lors de l\'envoi');
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: errorMessage ? t(errorMessage) : "Une erreur est survenue lors de l'envoi du formulaire"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: Field) => {
    const value = formData[field.name] || '';

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            id={field.name}
            name={field.name}
            placeholder={field.placeholder ? t(field.placeholder) : ''}
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
            className="min-h-[120px]"
          />
        );

      case 'select':
        return (
          <Select
            value={value}
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
              checked={value}
              onCheckedChange={(checked) => handleInputChange(field.name, checked)}
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
            value={value}
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
            onChange={(e) => handleInputChange(field.name, e.target.files?.[0])}
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
            value={value}
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
                    {field.required && <span className="text-red-500 ml-1">*</span>}
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