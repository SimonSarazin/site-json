import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { Card } from "@/modules/kanban/types";

export interface CardComposerSubmit {
  columnId: string;
  title: string;
}

/**
 * Création d'une carte, branchée par la vue.
 *
 * Elle REND la carte créée — le contrat porte donc la réussite (l'objet) comme l'échec (le
 * rejet), et le composeur n'a pas à deviner ce qui s'est passé à partir d'un `void`.
 */
export type CreateCardHandler = (input: CardComposerSubmit) => Promise<Card>;

export interface CardComposerProps {
  columnId: string;
  /** Nom de la colonne : il sert d'étiquette au champ, qui n'en a pas de visible. */
  columnTitle: string;
  onSubmit: CreateCardHandler;
  /** Ferme le composeur ; l'appelant rend le focus au déclencheur. */
  onClose: () => void;
}

/**
 * Redimensionne le champ à son contenu, entre 1 et 4 lignes (bornes posées en CSS). Le
 * `height = 'auto'` préalable est obligatoire : sans lui, `scrollHeight` reste bloqué à la
 * hauteur précédente et le champ ne rétrécit jamais. `scrollHeight === 0` signifie « rien n'est
 * mesuré » (jsdom, champ détaché) : on laisse alors la hauteur naturelle.
 */
function fitToContent(field: HTMLTextAreaElement): void {
  field.style.height = "auto";
  if (field.scrollHeight > 0) field.style.height = `${field.scrollHeight}px`;
}

/**
 * Saisie en ligne d'une carte au pied de sa colonne, à la place d'une boîte : même fond, même
 * rayon, même filet que la carte qu'elle va créer. Reprise de co-kanban.
 *
 * Deux règles portent tout le reste :
 * 1. **Une saisie ne se perd jamais.** En cas d'échec, le texte reste dans le champ et l'erreur
 *    est annoncée ; le champ ne se vide qu'après une réussite confirmée par le serveur.
 * 2. **On saisit rarement une seule tâche.** Enregistrer ne ferme pas le composeur : il se vide,
 *    garde le focus, et la carte suivante s'enchaîne. Échap ou « Annuler » ferment.
 */
export function CardComposer({ columnId, columnTitle, onSubmit, onClose }: CardComposerProps) {
  const { t } = useTranslation("modules/kanban");
  const fieldId = useId();
  const statusId = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  // Le composeur remplace son déclencheur : sans ce focus, le clavier se retrouverait sur un
  // bouton qui vient de disparaître. Et il faut l'amener DANS LA VUE : au pied d'une colonne
  // longue, le champ s'ouvrirait sous le bord de la fenêtre.
  useEffect(() => {
    fieldRef.current?.focus();
    rootRef.current?.scrollIntoView?.({ block: "nearest" });
  }, []);

  const canSubmit = title.trim() !== "" && !pending;

  const submit = useCallback(async () => {
    const value = title.trim();
    // Un titre vide ne crée rien : la garde double celle du bouton désactivé, que la touche
    // Entrée contourne.
    if (value === "" || pending) return;

    setPending(true);
    setFailed(false);
    try {
      await onSubmit({ columnId, title: value });
      // Vidé APRÈS confirmation seulement : la mutation est optimiste à l'écran, mais la
      // saisie, elle, attend le serveur.
      setTitle("");
      const field = fieldRef.current;
      if (field !== null) {
        field.style.height = "auto";
        field.focus();
      }
      // Le composeur reste EN VUE pour la saisie suivante. La carte créée, elle, est montrée et
      // annoncée par la colonne, à son rang canonique, souvent loin d'ici.
      rootRef.current?.scrollIntoView?.({ block: "nearest" });
    } catch {
      // Le détail de la panne est déjà porté par la notification de la mutation ; ici on garde
      // le texte et on dit, à côté du champ, que rien n'est parti.
      setFailed(true);
    } finally {
      setPending(false);
    }
  }, [columnId, onSubmit, pending, title]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        // Sinon Échap traverserait jusqu'à une couche parente et fermerait deux choses.
        event.stopPropagation();
        onClose();
        return;
      }
      // Entrée enregistre, Maj+Entrée passe à la ligne : la convention des saisies en ligne.
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void submit();
      }
    },
    [onClose, submit],
  );

  return (
    <div ref={rootRef} className="flex flex-col gap-[var(--ck-card-gap)] rounded-xl border border-border bg-card p-[var(--ck-card-padding)]">
      <label htmlFor={fieldId} className="sr-only">
        {t("column.composer.field", { title: columnTitle })}
      </label>
      <textarea
        ref={fieldRef}
        id={fieldId}
        rows={1}
        value={title}
        // Lecture seule et non `disabled` pendant l'envoi : un champ désactivé perd le focus, et
        // l'enchaînement des saisies avec lui.
        readOnly={pending}
        aria-busy={pending || undefined}
        // `aria-invalid` mais AUCUNE encre rouge sur le texte saisi : ce n'est pas la phrase qui
        // est fautive, c'est l'envoi qui n'est pas parti.
        aria-invalid={failed || undefined}
        aria-describedby={statusId}
        placeholder={t("column.composer.placeholder")}
        onChange={(event) => {
          setTitle(event.target.value);
          fitToContent(event.target);
        }}
        onKeyDown={handleKeyDown}
        className={
          // Ni filet ni fond propres : le contour est celui de la carte. 1 à 4 lignes (20 px),
          // puis on défile. 16 px sous 640 px : iOS zoome sur un champ plus petit.
          "max-h-20 min-h-5 w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-base leading-5 font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline-none sm:text-sm"
        }
      />

      {/* Région vivante MONTÉE EN PERMANENCE : un conteneur `aria-live` qui apparaît avec son
          texte n'est pas annoncé. */}
      <p id={statusId} role="status" aria-live="polite" className="text-xs text-destructive empty:hidden">
        {failed ? t("column.composer.failed") : ""}
      </p>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={!canSubmit} aria-busy={pending || undefined} onClick={() => void submit()}>
          {/* Pictogramme seul, sans `Spinner` : sa région `status` s'ajouterait au nom du bouton,
              qui dit déjà « occupé » (`aria-busy`). */}
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
          {t("common.save")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
