import {
  useState,
  useEffect,
  type ChangeEvent,
} from "react";

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

  /* Redirige l’utilisateur déjà connecté -------------------------------- */
  useEffect(() => {
    if (!loading && me?.isConnected) navigate("/");
  }, [loading, me, navigate]);

  /* --------------------------------------------------------------------- */
  const handleLogin = async (): Promise<void> => {
    setLoading(true);

    /* Validation rapide -------------------------------------------------- */
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez remplir l'email et le mot de passe",
      });
      setLoading(false);
      return;
    }
    if (!isValidEmail(email)) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "L'adresse e-mail n'est pas valide",
      });
      setLoading(false);
      return;
    }

    /* Appel API ---------------------------------------------------------- */
    try {
      await userApi.login(email, password, { remember });     // ← optionnel
      if (userApi.isConnected) navigate("/");
    } catch (err: unknown) {
      /* On extrait le status si présent, sinon on retombe sur le message  */
      const status =
        (err as { response?: { status?: number } }).response?.status;

      const msg =
        status === 401 || status === 404
          ? "Email ou mot de passe incorrect"
          : (err as Error).message;

      toast({
        variant: "destructive",
        title: "Erreur",
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------------------------------- */
  return (
    <div className="w-full space-y-6 p-8 rounded-lg bg-card shadow-lg border">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-2">
          Se connecter
        </h2>
        <p className="text-muted-foreground">
          Accédez à votre compte SiteForge
        </p>
      </div>

      <div className="space-y-4">
        <Input
          type="email"
          placeholder="Adresse e-mail"
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

        <div className="text-center space-y-2">
          <Button
            variant="ghost"
            onClick={() => navigate("/recover-password")}
            className="text-sm text-primary hover:text-primary/80"
          >
            Mot de passe oublié&nbsp;?
          </Button>

          <div className="text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Button
              variant="ghost"
              onClick={() => navigate("/register")}
              className="text-primary hover:text-primary/80 p-0 h-auto font-normal"
            >
              S'inscrire
            </Button>
          </div>

          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Retour à l'accueil
          </Button>
        </div>
      </div>
    </div>
  );
}
