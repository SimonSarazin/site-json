import { lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import type { JsonFormModalConfig } from "@/types/site-schema";
import type { LocalizedString } from "@/types/locale-schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoginPrompt } from "@/modules/auth";
import { useAuthActions } from "@/modules/auth/hooks/useAuthActions";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useSite } from "@/hooks/useSite";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
  formConfig?: JsonFormModalConfig;
}

const modalRegistry: Record<string, () => Promise<{ default: ComponentType<ModalProps> }>> = {
  "add-organization": () => Promise.all([import("../../forms/EntityFormModal"), import("../../forms/configs/addStandard")]).then(([m, c]) => ({
    default: (props: ModalProps) => <m.EntityFormModal config={c.addOrganizationConfig} open={props.open} onOpenChange={props.onOpenChange} mode="add" parent={props.parent} />,
  })),
  "add-project": () => Promise.all([import("../../forms/EntityFormModal"), import("../../forms/configs/addStandard")]).then(([m, c]) => ({
    default: (props: ModalProps) => <m.EntityFormModal config={c.addProjectConfig} open={props.open} onOpenChange={props.onOpenChange} mode="add" parent={props.parent} />,
  })),
  "add-event": () => Promise.all([import("../../forms/EntityFormModal"), import("../../forms/configs/addStandard")]).then(([m, c]) => ({
    default: (props: ModalProps) => <m.EntityFormModal config={c.addEventConfig} open={props.open} onOpenChange={props.onOpenChange} mode="add" parent={props.parent} />,
  })),
  "add-poi": () => Promise.all([import("../../forms/EntityFormModal"), import("../../forms/configs/addStandard")]).then(([m, c]) => ({
    default: (props: ModalProps) => <m.EntityFormModal config={c.addPoiConfig} open={props.open} onOpenChange={props.onOpenChange} mode="add" parent={props.parent} />,
  })),
  // add-equipements-sportifs / add-tiers-lieux : résolus DYNAMIQUEMENT par la table runtime costum (cf.
  // costumModalThunk) — id = identité costum. Permet aussi les costums de config (config.costumForms) sans entrée ici.
};

/** Résolveur DYNAMIQUE des modales d'AJOUT costum : `add-<id>` → spec de la table runtime (TS connu OU config JSON). */
function costumModalThunk(modalName: string): (() => Promise<{ default: ComponentType<ModalProps> }>) | undefined {
  const m = /^add-(.+)$/.exec(modalName);
  if (!m) return undefined;
  const id = m[1];
  return () => Promise.all([import("../../forms/EntityFormModal"), import("../../forms/costum/registerCostumForms")]).then(([mod, reg]) => {
    const spec = reg.getCostumModalSpec(id);
    return {
      default: (props: ModalProps) =>
        spec ? <mod.EntityFormModal spec={spec} open={props.open} onOpenChange={props.onOpenChange} mode="add" parent={props.parent} /> : null,
    };
  });
}

const lazyComponents: Record<string, ComponentType<ModalProps>> = {};

/** Textes surchargeables de l'invite — clé i18n OU `LocalizedString` inline. */
interface AuthPromptTexts {
  title?: string | LocalizedString;
  description?: string | LocalizedString;
}

/** Référence stable pour « aucune surcharge » : un littéral recréé à chaque
 *  rendu changerait la prop `texts` et rerendrait l'invite pour rien. */
const NO_AUTH_PROMPT: AuthPromptTexts = {};

/**
 * Textes de l'invite déclarés par le formulaire costum, sous
 * `costumForms.<id>.chrome.authPrompt`.
 *
 * Lu depuis la config du SITE et non depuis le module du formulaire : le garde
 * s'exécute justement pour éviter de charger ce module à un visiteur. `chrome`
 * est déjà `.passthrough()` au schéma costum, et accepte indifféremment une clé
 * i18n ou un `{fr, en}` inline — `useT` route selon le type.
 *
 * L'invite appartient au FORMULAIRE, pas au bouton qui l'ouvre : la même modale
 * s'ouvre depuis un bouton flottant, un bouton « créer » de recherche ou un
 * profil, et le message doit y être identique.
 */
function useAuthPromptTexts(modalName: string): AuthPromptTexts {
  const { config } = useSite();
  const id = /^add-(.+)$/.exec(modalName)?.[1];
  if (!id) return NO_AUTH_PROMPT;
  const forms = config.costumForms as Record<string, unknown> | undefined;
  const chrome = (forms?.[id] as { chrome?: { authPrompt?: AuthPromptTexts } } | undefined)?.chrome;
  return chrome?.authPrompt ?? NO_AUTH_PROMPT;
}

/**
 * Substitut de la modale d'ajout pour un visiteur non connecté : une invite de
 * connexion à la place du formulaire, dans le même contenant.
 *
 * Deux niveaux de texte seulement — un titre et une phrase. Le `LoginPrompt`
 * n'en porte pas de troisième : sans `message`, sa variante `card` se réduit à
 * l'icône et au bouton, ce qui suffit une fois la raison déjà énoncée au-dessus.
 *
 * Pas de `onSuccess` à passer : la connexion rafraîchit `me`, `isConnected`
 * bascule, et `DynamicModal` rend le formulaire à la place de cette invite sans
 * que l'ouverture n'ait été refermée.
 */
function AuthRequiredDialog({
  open,
  onOpenChange,
  texts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  texts: AuthPromptTexts;
}) {
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(texts.title ?? "AuthRequired.title")}</DialogTitle>
          <DialogDescription>
            {t(texts.description ?? "AuthRequired.description")}
          </DialogDescription>
        </DialogHeader>
        <LoginPrompt variant="card" />
      </DialogContent>
    </Dialog>
  );
}

function ensureLazyModal(modalName: string): void {
  const thunk = modalRegistry[modalName] ?? costumModalThunk(modalName);
  if (!thunk) {
    console.log(`Modal "${modalName}" not found in registry`);
    return;
  }
  if (!lazyComponents[modalName]) {
    lazyComponents[modalName] = lazy(thunk);
  }
}

export function DynamicModal({
  modalName,
  open,
  onOpenChange,
  parent,
  formConfig,
}: {
  modalName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
  formConfig?: JsonFormModalConfig;
}) {
  ensureLazyModal(modalName);
  const ModalComponent = lazyComponents[modalName];
  const { isConnected } = useAuthActions();
  const authPromptTexts = useAuthPromptTexts(modalName);

  if (!ModalComponent) {
    return null;
  }

  // Garde d'authentification — toutes les modales de ce registre sont des
  // modales d'AJOUT (clés `add-*`), et `runEntityMutation` crée sur `me` :
  // sans session elle lève « No entity provided ». Sans ce garde, un visiteur
  // remplissait le formulaire entier avant de récolter un toast d'erreur
  // technique. On l'invite à se connecter AVANT la saisie ; une fois connecté,
  // `isConnected` bascule et le formulaire prend la place de l'invite, à la
  // même ouverture — rien n'est perdu.
  //
  // Testé sur `open` : en SSR et au repos `open` vaut false, donc cette branche
  // ne s'évalue jamais côté serveur et n'introduit aucune divergence
  // d'hydratation (cf. gotcha #10).
  if (open && !isConnected) {
    return <AuthRequiredDialog open onOpenChange={onOpenChange} texts={authPromptTexts} />;
  }

  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ModalComponent open={open} onOpenChange={onOpenChange} parent={parent} formConfig={formConfig} />
    </Suspense>
  );
}
