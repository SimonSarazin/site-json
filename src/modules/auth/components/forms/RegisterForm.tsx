import React, {
  useState,
  useEffect,
  type ChangeEvent,
} from "react";

import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useSite } from "@/hooks/useSite";
import "@/modules/auth/i18n";

import { useCocolight } from "@/hooks/useCocolight";
import PasswordToggleTextInput from "@/components/form/PasswordToggleTextInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidEmail } from "@/helpers/isValidEmail";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router";
import { returnToOrHome } from "@/lib/authRedirect";

interface RegisterFormState {
  name: string;
  username: string;
  email: string;
  pwd: string;
  confirmPassword: string;
}

interface RegisterFormProps {
  // Mode modal : bascule vers le login interne au lieu de naviguer vers /login.
  onSwitchToLogin?: () => void;
  /**
   * Valeurs pré-remplies (flux d'invitation) : l'invité arrive avec son `email` (celui de son compte
   * `pending`) et son `name`. L'`email` est rendu `readOnly` — CONFORT UX (éviter une faute de frappe
   * qui créerait un compte neuf), PAS une frontière de sécurité : le backend finalise le compte pending
   * PAR EMAIL seul (`getPendingUserByEmail` → `updateMinimalData`, parité legacy, sans validationKey).
   * Le durcissement (lier la finalisation à la clé) est une décision de mode clean — cf. BUG-L-228.
   */
  prefill?: { email?: string; name?: string };
}

export default function RegisterForm({ onSwitchToLogin, prefill }: RegisterFormProps = {}): React.ReactNode {
  /* ------------------------------------------------------------------- */
  const [formData, setFormData] = useState<RegisterFormState>({
    name: prefill?.name ?? "",
    username: "",
    email: prefill?.email ?? "",
    pwd: "",
    confirmPassword: "",
  });

  const [loadingRegister, setLoading] = useState<boolean>(false);

  const navigate                     = useNavigate();
  const location                     = useLocation();
  // Destination transmise depuis LoginForm quand l'utilisateur bascule « créer un compte »
  // (elle-même posée par la garde de page). Repli sur l'accueil.
  const returnTo                     = returnToOrHome(location.state);
  const { userApi, loading, me, entity, contextId, contextType } = useCocolight();
  const { loaded }                   = useLoadNamespace("modules/auth");
  const t                            = useT("modules/auth");
  const { config }                   = useSite();

  const registerTitle = config.auth?.register?.title || { fr: "Créer un compte", en: "Create an account" };
  // Défaut NEUTRE : « SiteForge » est le nom du générateur, il ne doit jamais
  // fuiter sur un site — chaque site personnalise via config.auth.register.
  const registerSubtitle = config.auth?.register?.subtitle || { fr: "Rejoignez-nous dès aujourd'hui", en: "Join us today" };

  /* Redirige l’utilisateur déjà connecté ------------------------------- */
  useEffect(() => {
    if (!loading && me?.isConnected) navigate(returnTo);
  }, [loading, me, navigate, returnTo]);

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

      // Contexte costum du déploiement → le backend estampille `source.key` du citoyen (port Person::insert,
      // legacy : inscription sous un costum actif). Slug/id/type de l'entité porteuse (résolue de VITE_SLUG au boot).
      const deploymentSlug = (entity?.serverData as { slug?: string } | undefined)?.slug;
      const costumCtx = deploymentSlug && contextId && contextType
        ? { costumSlug: deploymentSlug, costumId: contextId, costumType: contextType }
        : {};

      const response = await userApi.register({
        name,
        username,
        email,
        pwd,
        ...costumCtx,
      });

      if (response.result) {
        toast.success(t("Succès"), {
          description: t(
            "Votre compte a été créé avec succès ! Vous pouvez maintenant vous connecter."
          ),
        });
        if (onSwitchToLogin) onSwitchToLogin();
        else navigate("/login", { state: location.state });
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
    <div className="w-full space-y-6 p-4 rounded-lg bg-card">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-foreground mb-2">
          {t(registerTitle)}
        </h2>
        <p className="text-muted-foreground">
          {t(registerSubtitle)}
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleRegister();
        }}
      >
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
          readOnly={!!prefill?.email}
          aria-readonly={!!prefill?.email}
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
          type="submit"
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
            type="button"
            variant="ghost"
            onClick={() => (onSwitchToLogin ? onSwitchToLogin() : navigate("/login", { state: location.state }))}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("Déjà un compte ? Se connecter")}
          </Button>

          {/* "Retour à l'accueil" : sans objet en modal (la croix ferme). */}
          {!onSwitchToLogin && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/")}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t("Retour à l'accueil")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
