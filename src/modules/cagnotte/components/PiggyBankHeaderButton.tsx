import { PiggyBank } from "lucide-react";
import CagnotteDialog from "./CagnotteDialog";
import { useFundingEnvelope } from "../hooks/useFundingEnvelope";
import { useCocolight } from "@/hooks/useCocolight";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";

/**
 * Bouton "piggy-bank" affiché dans le header d'un site (ex. `HeaderRezoLaMer`).
 *
 * Le composant lit lui-même sa config depuis `entity.preferences.projectModalId`
 * (source de vérité définie par l'admin orga via la dialog cagnotte) — le header
 * n'a pas à connaître ce détail du module.
 *
 * Stratégie d'affichage du montant :
 *  - Consomme `useFundingEnvelope(projectModalId)` — la même source que les
 *    sections `FinanceSection` / `ActionsSection`. Le montant `totalFinancement`
 *    vient du backend (champ pré-calculé dans `entity.fundingEnvelope()`), pas
 *    d'un calcul frontend sur l'answer raw (qui retourne souvent 0 car les
 *    `depense.financer[].amount` ne sont pas remplis dans l'answer brute).
 *  - Si `projectModalId` est défini → `envelope.selectedProject` pointe dessus.
 *  - Sinon → fallback sur `envelope.projects[0]`, cohérent avec le comportement
 *    de `CagnotteDialog` qui auto-sélectionne le 1er projet (cf. `CagnotteDialog.tsx`
 *    L167-179).
 *
 * Le cache React Query est partagé avec `CagnotteDialog` (même queryKey
 * `FUNDING_ENVELOPE` si même `entityId` + `projectId`) → 0 fetch supplémentaire
 * à l'ouverture de la dialog.
 */
export function PiggyBankHeaderButton() {
  const { entity, me } = useCocolight();

  // `useReactiveProperty` réagit aux mutations live de l'admin sur `preferences`
  // (cf. CagnotteDialog → setProjectModalId). L'accès passe par `entity.serverData`
  // (getter public du SDK Cocolight) — voir memory `[Cocolight Entity → serverData]`.
  const preferencesData = useReactiveProperty<Record<string, unknown>>(entity?.serverData, 'preferences');
  const projectModalId = (preferencesData?.projectModalId as string | undefined) || null;

  const { data: envelope, refetch } = useFundingEnvelope(projectModalId || undefined);

  // La cagnotte est un feature member-only : on ne fetche pas tant que `me` n'est pas
  // chargé (cf. `useFundingEnvelope` enabled) et on n'affiche pas le bouton non plus,
  // sinon l'utilisateur verrait "0 €" + une dialog vide qui ne sert à rien sans login.
  if (!me?.id) return null;

  // `selectedProject` est null si `projectModalId` est vide → fallback sur le
  // 1er projet (cohérent avec l'auto-sélection de `CagnotteDialog`).
  const targetProject = envelope?.selectedProject ?? envelope?.projects?.[0] ?? null;
  const piggyAmount = targetProject?.totalFinancement ?? 0;

  const refresh = async () => { await refetch(); };

  return (
    <CagnotteDialog
      totalAmount={piggyAmount}
      defaultProjectId={projectModalId || targetProject?.id || undefined}
      onRefresh={refresh}
    >
      <button
        key={piggyAmount}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 hover:bg-primary/30 text-primary transition-all group"
        aria-label="Cagnotte participative"
      >
        <PiggyBank className="w-5 h-5 group-hover:scale-110 transition-transform" />
        <span className="font-semibold text-sm">{piggyAmount.toLocaleString("fr-FR")} €</span>
      </button>
    </CagnotteDialog>
  );
}

export default PiggyBankHeaderButton;
