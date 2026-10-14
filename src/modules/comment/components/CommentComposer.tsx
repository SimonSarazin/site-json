import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { lazy } from "vite-preload";
import {
  Bold, Code, Heading, ImagePlus, Italic, Link2, Link2Off, List, ListOrdered, Quote, Send, SmilePlus, SquareCode, Strikethrough, X,
} from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ACCEPTED_IMAGE_TYPES, type ImageRejection } from "../lib/commentImages";
import { normalizeLinkAddress } from "../lib/richText/linkAddress";
import type { PendingImage } from "../hooks/useCommentImages";
import { ComposerImages } from "./ComposerImages";
import { loadEditorSurface, useEditorSurface } from "./editor/editorStore";
import { FORMAT_KINDS, HEADING_LEVELS, type EditorSurfaceHandle, type EditorSurfaceState, type FormatKind, type HeadingLevel } from "./editor/editorTypes";
import type { CommentMention } from "../types";
import "../styles.css";

// Le sélecteur d'émojis pèse lourd et ne sert qu'au clic : il n'est chargé qu'à l'ouverture.
// Sans cela, chaque page portant un fil paierait son poids au premier rendu.
const EmojiPicker = lazy(() => import("emoji-picker-react"));

const FORMAT_ICONS: Record<FormatKind, typeof Bold> = {
  bold: Bold, italic: Italic, strike: Strikethrough, code: Code, link: Link2,
  quote: Quote, list: List, ordered: ListOrdered, codeBlock: SquareCode,
};

/** Les mises en forme du TEXTE : dans un bloc de code, où rien ne se met en forme, elles n'ont rien à faire. */
const INLINE_FORMATS: readonly FormatKind[] = ["bold", "italic", "strike", "code", "link"];

/** La barre, dans l'ordre : les mises en forme, et le menu des titres là où le legacy le place — après le barré. */
const BARRE: readonly (FormatKind | "heading")[] = [...FORMAT_KINDS.slice(0, 3), "heading", ...FORMAT_KINDS.slice(3)];

const POINTEUR_GROSSIER = "(pointer: coarse)";

/**
 * L'écran se pilote-t-il au doigt ? Ce qu'on DIT de l'envoi en dépend : au clavier, Ctrl+Entrée
 * (`EditorSurface`) — annoncé par l'aide du champ et par l'infobulle du bouton ; au doigt, où il
 * n'y a pas de Ctrl sous le pouce, le message part par son bouton, et rien ne promet un raccourci.
 * Faux au serveur et au premier rendu du client — les deux écrivent le même balisage —, puis
 * suivi : un appareil peut changer de pointeur.
 */
function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    notifier => {
      const media = typeof window.matchMedia === "function" ? window.matchMedia(POINTEUR_GROSSIER) : null;
      media?.addEventListener?.("change", notifier);
      return () => media?.removeEventListener?.("change", notifier);
    },
    () => (typeof window.matchMedia === "function" ? window.matchMedia(POINTEUR_GROSSIER).matches : false),
    () => false,
  );
}

export interface CommentComposerProps {
  readonly onSubmit: (text: string, mentions: readonly CommentMention[]) => void;
  readonly onCancel?: () => void;
  readonly initialValue?: string;
  /**
   * Les mentions du message édité. Sans elles, l'édition repartait d'une liste vide : les `@slug`
   * du texte restaient du texte, et le serveur effaçait les mentions.
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
   * Le composer ne téléverse rien : il reçoit des aperçus et deux rappels.
   *
   * C'est leur STATUT qui retient l'envoi : tant qu'une image est en route (`uploading`) ou en
   * échec (`error`), le message ne part pas — il partirait sans elle. `images` et
   * `onRemoveImage` vont ensemble : sans le second, les aperçus ne sont pas montrés.
   */
  readonly images?: readonly PendingImage[];
  readonly onAddImages?: (files: readonly File[]) => void;
  readonly onRemoveImage?: (localId: string) => void;
  /** Le plafond de cinq images est atteint. */
  readonly imagesFull?: boolean;
  /**
   * Un téléversement est en cours : l'envoi attend, sinon l'image serait perdue. Le composer le
   * lit aussi dans le statut des `images` — la retenue ne dépend pas de la cohérence de l'hôte.
   */
  readonly imagesBusy?: boolean;
  /** Motifs du dernier refus, à annoncer sous le champ. */
  readonly imageRejections?: readonly ImageRejection[];
  readonly className?: string;
}

/**
 * Zone de saisie d'un message.
 *
 * **Une coquille et un éditeur.** Ce composant est la coquille : le bandeau « réponse à », la barre
 * d'outils, les images, les phrases d'état, l'envoi. La zone où l'on écrit est un éditeur Tiptap
 * (`editor/EditorSurface`) chargé côté client seulement : la coquille n'en importe RIEN, elle lui
 * parle par une poignée (`EditorSurfaceHandle`) et le trouve dans un magasin (`editorStore`).
 * Tant que son code n'est pas arrivé, elle montre un champ inerte de même allure, et n'envoie rien.
 *
 * **Ce qui part est du markdown** — le texte que le fil rend et que le legacy stocke —, tiré du
 * document de l'éditeur à l'envoi, avec les personnes qu'il mentionne.
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
  const { surface: Surface, failed: editeurEnEchec } = useEditorSurface();
  const editeur = useRef<EditorSurfaceHandle | null>(null);
  // Ce que l'éditeur dit de lui. `null` tant qu'il n'a rien dit : on ne sait pas encore s'il est vide.
  const [etat, setEtat] = useState<EditorSurfaceState | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [lienOuvert, setLienOuvert] = useState(false);
  const [adresse, setAdresse] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tactile = useCoarsePointer();
  const libelleEnvoi = String(t(mode === "edit" ? "composer.save" : "composer.send"));
  const aideId = useId();
  const adresseId = useId();

  // Le code de l'éditeur est demandé au montage du premier composer de l'onglet, puis gardé.
  useEffect(() => { void loadEditorSurface(); }, []);

  // Choisir « Répondre » ne déplaçait ni le focus ni la lecture d'écran : la cible du champ,
  // tout en bas de la page, changeait en silence. Le curseur y va désormais.
  useEffect(() => {
    if (replyingTo) editeur.current?.focus();
  }, [replyingTo]);

  const joint = (images?.length ?? 0) > 0;
  const idsEnRoute = useMemo(
    () => (images ?? []).filter(image => image.status === "uploading").map(image => image.localId),
    [images],
  );
  // Sans rappel de retrait, les aperçus ne sont pas montrés : retenir l'envoi sur un échec
  // enfermerait l'auteur, la phrase lui demandant un geste qu'il ne peut pas faire.
  const enEchec = onRemoveImage ? images?.filter(image => image.status === "error") ?? [] : [];
  // L'envoi attend tant qu'une image jointe ne partirait pas — en route, ou en échec. La garde
  // vit dans `submit`, pas seulement sur le bouton : Ctrl+Entrée y mène aussi, et le message partait
  // sans son image (voire vide, quand l'image en échec était son seul contenu).
  const retenu = imagesBusy || idsEnRoute.length > 0 || enEchec.length > 0;

  // Une tentative d'envoi retenue par un téléversement : sans un mot, Ctrl+Entrée paraîtrait morte.
  // On retient QUELLES images étaient en route, pas un drapeau : la phrase tombe d'elle-même
  // quand elles ont fini, et ne revient pas au téléversement suivant sans nouvelle tentative.
  const [tentative, setTentative] = useState<readonly string[]>([]);
  const attendues = idsEnRoute.filter(id => tentative.includes(id)).length;

  const submit = useCallback(() => {
    // Sans éditeur, rien ne part — pas même des images seules : en édition, ce serait enregistrer
    // un message vidé de son texte.
    const lu = editeur.current?.read() ?? null;
    if (lu === null) return;
    // Un message peut n'être QUE des images : `Comment::insert` l'accepte explicitement
    // (la garde backend porte sur « ni texte ni média », pas sur le texte seul).
    if ((!lu.text && !joint) || disabled || submitting) return;
    if (retenu) {
      // Un échec a déjà sa phrase, affichée sans attendre la tentative.
      if (idsEnRoute.length > 0) setTentative(idsEnRoute);
      return;
    }
    // Les mentions sont celles du DOCUMENT : en retirer une en éditant la phrase ne notifie pas
    // quelqu'un qui n'est plus cité.
    onSubmit(lu.text, lu.mentions);
    editeur.current?.clear();
  }, [joint, disabled, submitting, retenu, idsEnRoute, onSubmit]);

  const ouvrirLeLien = (ouvert: boolean) => {
    // L'adresse du lien où se trouve le curseur, s'il y en a un : on la corrige, on ne la retape pas.
    if (ouvert) setAdresse(editeur.current?.currentLink() ?? "");
    setLienOuvert(ouvert);
  };
  const adresseRetenue = normalizeLinkAddress(adresse);
  const poserLeLien = (href: string | null) => {
    setLienOuvert(false);
    editeur.current?.setLink(href);
  };

  const defaultPlaceholder = mode === "edit"
    ? t("composer.editPlaceholder")
    : replyingTo
      ? t("composer.replyPlaceholder", undefined, { author: replyingTo.author })
      : t("composer.placeholder");
  // La barre d'outils n'a rien à commander tant que l'éditeur n'est pas là.
  const barreInerte = disabled || etat === null;
  // Dans un bloc de code, rien ne se met en forme : ces boutons n'y feraient rien, ils le disent.
  const dansDuCode = etat?.active.codeBlock ?? false;

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

      {Surface ? (
        <Surface
          initialValue={initialValue}
          initialMentions={initialMentions ?? []}
          placeholder={String(placeholder ?? defaultPlaceholder)}
          label={String(defaultPlaceholder)}
          describedBy={aideId}
          disabled={disabled}
          autoFocus={autoFocus}
          entity={entity}
          onSubmit={submit}
          onCancel={onCancel}
          onAddImages={onAddImages}
          onStateChange={setEtat}
          handleRef={editeur}
        />
      ) : editeurEnEchec ? (
        // Sans l'éditeur on ne peut rien écrire : le dire, et offrir de le redemander.
        <div role="alert" className="flex min-h-9 flex-wrap items-center gap-2 px-3 py-2 text-sm text-muted-foreground" data-comment-field-failed>
          <span>{t("composer.editorFailed")}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadEditorSurface()}>
            {t("thread.retry")}
          </Button>
        </div>
      ) : (
        // La même allure que le champ vide, le temps que le code de l'éditeur arrive.
        <div className="min-h-9 px-3 py-2 text-sm text-muted-foreground" aria-busy="true" data-comment-field-loading>
          {String(placeholder ?? defaultPlaceholder)}
        </div>
      )}

      {images && onRemoveImage ? (
        <ComposerImages items={images} onRemove={onRemoveImage} disabled={disabled} />
      ) : null}

      {/* L'aperçu cerclé de rouge ne dit ni quoi ni que faire, et l'envoi est retenu : sans
          cette phrase, le bouton resterait grisé sans raison apparente. */}
      {enEchec.length > 0 ? (
        // `break-words` : le composer est un conteneur `inline-size`, un nom de fichier long et
        // sans point de coupure ne l'élargit pas, il en sortait.
        <p role="alert" className="px-3 pb-1 text-xs break-words text-destructive">
          {t("images.failedHint", undefined, { count: enEchec.length, name: enEchec[0].name })}
        </p>
      ) : attendues > 0 ? (
        <p role="status" className="px-3 pb-1 text-xs text-muted-foreground">
          {t("images.waitingHint", undefined, { count: attendues })}
        </p>
      ) : null}

      {imageRejections && imageRejections.length > 0 ? (
        <p role="status" className="px-3 pb-1 text-xs text-muted-foreground">
          {imageRejections.map(motif => String(t(`images.rejected.${motif}`))).join(" ")}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-1 px-2 pb-2">
        {/* Les marques sont atténuées au repos et pleines au focus (cf. `styles.css`) : une
            barre d'outils à pleine intensité sous chaque fil est du bruit, mais la masquer
            ferait sauter la mise en page à chaque clic dans le champ. */}
        <div className="comment-marks flex flex-wrap items-center gap-0.5" role="group" aria-label={String(t("composer.tools"))}>
          {BARRE.map(kind => {
            if (kind === "heading") {
              const niveau = etat?.heading ?? null;
              return (
                // Six niveaux, comme le legacy, et le texte normal : un bouton qui ouvre leur liste.
                // `modal={false}` : le composer vit souvent dans un dialogue (cf. la mémoire du dépôt
                // sur les menus Radix modaux sous un dialogue monté).
                <DropdownMenu key={kind} modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={barreInerte || !etat?.canHeading}
                      className={cn("size-7 rounded-full text-muted-foreground", niveau !== null && "bg-accent text-accent-foreground")}
                      aria-label={String(t("composer.marks.heading.label"))}
                      title={String(t("composer.marks.heading.label"))}
                      onMouseDown={event => event.preventDefault()}
                    >
                      <Heading className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    // Refermé, le focus retourne au texte — pas au bouton : on reprend la phrase.
                    onCloseAutoFocus={event => { event.preventDefault(); editeur.current?.focus(); }}
                  >
                    <DropdownMenuRadioGroup
                      value={niveau === null ? "0" : String(niveau)}
                      onValueChange={valeur => editeur.current?.setHeading(valeur === "0" ? null : Number(valeur) as HeadingLevel)}
                    >
                      <DropdownMenuRadioItem value="0">{t("composer.heading.normal")}</DropdownMenuRadioItem>
                      {HEADING_LEVELS.map(n => (
                        <DropdownMenuRadioItem key={n} value={String(n)}>
                          {t("composer.heading.level", undefined, { level: n })}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }
            const Icon = FORMAT_ICONS[kind];
            const actif = etat?.active[kind] ?? false;
            const bouton = (
              <Button
                key={kind}
                type="button"
                variant="ghost"
                size="icon"
                disabled={barreInerte || (dansDuCode && INLINE_FORMATS.includes(kind))}
                className={cn("size-7 rounded-full text-muted-foreground", actif && "bg-accent text-accent-foreground")}
                aria-label={String(t(`composer.marks.${kind}.label`))}
                title={String(t(`composer.marks.${kind}.label`))}
                // Un bouton à bascule : l'état se LIT, il ne se devine pas à la couleur.
                aria-pressed={actif}
                // `onMouseDown` empêche seulement le clic de voler le focus (et la sélection) au
                // champ ; c'est `onClick` qui applique, et lui répond AUSSI à Entrée et Espace.
                onMouseDown={event => event.preventDefault()}
                onClick={kind === "link" ? undefined : () => editeur.current?.toggle(kind)}
              >
                <Icon className="size-3.5" />
              </Button>
            );
            if (kind !== "link") return bouton;
            return (
              // Un lien demande une adresse : son bouton ouvre un champ, pas un dialogue de plus.
              <Popover key={kind} open={lienOuvert} onOpenChange={ouvrirLeLien}>
                <PopoverTrigger asChild>{bouton}</PopoverTrigger>
                <PopoverContent
                  className="flex w-auto items-center gap-1.5 p-2"
                  align="start"
                  // Refermé, le focus retourne au texte — pas au bouton : on reprend la phrase.
                  onCloseAutoFocus={event => { event.preventDefault(); editeur.current?.focus(); }}
                >
                  <Label htmlFor={adresseId} className="sr-only">{t("composer.link.url")}</Label>
                  <Input
                    id={adresseId}
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    value={adresse}
                    placeholder="https://"
                    className="h-8 w-56"
                    onChange={event => setAdresse(event.target.value)}
                    // Entrée applique. Pas de `<form>` : son envoi remonterait à un formulaire hôte.
                    onKeyDown={event => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      if (adresseRetenue) poserLeLien(adresseRetenue);
                    }}
                  />
                  <Button type="button" size="sm" disabled={!adresseRetenue} onClick={() => poserLeLien(adresseRetenue)}>
                    {t("composer.link.apply")}
                  </Button>
                  {actif ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label={String(t("composer.link.remove"))}
                      title={String(t("composer.link.remove"))}
                      onClick={() => poserLeLien(null)}
                    >
                      <Link2Off className="size-3.5" />
                    </Button>
                  ) : null}
                </PopoverContent>
              </Popover>
            );
          })}

          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={barreInerte}
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
                      editeur.current?.insertText(emoji.emoji);
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

        <div className="flex shrink-0 items-center gap-1">
          {mode === "edit" && onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {t("composer.cancel")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            // Tant que l'éditeur n'a rien dit, on ne sait pas ce qui partirait : le bouton attend.
            disabled={disabled || submitting || retenu || etat === null || (etat.empty && !joint)}
            // Entrée ne fait plus qu'aller à la ligne : le raccourci de l'envoi se lit ICI, sur le
            // bouton qu'il remplace — pas au doigt, où il n'existe pas.
            title={tactile ? undefined : `${libelleEnvoi} (${String(t("composer.sendShortcut"))})`}
            aria-keyshortcuts="Control+Enter Meta+Enter"
            onClick={submit}
          >
            <Send className="size-3.5" />
            {libelleEnvoi}
          </Button>
        </div>
      </div>

      <p id={aideId} className="sr-only">{t(tactile ? "composer.formattingHintTouch" : "composer.formattingHint")}</p>
    </div>
  );
}
