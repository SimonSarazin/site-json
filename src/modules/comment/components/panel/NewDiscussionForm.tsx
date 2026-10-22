import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useT } from "@/hooks/useT";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCreateDiscussion } from "../../hooks/useCreateDiscussion";
import { creationErrorCodeOf } from "../../lib/space";
import type { DiscussionThread, SpaceAudience, SpaceRef } from "../../types";

/** Le nom d'une discussion, une fois ramené à du texte : c'est la borne que le serveur applique. */
const NAME_MAX = 120;

export interface NewDiscussionFormProps {
  readonly space: SpaceRef;
  /** Les audiences que ce lecteur peut donner — celles que le serveur a annoncées, jamais d'autres. */
  readonly audiences: readonly SpaceAudience[];
  /** La discussion est créée, et déjà dans la liste : à l'hôte de l'ouvrir. */
  readonly onCreated: (thread: DiscussionThread) => void;
  readonly onCancel: () => void;
}

/**
 * Créer une discussion supplémentaire sur un commun : un nom, et qui la lira.
 *
 * Le formulaire du legacy, posé EN LIGNE en tête de la colonne des fils — pas un dialogue dans le
 * dialogue. « Privée » est choisie d'office quand elle est offerte, comme dans le legacy : ouvrir
 * une discussion à tous doit être un geste, pas un oubli.
 *
 * Il revendique Échap (`data-comment-escape`) : la touche referme le formulaire, pas la modale.
 */
export function NewDiscussionForm({ space, audiences, onCreated, onCancel }: NewDiscussionFormProps) {
  const t = useT("modules/comment");
  const creation = useCreateDiscussion(space);
  const [name, setName] = useState("");
  const [audience, setAudience] = useState<SpaceAudience>(
    () => (audiences.includes("authorAdmin") ? "authorAdmin" : audiences[0]),
  );
  const id = useId();
  const champ = useRef<HTMLInputElement>(null);
  // On ouvre ce formulaire pour écrire : le champ a le focus dès qu'il est là.
  useEffect(() => { champ.current?.focus(); }, []);

  const nom = name.trim().replace(/\s+/g, " ");
  const code = creation.isError ? creationErrorCodeOf(creation.error) : null;

  // Un seul envoi à la fois, et la garde est SYNCHRONE : `isPending` n'arrive qu'au rendu suivant,
  // deux Entrée coup sur coup partiraient avant lui — et créeraient deux discussions du même nom.
  const enVol = useRef(false);
  const envoyer = (event: FormEvent) => {
    event.preventDefault();
    if (nom === "" || enVol.current) return;
    enVol.current = true;
    creation.mutate({ name: nom, audience }, { onSuccess: onCreated, onSettled: () => { enVol.current = false; } });
  };

  return (
    <form
      data-new-discussion
      data-comment-escape
      aria-labelledby={`${id}-titre`}
      // `min-h-0` + défilement : dans une colonne trop basse (téléphone à l'horizontale, clavier
      // ouvert), le formulaire se réduit et défile — sans quoi ses boutons sortaient du cadre.
      className="bg-muted/40 min-h-0 space-y-3 overflow-y-auto border-b px-3 py-3"
      onSubmit={envoyer}
      onKeyDown={event => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onCancel();
      }}
    >
      <h3 id={`${id}-titre`} className="text-sm font-semibold">{String(t("space.create.title"))}</h3>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-nom`}>{String(t("space.create.name"))}</Label>
        <Input
          ref={champ}
          id={`${id}-nom`}
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder={String(t("space.create.namePlaceholder"))}
          maxLength={NAME_MAX}
          autoComplete="off"
          required
          aria-invalid={code === "bad-name" || undefined}
          aria-describedby={code ? `${id}-erreur` : undefined}
        />
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm leading-none font-medium">{String(t("space.create.audience"))}</legend>
        <RadioGroup value={audience} onValueChange={valeur => setAudience(valeur as SpaceAudience)} className="gap-2 pt-1">
          {audiences.map(choix => (
            // Le nom nomme le choix, la phrase le décrit : lus l'un après l'autre, pas deux fois.
            <div key={choix} className="flex items-start gap-2">
              <RadioGroupItem id={`${id}-${choix}`} value={choix} className="mt-0.5 shrink-0" aria-describedby={`${id}-${choix}-aide`} />
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor={`${id}-${choix}`} className="cursor-pointer leading-tight">{String(t(`space.audiences.${choix}`))}</Label>
                <p id={`${id}-${choix}-aide`} className="text-muted-foreground text-xs">
                  {String(t(`space.create.audienceHint.${choix}`))}
                </p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      {code && (
        <p id={`${id}-erreur`} role="alert" className="text-destructive text-xs" data-new-discussion-error={code}>
          {String(t(`space.create.error.${code}`))}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{String(t("space.create.cancel"))}</Button>
        <Button type="submit" size="sm" disabled={nom === "" || creation.isPending} aria-busy={creation.isPending || undefined}>
          {String(t(creation.isPending ? "space.create.submitting" : "space.create.submit"))}
        </Button>
      </div>
    </form>
  );
}
