import { Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { lazy } from "vite-preload";
import { Bold, Code, ImagePlus, Italic, Link2, List, Quote, Send, SmilePlus, X } from "lucide-react";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { useSearchUsers } from "@/hooks/useSearchUsers";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MARK_KINDS,
  applyMark,
  findMentionQuery,
  insertAtCursor,
  replaceMentionQuery,
  shouldSubmitOnEnter,
  type FieldState,
  type MarkKind,
} from "../lib/composerText";
import { ACCEPTED_IMAGE_TYPES, imageFilesFrom, type ImageRejection } from "../lib/commentImages";
import type { PendingImage } from "../hooks/useCommentImages";
import { ComposerImages } from "./ComposerImages";
import type { CommentMention } from "../types";
import "../styles.css";

// Le sélecteur d'émojis pèse lourd et ne sert qu'au clic : il n'est chargé qu'à l'ouverture.
// Sans cela, chaque page portant un fil paierait son poids au premier rendu.
const EmojiPicker = lazy(() => import("emoji-picker-react"));

const MARK_ICONS: Record<MarkKind, typeof Bold> = {
  bold: Bold, italic: Italic, code: Code, link: Link2, quote: Quote, list: List,
};

export interface CommentComposerProps {
  readonly onSubmit: (text: string, mentions: readonly CommentMention[]) => void;
  readonly onCancel?: () => void;
  readonly initialValue?: string;
  /**
   * Les mentions du message édité. Sans elles, l'édition repartait d'une liste vide : le filtre
   * « encore présentes dans le texte » ne gardait rien, et le serveur effaçait les mentions.
   */
  readonly initialMentions?: readonly CommentMention[];
  readonly placeholder?: string;
  readonly autoFocus?: boolean;
  readonly disabled?: boolean;
  readonly submitting?: boolean;
  /** Le message auquel on répond — affiche le bandeau « réponse à ». */
  readonly replyingTo?: { readonly id: string; readonly author: string } | null;
  readonly onStopReplying?: () => void;
  /** Entité servant de périmètre à la recherche de personnes à mentionner. */
  readonly entity?: EntityTypes | null;
  /** `edit` change le libellé du bouton et affiche « Annuler ». */
  readonly mode?: "create" | "edit";
  /**
   * Les images jointes, telles que `useCommentImages` les tient.
   *
   * Le composer ne téléverse rien : il reçoit des aperçus et deux rappels. C'est ce qui permet
   * de remplacer cette zone de saisie par un vrai éditeur (B11) sans toucher au téléversement.
   */
  readonly images?: readonly PendingImage[];
  readonly onAddImages?: (files: readonly File[]) => void;
  readonly onRemoveImage?: (localId: string) => void;
  /** Le plafond de cinq images est atteint. */
  readonly imagesFull?: boolean;
  /** Un téléversement est en cours : l'envoi attend, sinon l'image serait perdue. */
  readonly imagesBusy?: boolean;
  /** Motifs du dernier refus, à annoncer sous le champ. */
  readonly imageRejections?: readonly ImageRejection[];
  readonly className?: string;
}

/**
 * Zone de saisie d'un message.
 *
 * Maison, sur `Textarea`, et non `@uiw/react-md-editor` : cet éditeur est client-only (un
 * squelette de chargement à chaque clic sur « Répondre »), se thème hors des jetons du site, et
 * possède son propre champ — où l'on ne peut brancher ni la détection du `@` ni le collage.
 * Ici, toute la logique de texte vit dans `lib/composerText.ts`, pure et testée ; le composant
 * ne fait que la relier au DOM et replacer le curseur.
 */
export function CommentComposer({
  onSubmit,
  onCancel,
  initialValue = "",
  initialMentions,
  placeholder,
  autoFocus = false,
  disabled = false,
  submitting = false,
  replyingTo = null,
  onStopReplying,
  entity = null,
  mode = "create",
  images,
  onAddImages,
  onRemoveImage,
  imagesFull = false,
  imagesBusy = false,
  imageRejections,
  className,
}: CommentComposerProps) {
  const t = useT("modules/comment");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listboxId = useId();
  const [text, setText] = useState(initialValue);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [highlighted, setHighlighted] = useState(0);
  // Les personnes réellement mentionnées : seules celles choisies dans la liste comptent, pas
  // un `@quelquechose` tapé à la main qui ne correspondrait à personne.
  const [mentions, setMentions] = useState<CommentMention[]>(() => [...(initialMentions ?? [])]);
  // Sélection à restaurer après un rendu — les fonctions pures la calculent, le DOM l'applique.
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  const [mentionQuery, setMentionQuery] = useState<{ start: number; query: string } | null>(null);
  const { data: candidates = [] } = useSearchUsers(mentionQuery?.query ?? "", mentionQuery !== null, entity);

  /** Le slug est ce qui fait une mention ; sans lui, la personne n'est pas choisissable. */
  const slugDe = (user: User): string => {
    const data = (user as unknown as { serverData?: Record<string, unknown> }).serverData ?? {};
    return typeof data.slug === "string" ? data.slug : "";
  };

  // La liste de mentions est-elle ouverte ? Une seule expression, lue par les attributs ARIA
  // du champ ET par le rendu de la liste : les deux ne peuvent pas diverger.
  const suggesting = mentionQuery !== null && candidates.length > 0;

  /**
   * L'indice réellement surligné, **borné au rendu**.
   *
   * `candidates` peut rétrécir sans qu'on ait tapé quoi que ce soit — `useSearchUsers` refait
   * sa requête au retour sur l'onglet. Un `highlighted` resté à 5 sur une liste de 2 pointerait
   * alors un `aria-activedescendant` inexistant, et Entrée enverrait le message avec le `@jo`
   * brut au lieu de choisir une mention.
   */
  const actif = Math.min(highlighted, Math.max(candidates.length - 1, 0));

  const fieldState = useCallback((): FieldState => {
    const el = textareaRef.current;
    return {
      text,
      selectionStart: el?.selectionStart ?? text.length,
      selectionEnd: el?.selectionEnd ?? text.length,
    };
  }, [text]);

  /** Applique un nouvel état de champ ET programme le replacement du curseur. */
  const applyState = useCallback((next: FieldState) => {
    setText(next.text);
    pendingSelection.current = { start: next.selectionStart, end: next.selectionEnd };
  }, []);

  // Replacement du curseur et auto-grandissement : après le rendu, avant la peinture, pour
  // qu'aucune frame n'affiche la mauvaise hauteur ou le curseur au mauvais endroit.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const selection = pendingSelection.current;
    if (selection) {
      el.focus();
      el.setSelectionRange(selection.start, selection.end);
      pendingSelection.current = null;
    }

    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [text]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  // Choisir « Répondre » ne déplaçait ni le focus ni la lecture d'écran : la cible du champ,
  // tout en bas de la page, changeait en silence. Le curseur y va désormais.
  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  const refreshMentionQuery = useCallback((value: string, caret: number) => {
    const found = findMentionQuery(value, caret);
    setMentionQuery(found);
    setHighlighted(0);
  }, []);

  const pickMention = useCallback((user: User) => {
    const data = (user as unknown as { serverData?: Record<string, unknown> }).serverData ?? {};
    const slug = typeof data.slug === "string" ? data.slug : "";
    const name = typeof data.name === "string" ? data.name : slug;
    const id = (user as unknown as { id?: string }).id ?? "";
    if (!slug || !mentionQuery) return;

    applyState(replaceMentionQuery(fieldState(), mentionQuery, slug));
    setMentions(previous =>
      previous.some(m => m.slug === slug) ? previous : [...previous, { id, name, slug }]);
    setMentionQuery(null);
  }, [applyState, fieldState, mentionQuery]);

  const joint = (images?.length ?? 0) > 0;

  const submit = useCallback(() => {
    const trimmed = text.trim();
    // Un message peut n'être QUE des images : `Comment::insert` l'accepte explicitement
    // (la garde backend porte sur « ni texte ni média », pas sur le texte seul).
    if ((!trimmed && !joint) || disabled || submitting) return;
    // Seules les mentions encore présentes dans le texte partent au serveur : en retirer une
    // en éditant la phrase ne doit pas notifier quelqu'un qui n'est plus cité.
    onSubmit(trimmed, mentions.filter(m => trimmed.includes(`@${m.slug}`)));
    setText("");
    setMentions([]);
    setMentionQuery(null);
  }, [text, joint, disabled, submitting, onSubmit, mentions]);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // La liste de mentions capte les flèches et Entrée tant qu'elle est ouverte.
    if (mentionQuery && candidates.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlighted((actif + 1) % candidates.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlighted((actif - 1 + candidates.length) % candidates.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const chosen = candidates[actif];
        // On ne confisque la touche que si l'on va RÉELLEMENT choisir. Sans slug, `pickMention`
        // sort sans rien faire : confisquer ferait une Entrée morte et un Tab qui n'échappe
        // plus au champ.
        if (chosen && slugDe(chosen)) {
          event.preventDefault();
          pickMention(chosen);
          return;
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    if (shouldSubmitOnEnter(event.nativeEvent as unknown as Parameters<typeof shouldSubmitOnEnter>[0])) {
      event.preventDefault();
      submit();
      return;
    }

    if (event.key === "Escape" && onCancel) {
      event.preventDefault();
      onCancel();
    }
  }, [mentionQuery, candidates, actif, pickMention, submit, onCancel]);

  const defaultPlaceholder = mode === "edit"
    ? t("composer.editPlaceholder")
    : replyingTo
      ? t("composer.replyPlaceholder", undefined, { author: replyingTo.author })
      : t("composer.placeholder");

  return (
    <div className={cn("comment-thread relative rounded-md border border-border bg-card", className)}>
      {replyingTo ? (
        <div
          role="status"
          className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-xs text-muted-foreground"
        >
          <span className="truncate">
            {t("composer.replyingTo", undefined, { author: replyingTo.author })}
          </span>
          {onStopReplying ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 rounded-full"
              aria-label={String(t("composer.stopReplying"))}
              onClick={onStopReplying}
            >
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
      ) : null}

      <Textarea
        ref={textareaRef}
        value={text}
        rows={1}
        disabled={disabled}
        placeholder={String(placeholder ?? defaultPlaceholder)}
        aria-label={String(defaultPlaceholder)}
        // Sans annonce, taper « @ » ouvrait une liste qu'aucun lecteur d'écran ne mentionnait,
        // et les flèches déplaçaient une surbrillance signalée nulle part.
        //
        // ⚠️ On garde le rôle IMPLICITE `textbox`. `coform/TagsField` pose `role="combobox"`,
        // mais sur un `<input>` : « ARIA in HTML » n'autorise aucun rôle de remplacement sur un
        // `<textarea>`, et le champ cesserait d'être annoncé comme une zone multiligne. Les
        // attributs ci-dessous sont, eux, explicitement admis sur `textbox` — et c'est la
        // région d'état plus bas qui dit qu'une liste s'est ouverte.
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-controls={suggesting ? listboxId : undefined}
        aria-activedescendant={suggesting ? `${listboxId}-${actif}` : undefined}
        /**
         * « Échap m'appartient » — mais seulement quand il a quelque chose à faire : fermer la
         * liste de mentions, ou annuler l'édition en cours.
         *
         * Sans cette déclaration, le composeur ouvert DANS la modale des discussions annulait
         * l'édition ET fermait la modale sur la même frappe : Radix écoute la touche sur
         * `document` en phase de capture, si bien que le `preventDefault` du gestionnaire
         * ci-dessous — qui bulle — arrivait trop tard. `DiscussionModal` lit cet attribut sur
         * la cible de l'événement pour laisser la main.
         */
        data-comment-escape={mentionQuery !== null || onCancel ? "" : undefined}
        className="min-h-9 resize-none border-0 bg-transparent px-3 py-2 text-sm shadow-none
                   focus-visible:ring-0 dark:bg-transparent"
        onChange={event => {
          setText(event.target.value);
          refreshMentionQuery(event.target.value, event.target.selectionStart ?? 0);
        }}
        onKeyDown={onKeyDown}
        onClick={event => refreshMentionQuery(text, event.currentTarget.selectionStart ?? 0)}
        onPaste={event => {
          // Le collage est le geste le plus courant pour joindre une capture d'écran — c'est
          // d'ailleurs ainsi que les images de commentaire déjà en base ont été créées
          // (`pastedimage.jpeg`). On ne confisque l'événement que s'il porte vraiment une
          // image, sinon un collage de texte perdrait son contenu.
          if (!onAddImages) return;
          const fichiers = imageFilesFrom(event.clipboardData);
          if (fichiers.length === 0) return;
          event.preventDefault();
          onAddImages(fichiers);
        }}
        onDragOver={onAddImages ? event => event.preventDefault() : undefined}
        onDrop={onAddImages ? event => {
          const fichiers = imageFilesFrom(event.dataTransfer);
          if (fichiers.length === 0) return;
          event.preventDefault();
          onAddImages(fichiers);
        } : undefined}
      />

      {images && onRemoveImage ? (
        <ComposerImages items={images} onRemove={onRemoveImage} disabled={disabled} />
      ) : null}

      {imageRejections && imageRejections.length > 0 ? (
        <p role="status" className="px-3 pb-1 text-xs text-muted-foreground">
          {imageRejections.map(motif => String(t(`images.rejected.${motif}`))).join(" ")}
        </p>
      ) : null}

      {suggesting ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={String(t("composer.mentionHint"))}
          className="absolute bottom-full z-20 mb-1 max-h-56 w-full overflow-auto rounded-md border
                     border-border bg-popover p-1 shadow-md"
        >
          {candidates.map((user, i) => {
            const data = (user as unknown as { serverData?: Record<string, unknown> }).serverData ?? {};
            const name = typeof data.name === "string" ? data.name : "";
            const slug = typeof data.slug === "string" ? data.slug : "";
            return (
              // L'option est le `<li>` lui-même. Un `<button role="option">` à l'intérieur
              // sortait l'option de la liste qui la possède, et surtout la mettait dans
              // l'ordre de tabulation — une option ne se tabule pas, elle se désigne par
              // `aria-activedescendant` pendant que le focus reste dans le champ.
              <li
                key={slug || String(i)}
                id={`${listboxId}-${i}`}
                role="option"
                aria-selected={i === actif}
                // `onMouseDown` et non `onClick` : le clic ferait perdre le focus au champ
                // avant que la sélection ne soit posée, et le curseur sauterait à la fin.
                onMouseDown={event => { event.preventDefault(); pickMention(user); }}
                onMouseEnter={() => setHighlighted(i)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  i === actif ? "bg-accent text-accent-foreground" : "",
                )}
              >
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">@{slug}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="flex items-center justify-between gap-1 px-2 pb-2">
        {/* Les marques sont atténuées au repos et pleines au focus (cf. `styles.css`) : une
            barre d'outils à pleine intensité sous chaque fil est du bruit, mais la masquer
            ferait sauter la mise en page à chaque clic dans le champ. */}
        <div className="comment-marks flex items-center gap-0.5">
          {MARK_KINDS.map(mark => {
            const Icon = MARK_ICONS[mark];
            return (
              <Button
                key={mark}
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="size-7 rounded-full text-muted-foreground"
                aria-label={String(t(`composer.marks.${mark}.label`))}
                // `onMouseDown` empêche seulement le clic de voler le focus (et la sélection) au
                // champ ; c'est `onClick` qui applique, et lui répond AUSSI à Entrée et Espace —
                // la barre était morte au clavier (revue du 29/09).
                onMouseDown={event => event.preventDefault()}
                onClick={() => applyState(applyMark(fieldState(), mark, String(t(`composer.marks.${mark}.example`))))}
              >
                <Icon className="size-3.5" />
              </Button>
            );
          })}

          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="size-7 rounded-full text-muted-foreground"
                aria-label={String(t("composer.emoji"))}
              >
                <SmilePlus className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto border-0 p-0" align="start">
              {/* Monté seulement à l'ouverture : c'est la règle du dépôt pour les composants
                  lourds derrière un déclencheur. */}
              {emojiOpen ? (
                <Suspense fallback={<div className="p-4 text-xs text-muted-foreground">…</div>}>
                  <EmojiPicker
                    onEmojiClick={emoji => {
                      applyState(insertAtCursor(fieldState(), emoji.emoji));
                      setEmojiOpen(false);
                    }}
                  />
                </Suspense>
              ) : null}
            </PopoverContent>
          </Popover>

          {onAddImages ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || imagesFull}
                className="size-7 rounded-full text-muted-foreground"
                aria-label={String(imagesFull ? t("images.full") : t("images.attach"))}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="size-3.5" />
              </Button>
              {/* `sr-only` et non `hidden` : un champ masqué par `display:none` n'est pas
                  activable au clavier dans tous les navigateurs, et celui-ci reste la seule
                  voie d'accès pour qui n'utilise pas la souris. */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={event => {
                  const fichiers = Array.from(event.target.files ?? []);
                  if (fichiers.length > 0) onAddImages(fichiers);
                  // Sans cette remise à zéro, rechoisir LE MÊME fichier après l'avoir retiré
                  // ne déclenche aucun `change` — la valeur n'a pas bougé.
                  event.target.value = "";
                }}
              />
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {mode === "edit" && onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {t("composer.cancel")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={disabled || submitting || imagesBusy || (text.trim().length === 0 && !joint)}
            onClick={submit}
          >
            <Send className="size-3.5" />
            {mode === "edit" ? t("composer.save") : t("composer.send")}
          </Button>
        </div>
      </div>

      {/* Ce que `aria-expanded` aurait dit si le rôle l'admettait : une région polie, lue à
          l'ouverture de la liste puis silencieuse. */}
      <p className="sr-only" role="status">
        {suggesting ? String(t("composer.mentionCount", undefined, { count: candidates.length })) : ""}
      </p>
      <p className="sr-only">{t("composer.formattingHint")}</p>
    </div>
  );
}
