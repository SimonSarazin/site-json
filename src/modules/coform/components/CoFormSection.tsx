/**
 * Section CoForm embarquable dans une page site-json.
 *
 * Branchée via `SectionPropsMap` (`type: "coform"`) — voir `src/types/site-schema.ts`
 * + `src/components/sections/SectionRenderer.tsx`.
 *
 * Wrap `SmartCoForm` avec un titre/description optionnels (passés en props depuis
 * le JSON config), gère l'auto-redirection après soumission.
 */
import { useNavigate } from "react-router";
import { useLocalization } from "@/hooks/useLocalization";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { CoFormSection as CoFormSectionType } from "../schema";
import { SmartCoForm } from "./SmartCoForm";

interface CoFormSectionProps {
  id?: string;
  props: CoFormSectionType["props"];
}

export default function CoFormSection({ id, props }: CoFormSectionProps) {
  void id;
  useLoadNamespace("modules/coform");
  const { t } = useLocalization();
  const navigate = useNavigate();

  const title = props.title ? t(props.title) : undefined;
  const description = props.description ? t(props.description) : undefined;

  const handleAfterSubmit = () => {
    if (props.redirectAfterSubmit) {
      navigate(props.redirectAfterSubmit);
    }
  };

  return (
    <section className={props.className ?? "container mx-auto px-4 py-8"}>
      {title && (
        <header className="mb-6 text-center">
          <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="mt-2 text-muted-foreground">{description}</p>
          )}
        </header>
      )}
      <SmartCoForm
        formId={props.formId}
        forceMultiStep={props.variant === "wizard"}
        forceSingleStep={props.variant === "default"}
        onAfterSubmit={props.redirectAfterSubmit ? handleAfterSubmit : undefined}
      />
    </section>
  );
}
