import { Suspense } from "react";
import { lazy } from "vite-preload";
import { useHydrated } from "@/hooks/useHydrated";

/**
 * Wrappers lazy des deux boutons cagnotte du header — le drop-in des headers,
 * sur le modèle de `NotificationBell`.
 *
 * Les headers sont eux-mêmes des chunks `lazy()` préchargés sur CHAQUE page.
 * Un import statique de `PiggyBankHeaderButton` / `PledgeHeaderButton` y
 * embarquait la fermeture complète du module cagnotte (CagnotteDialog et ses
 * parts, adaptateur, permissions, bundles i18n… ~35 fichiers) pour TOUS les
 * sites, y compris ceux qui n'activent ni `piggyBank` ni `pledge` : le `&&` du
 * header n'empêche pas un import statique d'être téléchargé, parsé et exécuté.
 *
 * Ici le code n'est **téléchargé que lorsque le wrapper est rendu**, c.-à-d.
 * uniquement sur les sites où `header.utilities.piggyBank` / `.pledge` est
 * activé. Le gate `useHydrated` évite de déclencher l'import côté SSR : les
 * deux boutons sont member-only (`if (!me?.id) return null`) et n'ont de toute
 * façon rien à rendre au SSR — c'est le même rôle que jouait `ClientOnly`
 * autour d'eux, désormais inutile.
 *
 * Les headers les appellent via
 * `{header.utilities?.piggyBank && <PiggyBankHeaderButton />}`.
 */
const PiggyBankHeaderButtonImpl = lazy(() => import("@/modules/cagnotte/components/PiggyBankHeaderButton"));
const PledgeHeaderButtonImpl = lazy(() => import("@/modules/cagnotte/components/PledgeHeaderButton"));

export function PiggyBankHeaderButton() {
  const hydrated = useHydrated();
  if (!hydrated) return null;

  return (
    <Suspense fallback={null}>
      <PiggyBankHeaderButtonImpl />
    </Suspense>
  );
}

export function PledgeHeaderButton() {
  const hydrated = useHydrated();
  if (!hydrated) return null;

  return (
    <Suspense fallback={null}>
      <PledgeHeaderButtonImpl />
    </Suspense>
  );
}
