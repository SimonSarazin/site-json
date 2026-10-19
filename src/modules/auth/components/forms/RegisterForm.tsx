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
import { getSiteCostumContext } from "@/lib/siteCostum";
import PasswordToggleTextInput from "@/components/form/PasswordToggleTextInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isValidEmail } from "@/helpers/isValidEmail";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router";
import { returnToOrHome } from "@/lib/authRedirect";
import type { RegisterFieldConfig } from "../../schema";
import {
  collectRegisterFields,
  firstMissingRequiredField,
  registerWithExtras,
  visibleRegisterFields,
} from "../../lib/registerExtras";

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

// Même habillage que `Input` (components/ui/input) pour un `<select>` NATIF : le formulaire est à état
// local (pas react-hook-form), le natif est accessible au clavier et sur mobile sans portail, et il se
// pilote dans un test par `selectOptions` — ce que le Select Radix du projet ne permet pas en jsdom.
const SELECT_CLASS =
  "border-input h-12 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30";

export default function RegisterForm({ onSwitchToLogin, prefill }: RegisterFormProps = {}): React.ReactNode {
  /* ------------------------------------------------------------------- */
  const [formData, setFormData] = useState<RegisterFormState>({
    name: prefill?.name ?? "",
    username: "",
    email: prefill?.email ?? "",
    pwd: "",
    confirmPassword: "",
  });
  // Champs SUPPLÉMENTAIRES déclarés par `config.auth.register.fields` (docs/33) — valeurs par `name`.
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});

  const [loadingRegister, setLoading] = useState<boolean>(false);

  const navigate                     = useNavigate();
  const location                     = useLocation();
  // Destination transmise depuis LoginForm quand l'utilisateur bascule « créer un compte »
  // (elle-même posée par la garde de page). Repli sur l'accueil.
  const returnTo                     = returnToOrHome(location.state);
  const { userApi, loading, me, contextId, contextType } = useCocolight();
  const { loaded }                   = useLoadNamespace("modules/auth");
  const t                            = useT("modules/auth");
  const { config }                   = useSite();

  const registerConfig = config.auth?.register;
  const registerTitle = registerConfig?.title || { fr: "Créer un compte", en: "Create an account" };
  // Défaut NEUTRE : « SiteForge » est le nom du générateur, il ne doit jamais
  // fuiter sur un site — chaque site personnalise via config.auth.register.
  const registerSubtitle = registerConfig?.subtitle || { fr: "Rejoignez-nous dès aujourd'hui", en: "Join us today" };
  const registerMode = registerConfig?.mode;
  const extraFields = registerConfig?.fields;
  const visibleExtraFields = visibleRegisterFields(extraFields, extraValues);

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
  const handleExtraChange = (name: string, value: string): void => {
    setExtraValues((prev) => ({ ...prev, [name]: value }));
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
    // Champs supplémentaires : `required` ne vaut que pour un champ VISIBLE (showIf).
    const missing = firstMissingRequiredField(extraFields, extraValues);
    if (missing) {
      toast.error(t("Erreur"), {
        description: t("Le champ « {{field}} » est requis", undefined, { field: t(missing.label) }),
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
      // legacy : inscription sous un costum actif) ET brande l'e-mail de bienvenue (sujet, logo,
      // expéditeur, domaine des liens = `costum.host`).
      // Le slug vient de `getSlug()` (VITE_SLUG), PAS de `entity.serverData.slug` : même valeur en
      // régime nominal, mais indépendante du réseau. Si `entityBySlug` a échoué au boot, `entity` est
      // `null` et le trio disparaissait EN SILENCE — mail générique « Communecter », sans trace.
      // Seuls `costumId`/`costumType` restent conditionnés à la résolution : le legacy résout son
      // cache costum sur le SLUG, ils ne sont qu'un confort. Même source que ContactFormSection.
      const costumCtx = getSiteCostumContext({ contextId, contextType }) ?? {};

      // `fields` : seulement les valeurs non vides des champs visibles — validés côté serveur par la
      // règle costum des citoyens (un champ hors règle → `Contenu Invalide <clé> : Person`).
      const response = await registerWithExtras(userApi, {
        name,
        username,
        email,
        pwd,
        ...costumCtx,
        mode: registerMode,
        fields: collectRegisterFields(extraFields, extraValues),
      });

      if (response.result) {
        // Le texte dépend du MODE : en `single_step_register` le compte est actif tout de suite ; en
        // `normal` (défaut) la connexion est REFUSÉE tant que l'e-mail n'est pas validé — l'ancien
        // toast (« vous pouvez maintenant vous connecter ») était faux dans ce cas.
        toast.success(t("Succès"), {
          description: registerMode === "single_step_register"
            ? t("Votre compte a été créé avec succès ! Vous pouvez maintenant vous connecter.")
            : t("Votre compte a été créé. Vous pourrez vous connecter dès que vous aurez validé votre adresse e-mail (un message vient de vous être envoyé)."),
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
  // Pas de `required` NATIF sur ces contrôles : la validation est celle du formulaire (toasts, comme les
  // champs standards) — l'attribut HTML ferait bloquer la soumission par le navigateur AVANT nos messages.
  const renderExtraField = (field: RegisterFieldConfig): React.ReactNode => {
    const id = `register-field-${field.name}`;
    const value = extraValues[field.name] ?? "";
    const label = t(field.label);
    const placeholder = field.placeholder ? t(field.placeholder) : undefined;
    let control: React.ReactNode;
    if (field.widget === "select") {
      control = (
        <select
          id={id}
          name={field.name}
          className={SELECT_CLASS}
          value={value}
          aria-required={field.required}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => handleExtraChange(field.name, e.target.value)}
        >
          <option value="">{placeholder ?? t("Sélectionnez une option")}</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{t(o.label)}</option>
          ))}
        </select>
      );
    } else if (field.widget === "textarea") {
      control = (
        <Textarea
          id={id}
          name={field.name}
          placeholder={placeholder ?? label}
          value={value}
          aria-required={field.required}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleExtraChange(field.name, e.target.value)}
        />
      );
    } else {
      control = (
        <Input
          id={id}
          name={field.name}
          type="text"
          placeholder={placeholder ?? label}
          value={value}
          aria-required={field.required}
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleExtraChange(field.name, e.target.value)}
          className="h-12"
        />
      );
    }
    return (
      <div key={field.name} className="space-y-2">
        <Label htmlFor={id}>
          {label}
          {field.required && <span className="text-destructive ml-1" aria-hidden>*</span>}
        </Label>
        {control}
      </div>
    );
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

        {/* Champs supplémentaires du site (config.auth.register.fields), après les champs standards. */}
        {visibleExtraFields.map(renderExtraField)}

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
