import { Suspense, useState } from "react";
import { lazy } from "vite-preload";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useAuthModal } from "@/modules/auth";
import { AAC_QUERY_KEYS } from "../../constants/queryKeys";
import { useAacConfig } from "../../hooks/useAacConfig";

// Lazy : par chaîne d'imports STATIQUE, `CoFormModal` tire tout le runtime coform
// (SmartCoForm, DynamicCoForm, MultiStepCoForm, les FormFields, l'éditeur
// markdown) dans le chunk de l'annuaire — que l'immense majorité des visiteurs
// se contente de parcourir. Le montage conditionnel n'y change rien : seul le
// lazy sort ce poids du chunk. Précédent : `ToolsCatalog.tsx`.
// `lazy` vient de `vite-preload` (pas `React.lazy`) : c'est lui qui alimente
// `preloadAll()` et les `<link modulepreload>` du SSR.
const CoFormModal = lazy(() => import("@/modules/coform/components/CoFormModal"));

interface AacDepositButtonProps {
  /** Form parent de l'AAC — vient de `config.aac.formId`. */
  formId: string;
  /**
   * Étape de dépôt résolue (cf. `resolveAacDepositStepKey`). `null` ⇒ le
   * formulaire complet s'ouvre, ce qui reste préférable à un formulaire vide.
   */
  stepKey: string | null;
  /** Libellé du CTA. Défaut : i18n `directory.deposit.cta`. */
  label?: string;
}

/**
 * CTA « Je dépose un commun » — ouvre le formulaire de dépôt en modale.
 *
 * Trois partis pris :
 *
 *  - **le bouton est rendu inconditionnellement.** Sa présence ne dépend pas de
 *    `me`, donc le HTML SSR et le premier rendu client sont identiques (pas de
 *    flash d'hydratation) — et un visiteur déconnecté voit l'invitation à
 *    participer plutôt qu'une page sans issue. Le clic route vers le modal de
 *    connexion global, puis enchaîne tout seul sur le formulaire ;
 *  - **l'ouverture est DÉRIVÉE de `intent && me`**, elle n'est pas posée par le
 *    callback de connexion. `openLogin({ onSuccess })` rend la main avant que
 *    `me` n'ait été propagé : un `setOpen(true)` dans ce callback ouvrirait la
 *    modale sur une session pas encore établie. Exprimer l'ouverture comme une
 *    dérivation la fait survenir exactement au rendu où la session arrive —
 *    sans effet, donc sans rendu en cascade ;
 *  - **une seule étape est ouverte.** Les suivantes sont l'évaluation, le
 *    financement et le suivi, réservées à des rôles — un déposant n'a rien à y
 *    faire. C'est aussi le découpage du legacy (`getFirstStepOnly`).
 */
export function AacDepositButton({ formId, stepKey, label }: AacDepositButtonProps) {
  const t = useT("modules/aac");
  const { me } = useCocolight();
  const { openLogin } = useAuthModal();
  const queryClient = useQueryClient();
  const [intent, setIntent] = useState(false);

  const { config } = useAacConfig(formId);

  /**
   * Seule garde posée ici : l'AAC est-il ACTIF. C'est la seule condition de
   * dépôt réellement connue à ce stade, et elle vient du formulaire lui-même,
   * déjà chargé pour l'annuaire (même entrée de cache, aucune requête de plus).
   *
   * On n'appelle volontairement PAS `canCreateCommun` : ce calculateur croise
   * `onlyMemberAccess` avec `isCommunityMember`, et `oneAnswerPerPers` avec
   * `hasOwnCommun` — deux données dont on ne dispose pas ici. Les laisser à leur
   * défaut (`false`) transformerait un AAC réservé aux membres en refus pour
   * TOUT LE MONDE, ses membres compris. Le reste des conditions — appartenance,
   * fenêtre de dates, unicité de la réponse — est calculé côté serveur par
   * `Coform::getFormAccessInfo` et refusé au save, avec son motif exact.
   */
  const isClosed = config?.gates.active === false;

  // `intent` = « le visiteur a demandé à déposer » ; `me` = « la session est
  // prête ». L'état de la modale est le ET des deux.
  const open = intent && Boolean(me);

  const requestDeposit = () => {
    if (isClosed) {
      toast.error(String(t("directory.deposit.closed")));
      return;
    }
    if (me) {
      setIntent(true);
      return;
    }
    openLogin({ onSuccess: () => setIntent(true) });
  };

  /**
   * Le commun vient de naître : le listing, le décompte et les facettes sont
   * périmés. `useCoFormFinalMutation` n'invalide que les clés `coform` — la
   * passerelle vers les clés AAC doit être posée ici.
   *
   * Le nouveau commun remonte bien pour son auteur, même non sélectionné : la
   * restriction de visibilité de `splitAacFilters` est un `$or` qui inclut
   * `user: <moi>`. Il s'affiche avec le badge « En attente », jusqu'à ce qu'un
   * administrateur le sélectionne — et le médaillon « Communs déposés » le
   * compte, puisqu'il est calculé par le MÊME `splitAacFilters` que le listing.
   * Les trois clés, comme `CommunSelectionControl`.
   */
  const handleAfterSubmit = () => {
    queryClient.invalidateQueries({ queryKey: AAC_QUERY_KEYS.COMMUNS_PREFIX() });
    queryClient.invalidateQueries({ queryKey: AAC_QUERY_KEYS.COUNT_PREFIX() });
    queryClient.invalidateQueries({ queryKey: AAC_QUERY_KEYS.FACETS_PREFIX() });
  };

  return (
    <>
      <Button type="button" size="lg" className="rounded-full" onClick={requestDeposit}>
        <PlusCircle className="mr-2 h-4 w-4" aria-hidden="true" />
        {label || String(t("directory.deposit.cta"))}
      </Button>

      {open && (
        <Suspense fallback={null}>
          <CoFormModal
            formId={formId}
            open={open}
            onOpenChange={setIntent}
            title={String(t("directory.deposit.modalTitle"))}
            stepKey={stepKey ?? undefined}
            // Le formulaire est ouvert au PUBLIC : un encadré rouge « type
            // d'input introuvable » s'y lirait comme une panne du site. Les
            // champs non couverts restent annoncés, en placeholder neutre.
            unknownFieldVariant="placeholder"
            onAfterSubmit={handleAfterSubmit}
          />
        </Suspense>
      )}
    </>
  );
}

export default AacDepositButton;
