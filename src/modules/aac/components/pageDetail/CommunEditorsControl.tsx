import { useMemo, useState } from "react";
import { Loader2, UserPen, UserPlus } from "lucide-react";
import type { Api } from "@communecter/cocolight-api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FinderElementCard } from "@/modules/coform/components/FinderElementCard";
import { FinderSearchModal } from "@/modules/coform/components/FinderSearchModal";
import { useFinderElementImages, mergeResolvedFinderImages } from "@/modules/coform/hooks/useFinderElementImages";
import type { FinderConfig, FinderElement } from "@/modules/coform/types";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { cn } from "@/lib/utils";
import { useSaveCommunEditors } from "../../hooks/useSaveCommunEditors";
import {
  editorIdsOf,
  editorsWrites,
  readCommunEditors,
  type CommunEditors,
  type EditorsQuestion,
} from "../../lib/communEditors";

/**
 * « Contributeurs à l'édition » de la fiche d'un commun — parité du bouton legacy
 * `.aac-tl-canEdit-form` (`campDetail.php`, `add_form_contributor`).
 *
 * Les personnes listées peuvent MODIFIER le commun, pas le supprimer. Ce bouton est réservé à
 * l'auteur et aux admins (`canManageEditors`, arbitrage du 29/09) ; la question « Référent » que
 * le formulaire relie à la liste (`addToLinks`) reste, elle, modifiable par tout éditeur du commun,
 * et la change — parité legacy, assumée le 30/09.
 * Recherche GLOBALE de citoyens, comme le finder legacy (`initType: ['citoyens']`).
 */
export interface CommunEditorsControlProps {
  api: Api | null;
  /** `perms.canManageEditors(...)` — sans ce droit, rien n'est rendu. */
  canManage: boolean;
  answerId: string | null;
  /** La réponse affichée : on y lit `links.canEdit` et la question liée. */
  answer: unknown;
  /** La question qui alimente `links.canEdit`, si le formulaire en déclare une. */
  question: EditorsQuestion | null;
  /** Formulaire de l'appel — pour invalider aussi la réponse côté coform. */
  formId?: string | null;
  className?: string;
}

const EDITORS_FINDER_BASE: Omit<FinderConfig, "elementLabel" | "buttonLabel" | "placeholderSearchField"> = {
  type: "citoyens",
  filters: [],
  excludeFilters: [],
  notSourceKey: true,
  myContacts: false,
  initCurrentUser: false,
  field: "canEdit",
  multiple: true,
  addNew: false,
  invite: false,
  linkToAnswer: false,
  singleAnswerPerElement: false,
  msgSingleAnswerPerElement: "",
  redirectSingleAnswerPerElement: "Accueil",
  editElement: false,
  addToLinks: { value: false, links: "" },
};

export function CommunEditorsControl({
  api,
  canManage,
  answerId,
  answer,
  question,
  formId = null,
  className,
}: CommunEditorsControlProps) {
  useLoadNamespace("modules/aac");
  const t = useT("modules/aac");
  const [open, setOpen] = useState(false);

  if (!canManage) return null;

  const count = editorIdsOf(answer).length;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn("gap-2", className)}
        onClick={() => setOpen(true)}
      >
        <UserPen className="size-3.5" />
        {String(t("detail.editors.cta"))}
        {count > 0 && (
          <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
      </Button>

      {/* Monté seulement ouvert : chaque ouverture repart de la réponse affichée. */}
      {open && (
        <CommunEditorsDialog
          api={api}
          answerId={answerId}
          answer={answer}
          question={question}
          formId={formId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CommunEditorsDialog({
  api,
  answerId,
  answer,
  question,
  formId,
  onClose,
}: {
  api: Api | null;
  answerId: string | null;
  answer: unknown;
  question: EditorsQuestion | null;
  formId: string | null;
  onClose: () => void;
}) {
  const t = useT("modules/aac");
  // L'UNION des deux sources : si elles divergeaient, personne ne disparaît sans qu'on le voie.
  const [editors, setEditors] = useState<CommunEditors>(() => readCommunEditors(answer, question));
  const [finderOpen, setFinderOpen] = useState(false);
  const save = useSaveCommunEditors({ api, answerId, question, formId });

  const resolvedImages = useFinderElementImages(editors);
  const displayed = useMemo(() => mergeResolvedFinderImages(editors, resolvedImages), [editors, resolvedImages]);

  const writes = editorsWrites(editors, answer, question);
  const canSave = (writes.link || writes.question) && !save.isPending;

  // Pendant l'enregistrement, la liste est figée : le succès ferme le dialogue, et une retouche
  // faite entre-temps serait perdue sans avoir été écrite.
  const handleAdd = (elements: FinderElement[]) => {
    if (save.isPending) return;
    setEditors((prev) => {
      const next = { ...prev };
      for (const el of elements) next[el.id] = { id: el.id, name: el.name, type: "citoyens" };
      return next;
    });
  };

  const handleRemove = (id: string) => {
    if (save.isPending) return;
    setEditors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const finderConfig: FinderConfig = {
    ...EDITORS_FINDER_BASE,
    // Explicite : le titre dérivé du libellé donnerait « Rechercher un Personne ».
    title: String(t("detail.editors.finderTitle")),
    elementLabel: String(t("detail.editors.finderLabel")),
    buttonLabel: String(t("detail.editors.addCta")),
    placeholderSearchField: String(t("detail.editors.finderPlaceholder")),
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert && !save.isPending) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{String(t("detail.editors.title"))}</DialogTitle>
          <DialogDescription>
            {String(t("detail.editors.description"))}
            {question && (
              <>
                {" "}
                {String(t("detail.editors.questionNote", undefined, { label: question.label }))}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2" data-commun-editors-list="">
          {displayed.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {String(t("detail.editors.empty"))}
            </p>
          ) : (
            displayed.map((element) => (
              <FinderElementCard
                key={element.id}
                element={element}
                canRemove={!save.isPending}
                canEdit={false}
                onRemove={handleRemove}
              />
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() => setFinderOpen(true)}
          disabled={save.isPending}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3",
            "text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          <UserPlus aria-hidden="true" className="size-4" />
          <span>{String(t("detail.editors.addCta"))}</span>
        </button>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
            {String(t("detail.editors.cancel"))}
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => save.mutate({ editors }, { onSuccess: onClose })}
            className="gap-2"
          >
            {save.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {String(t("detail.editors.save"))}
          </Button>
        </DialogFooter>

        {/* Monté DANS le contenu du dialogue, comme `FinderField` dans `CoFormModal` : les
            couches Radix s'imbriquent alors comme partout ailleurs dans le dépôt. */}
        {finderOpen && (
          <FinderSearchModal
            config={finderConfig}
            selectedElements={editors}
            onClose={() => setFinderOpen(false)}
            onValidate={handleAdd}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
