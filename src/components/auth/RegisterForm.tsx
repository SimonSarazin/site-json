import React, {
  useState,
  useEffect,
  type ChangeEvent,
} from "react";

import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/components/auth/i18n";

import { useCocolight } from "@/hooks/useCocolight";
import PasswordToggleTextInput from "@/components/form/PasswordToggleTextInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidEmail } from "@/helpers/isValidEmail";
import { toast } from "sonner";
import { useNavigate } from "react-router";

interface RegisterFormState {
  name: string;
  username: string;
  email: string;
  pwd: string;
  confirmPassword: string;
}

export default function RegisterForm(): React.ReactNode {
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
  const { loaded }                   = useLoadNamespace("components/auth");
  const t                            = useT("components/auth");

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
      toast.error(t("Erreur"), {
        description: t("Le nom est requis"),
      });
      return false;
    }
    if (!username.trim()) {
      toast.error(t("Erreur"), {
        description: t("Le nom d'utilisateur est requis"),
      });
      return false;
    }
    if (!email || !isValidEmail(email)) {
      toast.error(t("Erreur"), {
        description: t("L'adresse e-mail n'est pas valide"),
      });
      return false;
    }
    if (!pwd || pwd.length < 6) {
      toast.error(t("Erreur"), {
        description: t("Le mot de passe doit contenir au moins 6 caractères"),
      });
      return false;
    }
    if (pwd !== confirmPassword) {
      toast.error(t("Erreur"), {
        description: t("Les mots de passe ne correspondent pas"),
      });
      return false;
    }
    return true;
  };

  /* ------------------------------------------------------------------- */
  const handleRegister = async (): Promise<void> => {

        // Si userApi n'est pas encore prêt, on arrête
    if (!userApi) {
      toast.error(t("Erreur"), {
        description: t("Impossible de se connecter pour le moment"),
      });
      setLoading(false);
      return;
    }

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
        toast.success(t("Succès"), {
          description: t(
            "Votre compte a été créé avec succès ! Vous pouvez maintenant vous connecter."
          ),
        });
        navigate("/login");
      } else {
        toast.error(t("Erreur"), {
          description:
            response.msg ||
            t("Une erreur est survenue lors de la création du compte"),
        });
      }
    } catch (err: unknown) {
      /* Extraction du message ------------------------------------------ */
      const msg =
        (err as { response?: { data?: { msg?: string } } }).response?.data?.msg ||
        (err as Error).message ||
        t("Une erreur est survenue lors de la création du compte");

      toast.error(t("Erreur"), {
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  }; 

  /* ------------------------------------------------------------------- */
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
          {t("Créer un compte")}
        </h2>
        <p className="text-muted-foreground">
          {t("Rejoignez SiteForge dès aujourd'hui")}
        </p>
      </div>

      <div className="space-y-4">
        <Input
          type="text"
          placeholder={t("Nom complet")}
          value={formData.name}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleInputChange("name", e.target.value)
          }
          className="h-12"
        />

        <Input
          type="text"
          placeholder={t("Nom d'utilisateur")}
          value={formData.username}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleInputChange("username", e.target.value)
          }
          className="h-12"
        />

        <Input
          type="email"
          placeholder={t("Adresse e-mail")}
          value={formData.email}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleInputChange("email", e.target.value)
          }
          className="h-12"
        />

        <PasswordToggleTextInput
          placeholder={t("Mot de passe")}
          value={formData.pwd}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleInputChange("pwd", e.target.value)
          }
          className="h-12"
        />

        <PasswordToggleTextInput
          placeholder={t("Confirmer le mot de passe")}
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
            ? t("Création du compte...")
            : t("Créer mon compte")}
        </Button>

        <div className="text-center space-y-2">
          <Button
            variant="ghost"
            onClick={() => navigate("/login")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("Déjà un compte ? Se connecter")}
          </Button>

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
