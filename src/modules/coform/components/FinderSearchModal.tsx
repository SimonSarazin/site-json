import { useState, useMemo } from "react";
import { Search, Plus, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  const dialogTitle = config.elementLabel
    ? String(t("coform.finder.modal.titleWithLabel", undefined, { label: config.elementLabel }))
    : String(t("coform.finder.modal.title"));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="px-6 py-4 border-b">
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={config.placeholderSearchField || String(t("coform.finder.modal.searchPlaceholder"))}
              aria-label={String(t("coform.finder.modal.searchPlaceholder"))}
              className="pl-10"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Spinner label={String(t("coform.status.loading", "Chargement"))} />
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
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
          {searchQuery.length < 2 && !isSearching && (
            <div className="text-center py-8 text-muted-foreground">
              <Search aria-hidden="true" className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{String(t("coform.finder.modal.searchHint"))}</p>
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
      </DialogContent>
    </Dialog>
  );
}
