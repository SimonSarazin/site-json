import { TabsList } from "@/components/ui/tabs";

/**
 * `TabsList` défilable horizontalement — fix mobile du module admin (audit responsive).
 *
 * La primitive shadcn (`inline-flex w-fit` + triggers `whitespace-nowrap`) ne wrappe NI ne
 * scrolle : au-delà de la largeur du viewport, les onglets débordent et élargissent le body
 * (mesuré : +256px à 390px sur la barre à 6 onglets). Le wrapper `overflow-x-auto` fait
 * défiler la barre au doigt sans rien perdre ; `w-max` garde la TabsList à sa largeur
 * naturelle (sinon elle se compresse au lieu de défiler).
 */
export function ScrollableTabsList({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <TabsList className="w-max">{children}</TabsList>
    </div>
  );
}
