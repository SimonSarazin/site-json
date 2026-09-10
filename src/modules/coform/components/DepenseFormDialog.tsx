import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import {
  milestoneCreateFormSchema,
  type MilestoneCreateFormData,
} from "@/modules/cagnotte/schemaForm";
import "../i18n/i18n";

export interface DepenseFormValues {
  name: string;
  description: string;
  targetAmount: number;
}

const VIDE: MilestoneCreateFormData = { name: "", description: "", targetAmount: 0 };

/** Valeurs de départ du formulaire : celles de la ligne en modification, sinon vides. */
function valeursDeDepart(initial: DepenseFormValues | undefined): MilestoneCreateFormData {
  return initial
    ? { name: initial.name, description: initial.description, targetAmount: initial.targetAmount }
    : VIDE;
}

/**
 * Saisie d'une dépense — **le même dialogue sert l'ajout ET la modification**.
 *
 * Il ne persiste RIEN : il valide et rend les valeurs au champ, qui les applique
 * à la valeur react-hook-form. C'est ce qui permet d'ajouter une dépense sur une
 * réponse pas encore enregistrée, et ce qui donne un chemin d'écriture unique
 * quel que soit le geste.
 *
 * À distinguer de `CreateMilestoneDialog` (module cagnotte), qui appelle la
 * mutation serveur `useCreateMilestone` et exige donc un `answerId` : c'est
 * précisément ce couplage qu'on ne veut pas ici. La VALIDATION reste partagée
 * (`milestoneCreateFormSchema`) — seule la persistance diffère.
 */
export function DepenseFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  inputIdPrefix = "depense",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Valeurs de départ — présentes en modification, absentes en ajout. */
  initial?: DepenseFormValues;
  onSubmit: (values: DepenseFormValues) => void;
  inputIdPrefix?: string;
}) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");

  const modeEdition = initial !== undefined;
  const form = useForm<MilestoneCreateFormData>({
    resolver: zodResolver(milestoneCreateFormSchema),
    // Figées au MONTAGE : le champ monte le dialogue à l'ouverture.
    defaultValues: valeursDeDepart(initial),
  });

  // Le dialogue peut aussi être rouvert sur une AUTRE ligne sans démontage : on
  // resème à chaque OUVERTURE — et seulement là. `initial` est lu par une ref
  // (mise à jour dans un effet, pas pendant le rendu — cf. react-hooks/refs) :
  // le champ appelant reconstruit `initial` en littéral à chaque rendu, et ses
  // rendus ne dépendent pas de l'utilisateur (deux sources react-query vives,
  // `useWatch` du formulaire hôte). Faire dépendre l'effet de l'objet rejouait
  // `form.reset` sous les doigts de l'utilisateur : le montant repassait à sa
  // valeur d'origine en pleine saisie, sans message.
  const initialRef = useRef(initial);
  useEffect(() => {
    initialRef.current = initial;
  }, [initial]);
  useEffect(() => {
    if (!open) return;
    form.reset(valeursDeDepart(initialRef.current));
  }, [open, form]);

  const soumettre = form.handleSubmit((values) => {
    onSubmit({
      name: values.name.trim(),
      description: values.description,
      targetAmount: values.targetAmount,
    });
    onOpenChange(false);
  });

  const idNom = `${inputIdPrefix}-nom`;
  const idDesc = `${inputIdPrefix}-description`;
  const idMontant = `${inputIdPrefix}-montant`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {modeEdition
              ? t("coform.depense.editTitle", "Modifier la dépense")
              : t("coform.depense.addTitle", "Ajouter une dépense")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "coform.depense.dialogDescription",
              "Les dépenses sont enregistrées avec votre réponse.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor={idNom}>{t("coform.depense.name", "Intitulé")}</Label>
            <Input
              id={idNom}
              autoFocus
              aria-invalid={!!form.formState.errors.name || undefined}
              aria-describedby={form.formState.errors.name ? `${idNom}-error` : undefined}
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p id={`${idNom}-error`} role="alert" className="text-xs text-destructive">
                {t("coform.depense.nameRequired", "L'intitulé est requis")}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={idDesc}>{t("coform.depense.description", "Description")}</Label>
            <Textarea id={idDesc} rows={3} {...form.register("description")} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={idMontant}>{t("coform.depense.amount", "Montant cible")}</Label>
            <Input
              id={idMontant}
              type="number"
              min={0}
              inputMode="numeric"
              aria-invalid={!!form.formState.errors.targetAmount || undefined}
              {...form.register("targetAmount", { valueAsNumber: true })}
            />
            {form.formState.errors.targetAmount && (
              <p role="alert" className="text-xs text-destructive">
                {t("coform.depense.amountInvalid", "Le montant doit être positif")}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("coform.depense.cancel", "Annuler")}
          </Button>
          <Button type="button" onClick={soumettre}>
            {modeEdition
              ? t("coform.depense.save", "Enregistrer")
              : t("coform.depense.add", "Ajouter")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DepenseFormDialog;
