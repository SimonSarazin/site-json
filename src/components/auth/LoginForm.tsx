import {
  useState,
  useEffect,
  type ChangeEvent,
} from "react";

import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/components/auth/i18n";

import { useCocolight } from "@/hooks/useCocolight";
import PasswordToggleTextInput from "@/components/input/PasswordToggleTextInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { isValidEmail } from "@/helpers/isValidEmail";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router";

type RadixCheckboxState = boolean | "indeterminate";

export default function LoginForm(): JSX.Element {
  const [email, setEmail]           = useState<string>("");
  const [password, setPassword]     = useState<string>("");
  const [remember, setRemember]     = useState<boolean>(false);
  const [loadingLogin, setLoading]  = useState<boolean>(false);

  const navigate                     = useNavigate();
  const { userApi, loading, me }     = useCocolight();
  const { toast }                    = useToast();
  const { loaded }                   = useLoadNamespace("components/auth");
  const t                            = useT("components/auth");

  /* Redirige l’utilisateur déjà connecté -------------------------------- */
  useEffect(() => {
    if (!loading && me?.isConnected) navigate("/");
  }, [loading, me, navigate]);

  /* --------------------------------------------------------------------- */
  const handleLogin = async (): Promise<void> => {
    setLoading(true);

    // Si userApi n'est pas encore prêt, on arrête
    if (!userApi) {
      toast({
        variant: "destructive",
        title: t("Erreur"),
        description: t("Impossible de se connecter pour le moment"),
      });
      setLoading(false);
      return;
    }
    
    /* Validation rapide -------------------------------------------------- */
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: t("Erreur"),
        description: t("Veuillez remplir l'email et le mot de passe"),
      });
      setLoading(false);
      return;
    }
    if (!isValidEmail(email)) {
      toast({
        variant: "destructive",
        title: t("Erreur"),
        description: t("L'adresse e-mail n'est pas valide"),
      });
      setLoading(false);
      return;
    }

    /* Appel API ---------------------------------------------------------- */
    try {
      await userApi.login(email, password);     // ← optionnel
      if (userApi.isConnected) navigate("/");
    } catch (err: unknown) {
      /* On extrait le status si présent, sinon on retombe sur le message  */
      const status =
        (err as { response?: { status?: number } }).response?.status;

      const msg =
        status === 401 || status === 404
          ? t("Email ou mot de passe incorrect")
          : (err as Error).message;

      toast({
        variant: "destructive",
        title: t("Erreur"),
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------------------------------- */
  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-8 rounded-lg bg-card shadow-lg border">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-2">
          {t("Se connecter")}
        </h2>
        <p className="text-muted-foreground">
          {t("Accédez à votre compte SiteForge")}
        </p>
      </div>

      <div className="space-y-4">
        <Input
          type="email"
          placeholder={t("Adresse e-mail")}
          value={email}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setEmail(e.target.value)
          }
          className="h-12"
        />

        <PasswordToggleTextInput
          value={password}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setPassword(e.target.value)
          }
          className="h-12"
        />

        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember"
            checked={remember}
            /* Radix UI : boolean | "indeterminate" ----------------------- */
            onCheckedChange={(checked: RadixCheckboxState) =>
              setRemember(Boolean(checked))
            }
          />
          <label
            htmlFor="remember"
            className="text-sm text-muted-foreground"
          >
            {t("Se souvenir de moi")}
          </label>
        </div>

        <Button
          className="w-full"
          onClick={handleLogin}
          disabled={loadingLogin}
          variant="default"
          size="lg"
        >
          {loadingLogin ? t("Connexion...") : t("Se connecter")}
        </Button>

        <div className="text-center space-y-2">
          <Button
            variant="ghost"
            onClick={() => navigate("/recover-password")}
            className="text-sm text-primary hover:text-primary/80"
          >
            {t("Mot de passe oublié ?")}
          </Button>

          <div className="text-sm text-muted-foreground">
            {t("Pas encore de compte ?")} {" "}
            <Button
              variant="ghost"
              onClick={() => navigate("/register")}
              className="text-primary hover:text-primary/80 p-0 h-auto font-normal"
            >
              {t("S'inscrire")}
            </Button>
          </div>

          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("Retour à l'accueil")}
          </Button>
        </div>
      </div>
    </div>
  );
}
