import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useLocalization } from '@/contexts/LocalizationContext';
import { Mail, CheckCircle } from 'lucide-react';

interface NewsletterSectionProps {
  id?: string;
  props: {
    headline: Record<string, string>;
    subhead?: Record<string, string>;
    formAction: string;
    emailPlaceholder?: Record<string, string>;
    submitLabel: Record<string, string>;
    successMessage?: Record<string, string>;
  };
}

export function NewsletterSection({ id, props }: NewsletterSectionProps) {
  const { t } = useLocalization();
  const { toast } = useToast();
  const { headline, subhead, formAction, emailPlaceholder, submitLabel, successMessage } = props;
  
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez saisir votre adresse e-mail"
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Adresse e-mail invalide"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(formAction, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setIsSubscribed(true);
        toast({
          title: "Succès",
          description: successMessage ? t(successMessage) : "Inscription réussie à la newsletter"
        });
      } else {
        throw new Error('Erreur lors de l\'inscription');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue lors de l'inscription"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubscribed) {
    return (
      <section id={id} className="py-16 bg-primary/5 text-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-3xl font-bold mb-4 text-foreground">
              Merci pour votre inscription !
            </h2>
            <p className="text-muted-foreground">
              Vous recevrez bientôt nos dernières actualités à l'adresse <strong>{email}</strong>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id={id} className="py-16 bg-primary/5 text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          
          <h2 className="text-3xl font-bold mb-4 text-foreground">
            {t(headline)}
          </h2>
          
          {subhead && (
            <p className="text-muted-foreground mb-8 text-lg">
              {t(subhead)}
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto">
            <Input
              type="email"
              placeholder={
                emailPlaceholder 
                  ? t(emailPlaceholder)
                  : 'Votre adresse e-mail...'
              }
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              required
            />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Inscription...' : t(submitLabel)}
            </Button>
          </form>
          
          <p className="text-xs text-muted-foreground mt-4">
            En vous inscrivant, vous acceptez de recevoir nos e-mails. Vous pouvez vous désabonner à tout moment.
          </p>
        </div>
      </div>
    </section>
  );
}