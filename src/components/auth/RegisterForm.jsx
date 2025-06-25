import React, { useState, useEffect } from "react";

import { useCocolight } from "@/hooks/useCocolight";
import PasswordToggleTextInput from "@/components/input/PasswordToggleTextInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidEmail } from "@/helpers/isValidEmail";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router";

export default function RegisterForm() {
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    pwd: "",
    confirmPassword: ""
  });
  const [loadingRegister, setLoadingRegister] = useState(false);
const navigate = useNavigate();
  const { userApi, loading, me } = useCocolight();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && me?.isConnected) {
      navigate("/");
    }
  }, [loading, me, navigate]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    const { name, username, email, pwd, confirmPassword } = formData;
    
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Erreur", description: "Le nom est requis" });
      return false;
    }
    
    if (!username.trim()) {
      toast({ variant: "destructive", title: "Erreur", description: "Le nom d'utilisateur est requis" });
      return false;
    }
    
    if (!email || !isValidEmail(email)) {
      toast({ variant: "destructive", title: "Erreur", description: "L'adresse e-mail n'est pas valide" });
      return false;
    }
    
    if (!pwd || pwd.length < 6) {
      toast({ variant: "destructive", title: "Erreur", description: "Le mot de passe doit contenir au moins 6 caractères" });
      return false;
    }
    
    if (pwd !== confirmPassword) {
      toast({ variant: "destructive", title: "Erreur", description: "Les mots de passe ne correspondent pas" });
      return false;
    }
    
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    
    setLoadingRegister(true);
    
    try {
      const { name, username, email, pwd } = formData;
      const response = await userApi.register({
        name,
        username,
        email,
        pwd,
      });
      
      if (response.result) {
        toast({ 
          title: "Succès", 
          description: "Votre compte a été créé avec succès ! Vous pouvez maintenant vous connecter." 
        });
        navigate("/login");
      } else {
        toast({ 
          variant: "destructive", 
          title: "Erreur", 
          description: response.msg || "Une erreur est survenue lors de la création du compte" 
        });
      }
    } catch (err) {
      console.error("Erreur lors de l'inscription:", err);
      const msg = err.response?.data?.msg || err.message || "Une erreur est survenue lors de la création du compte";
      toast({ variant: "destructive", title: "Erreur", description: msg });
    } finally {
      setLoadingRegister(false);
    }
  };

  return (
    <div className="w-full space-y-6 p-8 rounded-lg bg-card shadow-lg border">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-2">Créer un compte</h2>
        <p className="text-muted-foreground">Rejoignez SiteForge dès aujourd'hui</p>
      </div>

      <div className="space-y-4">
        <Input
          type="text"
          placeholder="Nom complet"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          className="h-12"
        />
        
        <Input
          type="text"
          placeholder="Nom d'utilisateur"
          value={formData.username}
          onChange={(e) => handleInputChange('username', e.target.value)}
          className="h-12"
        />
        
        <Input
          type="email"
          placeholder="Adresse e-mail"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          className="h-12"
        />
        
        <PasswordToggleTextInput
          placeholder="Mot de passe"
          value={formData.pwd}
          onChange={(e) => handleInputChange('pwd', e.target.value)}
          className="h-12"
        />
        
        <PasswordToggleTextInput
          placeholder="Confirmer le mot de passe"
          value={formData.confirmPassword}
          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
          className="h-12"
        />

        <Button
          className="w-full"
          onClick={handleRegister}
          disabled={loadingRegister}
          variant="default"
          size="lg"
        >
          {loadingRegister ? "Création du compte..." : "Créer mon compte"}
        </Button>
        
        <div className="text-center space-y-2">
          <Button
            variant="ghost"
            onClick={() => navigate('/login')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Déjà un compte ? Se connecter
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