import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, Plus, Mail, UserPlus } from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { DynamicModal } from "@/modules/profil/components/add/ModalRegistry";
import type { FinderConfig, FinderElement, FinderElementType, FinderSearchResult } from "../types";
import { FinderElementCard } from "./FinderElementCard";
import { toRelativeImageUrl } from "../utils";
import { createdToFinderElement } from "../utils/finderAddNew";
import { FINDER_MIN_CHARS, useFinderSearchResults } from "../hooks/useFinderSearchResults";
import { COFORM_QUERY_KEYS } from "../constants/queryKeys";

interface FinderSearchModalProps {
  /** Configuration du finder */
  config: FinderConfig;
  /** Éléments déjà sélectionnés (pour les exclure des résultats) */
  selectedElements: Record<string, FinderElement>;
  /** Fermer le modal */
  onClose: () => void;
  /** Callback de validation des éléments sélectionnés */
  onValidate: (elements: FinderElement[]) => void;
  /** URL de base pour les images */
  baseUrl?: string;
  /**
   * Modale d'AJOUT du bouton « Ajouter » (`config.addNew`), résolue par l'appelant
   * (`resolveFinderAddNewModal`). Absente : pas de bouton.
   */
  addNewModal?: string | null;
}

/**
 * Modal de recherche d'éléments pour le Finder
 * Utilise le client API Cocolight pour les recherches
 *
 * Le composant est mount conditionnellement par `FinderField` (`{isModalOpen && ...}`),
 * donc son state interne est toujours frais à l'ouverture — pas de useEffect de reset
 * nécessaire. Le focus initial sur l'input est géré par `autoFocus` qui marche
 * naturellement puisque le composant est nouvellement monté.
 */
export function FinderSearchModal({
  config,
  selectedElements,
  onClose,
  onValidate,
  baseUrl = "",
  addNewModal = null,
}: FinderSearchModalProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInModal, setSelectedInModal] = useState<Record<string, FinderElement>>({});
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();
  const champRef = useRef<HTMLInputElement>(null);

  // Hook React Query — encapsule debounce + searchCostum + transformation.
  const {
    results: rawSearchResults,
    isFetching: isSearching,
    isCurrentAnswer,
    error: searchError,
    retry,
    canRetry,
  } = useFinderSearchResults({ query: searchQuery, config });

  // Filtrage local des éléments déjà sélectionnés + fallback name.
  // Volontairement local au composant (hors hook) pour que le cache RQ reste
  // stable même quand l'utilisateur sélectionne/désélectionne.
  const searchResults = useMemo(() => {
    const fallbackName = String(t("coform.finder.fallbackElement"));
    return rawSearchResults
      .filter((r) => !selectedElements[r.id])
      .map((r) => (r.name ? r : { ...r, name: fallbackName }));
  }, [rawSearchResults, selectedElements, t]);

  // États d'affichage. Seule une réponse COURANTE — debounce écoulé, pas une liste conservée — conclut :
  // « aucun résultat », « déjà dans la liste », « Ajouter ». D'ici là, une liste précédente reste
  // affichée (cf. `useFinderSearchResults`), ou « Recherche en cours… » tient la place ; la modale, de
  // hauteur fixe, ne saute pas. Une erreur se dit, avec de quoi relancer.
  const hasMinChars = searchQuery.length >= FINDER_MIN_CHARS;
  const showError = hasMinChars && !!searchError && !isCurrentAnswer;
  const showResults = hasMinChars && searchResults.length > 0;
  const conclusion = hasMinChars && isCurrentAnswer && searchResults.length === 0;
  const noResults = conclusion && rawSearchResults.length === 0;
  // Tout ce qui répond est déjà dans la question : « aucun résultat » serait faux — il invitait à
  // créer un doublon de ce qui y est déjà.
  const allAlreadySelected = conclusion && rawSearchResults.length > 0;
  const awaitingAnswer = hasMinChars && !showError && searchResults.length === 0 && !isCurrentAnswer;
  const canAddNew = config.addNew && !!addNewModal;
  const showAddNew = (noResults || allAlreadySelected) && canAddNew;
  // Des résultats, mais pas le bon : le legacy proposait aussi l'ajout sous la liste. Jamais avant la
  // réponse de la saisie courante.
  const showAddNewBelow = showResults && isCurrentAnswer && canAddNew;
  const showInviteForm = noResults && !canAddNew && config.invite;
  const addNewLabel = config.elementLabel || String(t("coform.finder.fallbackElement"));

  /**
   * Gestion de la saisie - le debounce est géré par useDebounce
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  /**
   * Sélectionner/désélectionner un élément.
   *
   * Le store interne `selectedInModal` conserve l'URL d'image **absolue** (telle que
   * renvoyée par le backend) pour pouvoir l'afficher immédiatement via `<img src>` sans
   * passer par `baseUrl`. La conversion absolue → relative se fait au moment de la
   * persistance (cf. `commitSelection`).
   */
  const toggleSelection = (result: FinderSearchResult) => {
    setSelectedInModal((prev) => {
      const newSelection = { ...prev };
      if (newSelection[result.id]) {
        delete newSelection[result.id];
      } else {
        // Si mode single, vider la sélection précédente
        if (!config.multiple) {
          Object.keys(newSelection).forEach((key) => delete newSelection[key]);
        }
        newSelection[result.id] = {
          id: result.id,
          name: result.name,
          type: result.type as FinderElementType,
          img: result.profilThumbImageUrl,
        };
      }
      return newSelection;
    });
  };

  /**
   * Valider la sélection.
   *
   * On convertit les URLs d'image en chemins relatifs **avant** de remonter au parent
   * (cf. `toRelativeImageUrl`) — c'est la frontière "affichage interne ↔ persistance".
   * `FinderElementCard` (côté lecture) sait rebaser via la prop `baseUrl`.
   */
  const commitSelection = (created?: FinderElement) => {
    // Un élément créé REMPLACE la sélection d'un finder à choix unique, et s'y ajoute sinon.
    const base = created && !config.multiple ? [] : Object.values(selectedInModal);
    const elements = [...base, ...(created ? [created] : [])].map<FinderElement>((el) => ({
      ...el,
      img: toRelativeImageUrl(el.img),
    }));
    if (elements.length > 0) {
      onValidate(elements);
    }
    onClose();
  };

  const handleValidate = () => commitSelection();

  /**
   * « Ajouter » : ouvre la modale de création, imbriquée dans celle-ci. Comme le legacy
   * (`finder.addInForm`), l'élément créé est aussitôt rangé dans la question.
   */
  const handleAddNew = () => setIsCreating(true);
  const handleCreated = (entity: EntityTypes) => {
    // L'élément créé doit répondre à la prochaine recherche : la réponse VIDE gardée en cache se
    // donnerait pour courante, dirait « aucun résultat » et reproposerait « Ajouter » — un doublon.
    // `remove` et non `invalidate` : une donnée invalidée reste servie le temps du refetch.
    queryClient.removeQueries({ queryKey: COFORM_QUERY_KEYS.FINDER_SEARCH_PREFIX() });
    commitSelection(createdToFinderElement(entity));
  };

  // La relance retire l'alerte qui porte le bouton : le focus repart au champ, pas dans le vide.
  const handleRetry = () => {
    retry();
    champRef.current?.focus();
  };

  const dialogTitle = config.title
    ?? (config.elementLabel
      ? String(t("coform.finder.modal.titleWithLabel", undefined, { label: config.elementLabel }))
      : String(t("coform.finder.modal.title")));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      {/* Hauteur FIXE, zone de résultats qui défile : la modale ne change plus de taille selon
          l'état de la recherche — elle sautait de 84 px à chaque frappe (mesuré le 01/10). */}
      {/* `dvh` et non `vh` : sur mobile, `vh` vaut la GRANDE hauteur d'écran, barres du navigateur masquées. */}
      <DialogContent className="max-w-lg h-[min(36rem,85dvh)] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription className="sr-only">
            {String(t("coform.finder.modal.searchHint", undefined, { count: String(FINDER_MIN_CHARS) }))}
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="px-6 py-4 border-b">
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={champRef}
              autoFocus
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={config.placeholderSearchField || String(t("coform.finder.modal.searchPlaceholder"))}
              aria-label={String(t("coform.finder.modal.searchPlaceholder"))}
              className="pl-10"
            />
            {/* Visuel seulement : l'état se dit une fois, dans la zone de résultats. */}
            {isSearching && (
              <Loader2
                aria-hidden="true"
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground"
              />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {/* Zone sélectionnés */}
          {Object.keys(selectedInModal).length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {String(
                  t(
                    Object.keys(selectedInModal).length > 1
                      ? "coform.finder.modal.selectedHeading_other"
                      : "coform.finder.modal.selectedHeading_one"
                  )
                )}
              </div>
              <div className="space-y-2">
                {Object.values(selectedInModal).map((element) => (
                  <FinderElementCard
                    key={element.id}
                    element={element}
                    selectionMode
                    isSelected
                    onSelect={() => toggleSelection({ ...element, profilThumbImageUrl: element.img })}
                    baseUrl={baseUrl}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Résultats de recherche */}
          {showResults && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {String(t("coform.finder.modal.resultsHeading", undefined, { count: String(searchResults.length) }))}
              </div>
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <FinderElementCard
                    key={result.id}
                    element={{
                      id: result.id,
                      name: result.name,
                      type: result.type as FinderElementType,
                      img: result.profilThumbImageUrl
                    }}
                    selectionMode
                    isSelected={!!selectedInModal[result.id]}
                    onSelect={() => toggleSelection(result)}
                    baseUrl={baseUrl}
                  />
                ))}
              </div>
            </div>
          )}

          {showAddNewBelow && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3">
              <p className="text-sm text-muted-foreground">
                {String(t("coform.finder.modal.addNewNotListed", undefined, { label: addNewLabel }))}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={handleAddNew} className="gap-2">
                <Plus aria-hidden="true" className="w-4 h-4" />
                <span>{String(t("coform.finder.modal.addNewButton"))}</span>
              </Button>
            </div>
          )}

          {/* Réponse pas encore là pour CETTE saisie : la place est tenue, sans rien conclure. Un seul
              `role="status"`, pour une seule annonce. */}
          {awaitingAnswer && (
            <div role="status" className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              <span>{String(t("coform.finder.modal.searching"))}</span>
            </div>
          )}

          {showError && (
            <div role="alert" className="text-center py-8 text-muted-foreground">
              <p>{String(t("coform.finder.modal.searchError"))}</p>
              {canRetry && (
                <Button type="button" variant="outline" size="sm" onClick={handleRetry} className="mt-3">
                  {String(t("coform.finder.modal.retry"))}
                </Button>
              )}
            </div>
          )}

          {(noResults || allAlreadySelected) && !showInviteForm && (
            <div className="text-center py-8 text-muted-foreground">
              <p>
                {String(
                  t(
                    noResults ? "coform.finder.modal.noResults" : "coform.finder.modal.allAlreadySelected",
                    undefined,
                    { query: searchQuery }
                  )
                )}
              </p>
              {showAddNew && (
                <div className="mt-4">
                  <p className="text-sm mb-2">
                    {String(t("coform.finder.modal.addNewPrompt", undefined, { label: addNewLabel }))}
                  </p>
                  <Button type="button" onClick={handleAddNew} className="gap-2">
                    <Plus aria-hidden="true" className="w-4 h-4" />
                    <span>{String(t("coform.finder.modal.addNewButton"))}</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Formulaire d'invitation */}
          {showInviteForm && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus aria-hidden="true" className="w-5 h-5 text-primary" />
                <span className="font-medium">{String(t("coform.finder.modal.inviteTitle"))}</span>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="finder-invite-name" className="text-sm font-medium">
                    {String(t("coform.finder.modal.inviteNameLabel"))}
                  </Label>
                  <Input
                    id="finder-invite-name"
                    type="text"
                    placeholder={String(t("coform.finder.modal.inviteNamePlaceholder"))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="finder-invite-email" className="text-sm font-medium">
                    {String(t("coform.finder.modal.inviteEmailLabel"))}
                  </Label>
                  <Input
                    id="finder-invite-email"
                    type="email"
                    placeholder={String(t("coform.finder.modal.inviteEmailPlaceholder"))}
                    className="mt-1"
                  />
                </div>
                <Button type="button" className="gap-2">
                  <Mail aria-hidden="true" className="w-4 h-4" />
                  <span>{String(t("coform.finder.modal.inviteSendButton"))}</span>
                </Button>
              </div>
            </div>
          )}

          {/* Placeholder initial */}
          {!hasMinChars && (
            <div className="text-center py-8 text-muted-foreground">
              <Search aria-hidden="true" className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{String(t("coform.finder.modal.searchHint", undefined, { count: String(FINDER_MIN_CHARS) }))}</p>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            {String(t("coform.finder.modal.cancel"))}
          </Button>
          <Button
            type="button"
            onClick={handleValidate}
            disabled={Object.keys(selectedInModal).length === 0}
          >
            {String(t("coform.finder.modal.validate"))}
          </Button>
        </DialogFooter>

        {/* Création — montée DANS la modale de recherche (dialogue imbriqué : Échap ne ferme
            que le dessus), et seulement à l'ouverture. Le nom tapé pré-remplit le formulaire. */}
        {isCreating && addNewModal && (
          <DynamicModal
            modalName={addNewModal}
            open
            onOpenChange={(open) => { if (!open) setIsCreating(false); }}
            createDefaults={{ name: searchQuery.trim() }}
            onCreated={handleCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
