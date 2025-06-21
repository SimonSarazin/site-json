import React, { useState, useEffect } from "react";

import { useCocolight } from "@/hooks/useCocolight";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidEmail } from "@/helpers/isValidEmail";
import { useToast } from "@/hooks/use-toast";
import { useRouterContext } from "@/contexts/RouterContext";
import { CheckCircle, ArrowLeft } from "lucide-react";

export default function RecoverPasswordForm() {
  const [email, setEmail] = useState("");
  const [loadingRecover, setLoadingRecover] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { navigate } = useRouterContext();
  const { userApi, loading, me } = useCocolight();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && me?.isConnected) {
      navigate("/");
    }
  }, [loading, me, navigate]);

  const handleRecoverPassword = async () => {
    if (!email) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez saisir votre adresse e-mail" });
      return;
    }
    
    if (!isValidEmail(email)) {
      toast({ variant: "destructive", title: "Erreur", description: "L'adresse e-mail n'est pas valide" });
      return;
    }
    
    setLoadingRecover(true);
    
    try {
      const response = await userApi.recoverPassword(email);
      
      if (response.result) {
        setEmailSent(true);
        toast({ 
          title: "E-mail envoyé", 
          description: "Un e-mail de récupération a été envoyé à votre adresse." 
        });
      } else {
        if (response.errId === "UNKNOWN_ACCOUNT_ID") {
          toast({ 
            variant: "destructive", 
            title: "Compte introuvable", 
            description: "Aucun compte n'est associé à cette adresse e-mail." 
          });
        } else {
          toast({ 
            variant: "destructive", 
            title: "Erreur", 
            description: response.msg || "Une erreur est survenue lors de l'envoi de l'e-mail" 
          });
        }
      }
    } catch (err) {
      console.error("Erreur lors de la récupération:", err);
      const msg = err.response?.data?.msg || err.message || "Une erreur est survenue lors de l'envoi de l'e-mail";
      toast({ variant: "destructive", title: "Erreur", description: msg });
    } finally {
      setLoadingRecover(false);
    }
  };

  if (emailSent) {
    return (
      <div className="w-full space-y-6 p-8 rounded-lg bg-card shadow-lg border">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">E-mail envoyé</h2>
          <p className="text-muted-foreground mb-4">
            Un e-mail de récupération a été envoyé à <strong>{email}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Vérifiez votre boîte de réception et suivez les instructions pour réinitialiser votre mot de passe.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full"
            onClick={() => navigate('/login')}
            variant="default"
            size="lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à la connexion
          </Button>
          
          <Button
            variant="ghost"
            onClick={() => {
              setEmailSent(false);
              setEmail("");
            }}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Renvoyer l'e-mail
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-8 rounded-lg bg-card shadow-lg border">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-2">Mot de passe oublié</h2>
        <p className="text-muted-foreground">
          Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation
        </p>
      </div>

      <div className="space-y-4">
        <Input
          type="email"
          placeholder="Adresse e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleRecoverPassword();
            }
          }}
        />

        <Button
          className="w-full"
          onClick={handleRecoverPassword}
          disabled={loadingRecover}
          variant="default"
          size="lg"
        >
          {loadingRecover ? "Envoi en cours..." : "Envoyer le lien de récupération"}
        </Button>
        
        <div className="text-center space-y-2">
          <Button
            variant="ghost"
            onClick={() => navigate('/login')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à la connexion
          </Button>
          
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Retour à l'accueil
          </Button>
        </div>
      </div>
    </div>
  );
}