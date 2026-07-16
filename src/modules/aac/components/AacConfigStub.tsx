// Side-effect : enregistre le namespace i18n "modules/aac" dès le chargement du
// chunk de la section (le point d'entrée section n'importe pas index.ts).
import "../i18n";

import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import { useAacConfig } from "../hooks/useAacConfig";
import type { AacGates } from "../types";
import type { AacSectionProps } from "../schema";

interface AacConfigStubProps {
  id?: string;
  props: AacSectionProps;
}

function gatesSummary(g: AacGates): string {
  const on = Object.entries(g)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
  return on.join(", ") || "—";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-md border p-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium wrap-break-word">{value}</dd>
    </div>
  );
}

/**
 * Section AAC — SOCLE (stub). Rend l'aperçu de la configuration résolue.
 *
 * Le `formId` vient de `config.aac.formId` (UN SEUL AAC par site, patron
 * `config.ampli` mais singulier) — pas des props de section.
 */
export default function AacConfigStub({ props }: AacConfigStubProps) {
  const t = useT("modules/aac");
  const { config: siteConfig } = useSite();
  const formId = siteConfig.aac?.formId ?? null;
  const { config, isLoading, error } = useAacConfig(formId);

  if (!formId) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        {t("section.noForm")}
      </div>
    );
  }

  return (
    <section className={props.className}>
      <h2 className="text-lg font-semibold">{t("section.stubTitle")}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("section.stubHint")}</p>

      {isLoading && <p className="text-sm text-muted-foreground">{t("section.loading")}</p>}
      {error && <p className="text-sm text-destructive">{t("section.error")}</p>}

      {config && (
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <Row
            label={t("config.steps")}
            value={config.steps.map((s) => s.key).join(", ") || t("config.none")}
          />
          <Row label={t("config.depenseStep")} value={config.roles.depenseStepKey ?? t("config.none")} />
          <Row label={t("config.evalStep")} value={config.roles.evalStepKey ?? t("config.none")} />
          <Row label={t("config.financementStep")} value={config.roles.financementStepKey ?? t("config.none")} />
          <Row label={t("config.suiviStep")} value={config.roles.suiviStepKey ?? t("config.none")} />
          <Row
            label={t("config.criteria")}
            value={config.criteria.map((c) => `${c.label}×${c.coeff}`).join(", ") || t("config.none")}
          />
          <Row label={t("config.criteriaSource")} value={config.criteriaSource} />
          <Row
            label={t("config.campaigns")}
            value={config.campaigns.map((c) => c.name || c.id).join(", ") || t("config.none")}
          />
          <Row label={t("config.gates")} value={gatesSummary(config.gates)} />
        </dl>
      )}
    </section>
  );
}
