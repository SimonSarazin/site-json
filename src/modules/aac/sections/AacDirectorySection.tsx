// Side-effect : enregistre le namespace i18n "modules/aac" dès le chargement du
// chunk de la section (le point d'entrée section n'importe pas index.ts).
import "../i18n";

import { Suspense, useEffect } from "react";
import { cn } from "@/lib/utils";
import { allEmbedded } from "@/lib/variants";
import { useT } from "@/hooks/useT";
import { CommunDeleteDialog } from "../components/pageDetail/CommunDeleteDialog";
import { AacDirectorySkeleton } from "../components/directory/AacDirectorySkeleton";
import { AAC_DIRECTORY_SHELL_VARIANTS } from "../components/directory/variants/shells";
import { useAacDirectoryController } from "../hooks/useAacDirectoryController";
import type { AacDirectorySectionProps } from "../schema";

interface Props {
  id?: string;
  props: AacDirectorySectionProps;
}

/**
 * Annuaire des communs d'un AAC.
 *
 * Le `formId` vient de `config.aac.formId` (UN SEUL AAC par site) — jamais des
 * props de section, pour garder une source de vérité unique.
 *
 * Les OPTIONS des filtres viennent du vrai formulaire (`useAacFormMeta`) ; les
 * communs, de l'endpoint `directoryproposal` (cf. `communsTransport`).
 *
 * Logique dans `useAacDirectoryController`, disposition dans la coquille choisie
 * (`AAC_DIRECTORY_SHELL_VARIANTS`). La section garde l'absence de formulaire et le
 * dialogue de suppression.
 */
export default function AacDirectorySection({ id, props }: Props) {
  const t = useT("modules/aac");
  const vm = useAacDirectoryController(props);

  // Précharge la coquille pendant l'arrivée des communs (sans effet pour `default`).
  useEffect(() => {
    void AAC_DIRECTORY_SHELL_VARIANTS.preload(vm.shellVariant);
  }, [vm.shellVariant]);

  if (vm.status === "no-form") {
    return (
      <section id={id} className={cn("py-12", vm.className)}>
        <p className="text-center text-muted-foreground">{String(t("section.noForm"))}</p>
      </section>
    );
  }

  const Shell = AAC_DIRECTORY_SHELL_VARIANTS.get(vm.shellVariant);
  // eslint-disable-next-line react-hooks/static-components -- `Shell` vient d'un registre, il n'est pas créé ici.
  const shell = <Shell id={id} vm={vm} />;

  return (
    <>
      {/* Pas de frontière pour une coquille embarquée. */}
      {allEmbedded(Shell) ? (
        shell
      ) : (
        <Suspense
          fallback={
            <section id={id} className={cn("py-12", vm.className)}>
              <AacDirectorySkeleton display={vm.display.value} columns={vm.results.columns} />
            </section>
          }
        >
          {shell}
        </Suspense>
      )}

      <CommunDeleteDialog {...vm.deletion} />
    </>
  );
}
