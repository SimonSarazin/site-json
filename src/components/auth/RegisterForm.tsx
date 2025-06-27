import {
  useState,
  useEffect,
  type ChangeEvent,
} from "react";

import { useCocolight } from "@/hooks/useCocolight";
import PasswordToggleTextInput from "@/components/input/PasswordToggleTextInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidEmail } from "@/helpers/isValidEmail";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router";

interface RegisterFormState {
  name: string;
  username: string;
  email: string;
  pwd: string;
  confirmPassword: string;
}

export default function RegisterForm(): JSX.Element {
  /* ------------------------------------------------------------------- */
  const [formData, setFormData] = useState<RegisterFormState>({
    name: "",
    username: "",
    email: "",
    pwd: "",
    confirmPassword: "",
  });

  const [loadingRegister, setLoading] = useState<boolean>(false);

  const navigate                     = useNavigate();
  const { userApi, loading, me }     = useCocolight();
  const { toast }                    = useToast();

  /* Redirige l’utilisateur déjà connecté ------------------------------- */
  useEffect(() => {
    if (!loading && me?.isConnected) navigate("/");
  }, [loading, me, navigate]);

  /* ------------------------------------------------------------------- */
  const handleInputChange = (
    field: keyof RegisterFormState,
    value: string,
  ): void => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /* ------------------------------------------------------------------- */
  const validateForm = (): boolean => {
    const { name, username, email, pwd, confirmPassword } = formData;

    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Le nom est requis",
      });
      return false;
    }
    if (!username.trim()) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Le nom d'utilisateur est requis",
      });
      return false;
    }
    if (!email || !isValidEmail(email)) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "L'adresse e-mail n'est pas valide",
      });
      return false;
    }
    if (!pwd || pwd.length < 6) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description:
          "Le mot de passe doit contenir au moins 6 caractères",
      });
      return false;
    }
    if (pwd !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
      });
      return false;
    }
    return true;
  };

  /* ------------------------------------------------------------------- */
  const handleRegister = async (): Promise<void> => {
    if (!validateForm()) return;

    setLoading(true);

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
          description:
            "Votre compte a été créé avec succès ! Vous pouvez maintenant vous connecter.",
        });
        navigate("/login");
      } else {
        toast({
          variant: "destructive",
          title: "Erreur",
          description:
            response.msg ||
            "Une erreur est survenue lors de la création du compte",
        });
      }
    } catch (err: unknown) {
      /* Extraction du message ------------------------------------------ */
      const msg =
        (err as { response?: { data?: { msg?: string } } }).response
          ?.data?.msg ||
        (err as Error).message ||
        "Une erreur est survenue lors de la création du compte";

      toast({
        variant: "destructive",
        title: "Erreur",
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------- */
  return (
    <div className="w-full space-y-6 p-8 rounded-lg bg-card shadow-lg border">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-2">
          Créer un compte
        </h2>
        <p className="text-muted-foreground">
          Rejoignez SiteForge dès aujourd'hui
        </p>
      </div>

      <div className="space-y-4">
        <Input
          type="text"
          placeholder="Nom complet"
          value={formData.name}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleInputChange("name", e.target.value)
          }
          className="h-12"
        />

        <Input
          type="text"
          placeholder="Nom d'utilisateur"
          value={formData.username}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleInputChange("username", e.target.value)
          }
          className="h-12"
        />

        <Input
          type="email"
          placeholder="Adresse e-mail"
          value={formData.email}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleInputChange("email", e.target.value)
          }
          className="h-12"
        />

        <PasswordToggleTextInput
          placeholder="Mot de passe"
          value={formData.pwd}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleInputChange("pwd", e.target.value)
          }
          className="h-12"
        />

        <PasswordToggleTextInput
          placeholder="Confirmer le mot de passe"
          value={formData.confirmPassword}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleInputChange("confirmPassword", e.target.value)
          }
          className="h-12"
        />

        <Button
          className="w-full"
          onClick={handleRegister}
          disabled={loadingRegister}
          variant="default"
          size="lg"
        >
          {loadingRegister
            ? "Création du compte..."
            : "Créer mon compte"}
        </Button>

        <div className="text-center space-y-2">
          <Button
            variant="ghost"
            onClick={() => navigate("/login")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Déjà un compte ? Se connecter
          </Button>

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
