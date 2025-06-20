
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";

import { useCocolight } from "@/application/hooks/useCocolight";
import PasswordToggleTextInput from "@/components/input/PasswordToggleTextInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { isValidEmail } from "@/helpers/isValidEmail";
import { useToast } from "@/hooks/use-toast";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const navigate = useNavigate();
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
    <div className="flex h-screen items-center justify-center bg-background">  {/* theme background */}
      <div className="w-full max-w-md space-y-6 p-8 rounded-lg bg-card shadow">  {/* theme card */}
        <h2 className="text-2xl font-bold text-primary text-center">Se connecter</h2>

        <div className="space-y-4">
          <Input
            type="email"
            placeholder="Adresse e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PasswordToggleTextInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="flex items-center justify-between">
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(checked) => setRemember(Boolean(checked))}
            />
            <label htmlFor="remember" className="ml-2 text-sm text-muted-foreground">
              Se souvenir de moi
            </label>
          </div>

          <Button
            className="w-full"
            onClick={handleLogin}
            disabled={loadingLogin}
            variant="default"
          >
            {loadingLogin ? "Connexion..." : "Se connecter"}
          </Button>
        </div>
      </div>
    </div>
  );
}
