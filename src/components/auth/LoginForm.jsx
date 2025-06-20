import React, { useState, useEffect } from "react";

import { useCocolight } from "@/hooks/useCocolight";
import PasswordToggleTextInput from "@/components/input/PasswordToggleTextInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { isValidEmail } from "@/helpers/isValidEmail";
import { useToast } from "@/hooks/use-toast";
import { useRouterContext } from "@/contexts/RouterContext";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const { navigate } = useRouterContext();
  const { userApi, loading, me } = useCocolight();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && me?.isConnected) {
      navigate("/");
    }
  }, [loading, me, navigate]);

  const handleLogin = async () => {
    setLoadingLogin(true);
    if (!email || !password) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez remplir l'email et le mot de passe" });
      setLoadingLogin(false);
      return;
    }
    if (!isValidEmail(email)) {
      toast({ variant: "destructive", title: "Erreur", description: "L'adresse e-mail n'est pas valide" });
      setLoadingLogin(false);
      return;
    }
    try {
      await userApi.login(email, password);
      if (userApi.isConnected) navigate("/");
    } catch (err) {
      const status = err.response?.status;
      const msg = status === 401 || status === 404
        ? "Email ou mot de passe incorrect"
        : err.message;
      toast({ variant: "destructive", title: "Erreur", description: msg });
    } finally {
      setLoadingLogin(false);
    }
  };

  return (
    <div className="w-full space-y-6 p-8 rounded-lg bg-card shadow-lg border">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-2">Se connecter</h2>
        <p className="text-muted-foreground">Accédez à votre compte SiteForge</p>
      </div>

      <div className="space-y-4">
        <Input
          type="email"
          placeholder="Adresse e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12"
        />
        <PasswordToggleTextInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12"
        />

        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember"
            checked={remember}
            onCheckedChange={(checked) => setRemember(Boolean(checked))}
          />
          <label htmlFor="remember" className="text-sm text-muted-foreground">
            Se souvenir de moi
          </label>
        </div>

        <Button
          className="w-full"
          onClick={handleLogin}
          disabled={loadingLogin}
          variant="default"
          size="lg"
        >
          {loadingLogin ? "Connexion..." : "Se connecter"}
        </Button>
        
        <div className="text-center">
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