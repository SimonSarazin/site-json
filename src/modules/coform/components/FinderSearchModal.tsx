import { useState, useMemo } from "react";
import { Search, X, Plus, Loader2, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { FinderConfig, FinderElement, FinderElementType, FinderSearchResult } from "../types";
import { FinderElementCard } from "./FinderElementCard";
import { toRelativeImageUrl } from "../utils";
import { useFinderSearchResults } from "../hooks/useFinderSearchResults";

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
}: FinderSearchModalProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInModal, setSelectedInModal] = useState<Record<string, FinderElement>>({});

  // Hook React Query — encapsule debounce + searchCostum + transformation.
  const { results: rawSearchResults, isFetching: isSearching } = useFinderSearchResults({
    query: searchQuery,
    config,
  });

  // Filtrage local des éléments déjà sélectionnés + fallback name.
  // Volontairement local au composant (hors hook) pour que le cache RQ reste
  // stable même quand l'utilisateur sélectionne/désélectionne.
  const searchResults = useMemo(() => {
    const fallbackName = String(t("coform.finder.fallbackElement"));
    return rawSearchResults
      .filter((r) => !selectedElements[r.id])
      .map((r) => (r.name ? r : { ...r, name: fallbackName }));
  }, [rawSearchResults, selectedElements, t]);

  // CTA dérivés : pas besoin de useState, ils sont fonction du flow courant.
  const hasMinChars = searchQuery.length >= 2;
  const noResults = hasMinChars && !isSearching && searchResults.length === 0;
  const showAddNew = noResults && config.addNew;
  const showInviteForm = noResults && !config.addNew && config.invite;

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
   * persistance (cf. `handleValidate`).
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
  const handleValidate = () => {
    const elements = Object.values(selectedInModal).map<FinderElement>((el) => ({
      ...el,
      img: toRelativeImageUrl(el.img),
    }));
    if (elements.length > 0) {
      onValidate(elements);
    }
    onClose();
  };

  /**
   * Créer un nouvel élément (placeholder - à implémenter avec le formulaire de création).
   * TODO: Ouvrir un formulaire de création d'élément.
   */
  const handleAddNew = () => {
    console.log("Add new element of type:", config.type);
    toast.info(`Fonctionnalité à implémenter : créer un nouvel élément de type « ${config.elementLabel} »`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">
            {config.elementLabel
              ? String(t("coform.finder.modal.titleWithLabel", undefined, { label: config.elementLabel }))
              : String(t("coform.finder.modal.title"))}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={config.placeholderSearchField || String(t("coform.finder.modal.searchPlaceholder"))}
              className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
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
          {searchResults.length > 0 && (
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

          {/* Message si aucun résultat */}
          {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && !showInviteForm && (
            <div className="text-center py-8 text-muted-foreground">
              <p>{String(t("coform.finder.modal.noResults", undefined, { query: searchQuery }))}</p>
              {showAddNew && (
                <div className="mt-4">
                  <p className="text-sm mb-2">
                    {String(t("coform.finder.modal.addNewPrompt", undefined, {
                      label: config.elementLabel || String(t("coform.finder.fallbackElement")),
                    }))}
                  </p>
                  <button
                    type="button"
                    onClick={handleAddNew}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{String(t("coform.finder.modal.addNewButton"))}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Formulaire d'invitation */}
          {showInviteForm && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-5 h-5 text-primary" />
                <span className="font-medium">{String(t("coform.finder.modal.inviteTitle"))}</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">{String(t("coform.finder.modal.inviteNameLabel"))}</label>
                  <input
                    type="text"
                    placeholder={String(t("coform.finder.modal.inviteNamePlaceholder"))}
                    className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{String(t("coform.finder.modal.inviteEmailLabel"))}</label>
                  <input
                    type="email"
                    placeholder={String(t("coform.finder.modal.inviteEmailPlaceholder"))}
                    className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  <Mail className="w-4 h-4" />
                  <span>{String(t("coform.finder.modal.inviteSendButton"))}</span>
                </button>
              </div>
            </div>
          )}

          {/* Placeholder initial */}
          {searchQuery.length < 2 && !isSearching && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{String(t("coform.finder.modal.searchHint"))}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
          >
            {String(t("coform.finder.modal.cancel"))}
          </button>
          <button
            type="button"
            onClick={handleValidate}
            disabled={Object.keys(selectedInModal).length === 0}
            className={cn(
              "px-4 py-2 rounded-md transition-colors",
              Object.keys(selectedInModal).length > 0
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {String(t("coform.finder.modal.validate"))}
          </button>
        </div>
      </div>
    </div>
  );
}
