import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_NAME_MAX_LENGTH } from "@/modules/kanban/lib/roles";
import { checkRoleName, type RoleNameProblem } from "./rolesBoard";

export interface RoleComposerProps {
  /** Libellés des colonnes existantes : un doublon est refusé avant l'appel. */
  existing: readonly string[];
  onCreate: (role: string) => void;
  /** Ferme le composeur ; l'appelant rend le focus au bouton « + Ajouter un rôle ». */
  onClose: () => void;
}

/**
 * Composeur « + Ajouter un rôle » (D29) : un champ, une validation AVANT l'appel
 * (`checkRoleName` : vide, trop long, caractère interdit, doublon — le message sous le champ),
 * Entrée crée, Échap ferme.
 *
 * On crée rarement un seul rôle : après une création, le champ se vide et garde le focus pour
 * enchaîner, la colonne venant d'apparaître juste à côté (optimiste).
 */
export function RoleComposer({ existing, onCreate, onClose }: RoleComposerProps) {
  const { t } = useTranslation("modules/kanban");
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const [value, setValue] = useState("");
  const [problem, setProblem] = useState<{ kind: RoleNameProblem; name: string } | null>(null);
  const error = problem === null ? undefined : t(`views.roles.errors.${problem.kind}`, { max: ROLE_NAME_MAX_LENGTH, role: problem.name });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const check = checkRoleName(value, existing);
    if (!check.ok) {
      setProblem({ kind: check.problem, name: check.name });
      return;
    }
    onCreate(check.name);
    setValue("");
    setProblem(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    // `stopPropagation` : Échap ne ferme QUE le composeur, pas une couche au-dessus.
    event.stopPropagation();
    onClose();
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={onKeyDown}
      aria-label={t("views.roles.addRole")}
      // Le même cadre que la colonne qu'il va créer : pointillé (un emplacement), remplissage translucide.
      className="flex flex-col gap-3 rounded-2xl border border-dashed border-[var(--ck-border-strong)] bg-[var(--ck-column-fill)] p-[var(--ck-column-padding)]"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId}>
          {t("views.roles.roleName")}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </Label>
        <Input
          id={fieldId}
          value={value}
          // Le composeur remplace son bouton : sans ce focus, le clavier se retrouverait sur une
          // commande qui vient de disparaître.
          autoFocus
          // `aria-required` et non `required` : la case native bloquerait l'envoi par sa propre
          // bulle, et la validation du composeur (vide, trop long, doublon) ne dirait plus rien.
          aria-required="true"
          autoComplete="off"
          aria-invalid={problem !== null}
          aria-describedby={error ? errorId : undefined}
          placeholder={t("views.roles.roleNamePlaceholder")}
          onChange={(event) => {
            setValue(event.target.value);
            // Le refus ne colle pas au champ : la frappe suivante repart propre.
            if (problem !== null) setProblem(null);
          }}
        />
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm">
          <Plus aria-hidden />
          {t("views.roles.create")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
