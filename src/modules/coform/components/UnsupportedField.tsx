import { Info } from "lucide-react";
import { useT } from "@/hooks/useT";

interface UnsupportedFieldProps {
  /** Libellé de la question, tel que défini côté formulaire. */
  label: string;
  /** Type CoForm brut, affiché seulement en variante `error`. */
  type: string;
  /**
   * `error` — encadré rouge `role="alert"` : un type non mappé est un DÉFAUT de
   * couverture, et le taire donnerait une perte de donnée silencieuse. C'est le
   * comportement par défaut, celui de tous les formulaires internes.
   *
   * `placeholder` — bloc neutre, sans alerte : réservé aux formulaires ouverts
   * au PUBLIC, où l'encadré rouge se lit comme une panne du site. Le champ reste
   * ANNONCÉ (son libellé garde sa place dans la lecture du formulaire) mais
   * n'est pas saisissable ici.
   */
  variant: "error" | "placeholder";
}

/**
 * Rendu d'un champ dont le type n'a pas de composant.
 *
 * ⚠️ Dans les deux variantes, le champ n'est pas dans le schéma Zod : sa valeur
 * n'est donc **pas** envoyée au save. Sur une CRÉATION c'est sans conséquence
 * (il n'y a rien à écraser) ; sur une ÉDITION la valeur existante est perdue.
 * C'est la raison pour laquelle la variante `placeholder` doit rester réservée
 * aux surfaces de création.
 */
export function UnsupportedField({ label, type, variant }: UnsupportedFieldProps) {
  const t = useT("modules/coform");

  if (variant === "placeholder") {
    return (
      <div className="col-span-12 flex flex-col gap-1 rounded-md border border-dashed bg-muted/30 px-4 py-3">
        <p className="text-sm font-medium">{label}</p>
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {String(t("coform.errors.unsupportedFieldPlaceholder"))}
        </p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="col-span-12 flex flex-col gap-1 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <p className="font-semibold">{label}</p>
      <p>{t("coform.errors.unknownFieldType", undefined, { type })}</p>
    </div>
  );
}

export default UnsupportedField;
