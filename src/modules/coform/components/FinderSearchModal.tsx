import { useState, useRef, useEffect } from "react";
import { Search, X, Plus, Loader2, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCocolight } from "@/hooks/useCocolight";
import { useDebounce } from "@/hooks/useDebounce";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";
import type { FinderConfig, FinderElement, FinderSearchResult, FinderElementType } from "../types";
import { FinderElementCard } from "./FinderElementCard";

interface FinderSearchModalProps {
  /** Configuration du finder */
  config: FinderConfig;
  /** Éléments déjà sélectionnés (pour les exclure des résultats) */
  selectedElements: Record<string, FinderElement>;
  /** Modal ouvert */
  isOpen: boolean;
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
 */
export function FinderSearchModal({
  config,
  selectedElements,
  isOpen,
  onClose,
  onValidate,
  baseUrl = "",
}: FinderSearchModalProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  const { entity } = useCocolight();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FinderSearchResult[]>([]);
  const [selectedInModal, setSelectedInModal] = useState<Record<string, FinderElement>>({});
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Debounce de la requête de recherche
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedInModal({});
      setShowInviteForm(false);
      setShowAddNew(false);
      // Focus sur l'input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  /**
   * Recherche via l'API Cocolight (searchCostum) - déclenchée par le debounce
   */
  useEffect(() => {
    // Ne pas rechercher si moins de 2 caractères ou modal fermé
    if (debouncedSearchQuery.length < 2 || !isOpen) {
      if (debouncedSearchQuery.length < 2) {
        setSearchResults([]);
        setShowInviteForm(false);
        setShowAddNew(false);
      }
      return;
    }

    if (!entity) {
      console.warn("Finder: entity not available for search");
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      setShowInviteForm(false);
      setShowAddNew(false);

      try {
        // Construire les paramètres de recherche
        const searchType = Array.isArray(config.type) ? config.type : [config.type];
        
        const param: Partial<GlobalAutocompleteCostumData> = {
          name: debouncedSearchQuery,
          searchType: searchType as GlobalAutocompleteCostumData["searchType"],
          indexMin: 0,
          indexStep: 30,
        };

        // Ajouter les filtres si présents
        if (config.filters && config.filters.length > 0) {
          const filters: Record<string, string> = {};
          config.filters.forEach((f) => {
            filters[f.attributeName] = f.valueName;
          });
          param.filters = filters;
        }

        if (config.notSourceKey) {
          param.notSourceKey = true;
        }

        // Appel API via le client Cocolight
        const result = await entity.searchCostum(param);

        // Les results sont un objet avec des IDs comme clés (ou un array)
        const resultsObj = result?.results || {};
        
        // Convertir les résultats et filtrer les déjà sélectionnés
        // Le SDK Cocolight encapsule les données dans _serverData
        const results = Object.entries(resultsObj)
          .map(([key, item]: [string, unknown]) => {
            // Le SDK encapsule les données dans _serverData (avec underscore)
            const entityItem = item as { _serverData?: Record<string, unknown>; serverData?: Record<string, unknown> };
            const rawData = entityItem._serverData || entityItem.serverData || item as Record<string, unknown>;
            
            // Obtenir le vrai MongoDB ID depuis _serverData.id
            let mongoId: string = key;
            if (rawData.id && typeof rawData.id === "string") {
              mongoId = rawData.id;
            } else if (rawData._id) {
              if (typeof rawData._id === "object" && rawData._id !== null && "$oid" in (rawData._id as object)) {
                mongoId = (rawData._id as { $oid: string }).$oid;
              } else if (typeof rawData._id === "string") {
                mongoId = rawData._id;
              }
            }
            
            return {
              id: mongoId,
              name: (rawData.name as string) || String(t("coform.finder.fallbackElement")),
              type: (rawData.collection as string) || (rawData.type as string) || (Array.isArray(config.type) ? config.type[0] : config.type),
              profilThumbImageUrl: rawData.profilThumbImageUrl as string | undefined,
              email: rawData.email as string | undefined,
              address: rawData.address as {
                streetAddress?: string;
                postalCode?: string;
                addressLocality?: string;
              } | undefined,
            };
          })
          .filter((result) => !selectedElements[result.id]);

        setSearchResults(results);

        // Afficher "Ajouter nouveau" si aucun résultat et addNew activé
        if (results.length === 0 && config.addNew) {
          setShowAddNew(true);
        }
        // Afficher formulaire d'invitation si aucun résultat et invite activé
        else if (results.length === 0 && config.invite) {
          setShowInviteForm(true);
        }
      } catch (error) {
        console.error("Erreur de recherche:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearchQuery, isOpen, entity, config, selectedElements]);

  /**
   * Gestion de la saisie - le debounce est géré par useDebounce
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  /**
   * Sélectionner/désélectionner un élément
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
        // Convertir l'URL d'image en chemin relatif (sans le domaine)
        let relativeImg: string | undefined;
        if (result.profilThumbImageUrl) {
          try {
            const url = new URL(result.profilThumbImageUrl, window.location.origin);
            relativeImg = url.pathname + url.search;
          } catch {
            // Si ce n'est pas une URL complète, utiliser tel quel
            relativeImg = result.profilThumbImageUrl;
          }
        }
        
        newSelection[result.id] = {
          id: result.id,
          name: result.name,
          type: result.type as FinderElementType,
          img: relativeImg,
        };
      }
      return newSelection;
    });
  };

  /**
   * Valider la sélection
   */
  const handleValidate = () => {
    const elements = Object.values(selectedInModal);
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

  if (!isOpen) return null;

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
              ref={inputRef}
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
