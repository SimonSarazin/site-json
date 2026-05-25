import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { FieldErrors } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldError } from "./FormFields";
import type { FormFieldMapping, MultiCheckboxPlusValue, MultiCheckboxPlusSelectedOption } from "../types";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "../i18n/i18n";

// Import HintText depuis FormFields (on le réutilise)
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function HintText({ text }: { text: string }) {
  return (
    <div className="text-xs text-muted-foreground -mt-1 mb-1 prose prose-xs dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

interface MultiCheckboxPlusFieldProps {
  field: FormFieldMapping;
  errors: FieldErrors;
  value?: MultiCheckboxPlusValue;
  onChange?: (value: MultiCheckboxPlusValue) => void;
  /** Callback pour notifier les options ajoutées dynamiquement (pour sauvegarde côté serveur) */
  onAddedOptionsChange?: (addedOptions: string[]) => void;
}

/**
 * Composant pour le champ multiCheckboxPlus
 * Checkbox avec options simples ou complexes (avec champ texte)
 */
export function MultiCheckboxPlusField({ 
  field, 
  errors, 
  value = [], 
  onChange,
  onAddedOptionsChange,
}: MultiCheckboxPlusFieldProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");
  
  // Options originales du formulaire (immuables)
  const originalOptions = useMemo(() => field.options || [], [field.options]);
  
  // Options ajoutées dynamiquement par l'utilisateur
  const [addedOptions, setAddedOptions] = useState<string[]>([]);
  
  // Toutes les options (originales + ajoutées)
  const options = useMemo(() => [...originalOptions, ...addedOptions], [originalOptions, addedOptions]);
  
  const config = field.multiCheckboxPlusConfig;

  // État local pour les textes supplémentaires (pour type cplx)
  const [textInputs, setTextInputs] = useState<Record<string, string>>(() => {
    // Initialiser depuis la valeur existante
    const initial: Record<string, string> = {};
    for (const item of value) {
      const key = Object.keys(item)[0];
      if (key && item[key]?.textsup) {
        initial[key] = item[key].textsup || "";
      }
    }
    return initial;
  });

  // Synchroniser textInputs avec value quand la prop change (ex: retour sur étape)
  useEffect(() => {
    const newTextInputs: Record<string, string> = {};
    for (const item of value) {
      const key = Object.keys(item)[0];
      if (key && item[key]?.textsup) {
        newTextInputs[key] = item[key].textsup || "";
      }
    }
    setTextInputs(newTextInputs);
  }, [value]);

  // État pour tracker les inputs touchés (pour n'afficher l'erreur qu'après blur)
  const [touchedInputs, setTouchedInputs] = useState<Record<string, boolean>>({});
  
  // Refs pour le focus automatique
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  
  // État pour l'ajout de nouvelle valeur
  const [newValueInput, setNewValueInput] = useState("");
  const newValueInputRef = useRef<HTMLInputElement | null>(null);

  // Map pour accéder facilement aux options sélectionnées
  const selectedMap = useMemo(() => {
    const map: Record<string, MultiCheckboxPlusSelectedOption> = {};
    for (const item of value) {
      const key = Object.keys(item)[0];
      if (key) {
        map[key] = item[key];
      }
    }
    return map;
  }, [value]);

  // Vérifie si une option est sélectionnée
  const isOptionSelected = useCallback((option: string) => {
    return option in selectedMap;
  }, [selectedMap]);

  // Gère le changement d'une checkbox
  const handleCheckboxChange = useCallback((option: string, checked: boolean) => {
    if (!onChange) return;
    
    const optionType = config?.tofill?.[option] || "simple";
    
    if (checked) {
      // Vérifier la limite
      if (config?.nbAnswersMax && value.length >= config.nbAnswersMax) {
        // On pourrait afficher un toast ici
        return;
      }
      
      // Ajouter l'option
      const newItem: Record<string, MultiCheckboxPlusSelectedOption> = {
        [option]: {
          value: option,
          type: optionType,
          rank: config?.rank ? value.length + 1 : undefined,
          textsup: optionType === "cplx" ? (textInputs[option] || "") : undefined,
        }
      };
      onChange([...value, newItem]);
      
      // Focus automatique sur l'input si type cplx
      if (optionType === "cplx") {
        setTimeout(() => {
          inputRefs.current[option]?.focus();
        }, 50);
      }
    } else {
      // Retirer l'option et recalculer les rangs
      const newValue = value
        .filter(item => Object.keys(item)[0] !== option)
        .map((item, index) => {
          if (config?.rank) {
            const key = Object.keys(item)[0];
            return {
              [key]: {
                ...item[key],
                rank: index + 1
              }
            };
          }
          return item;
        });
      onChange(newValue);
      
      // Nettoyer le texte local et l'état touched
      setTextInputs(prev => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [option]: _removed, ...rest } = prev;
        return rest;
      });
      setTouchedInputs(prev => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [option]: _removed, ...rest } = prev;
        return rest;
      });
    }
  }, [onChange, value, config, textInputs]);

  // Gère l'ajout d'une nouvelle valeur dynamique
  const handleAddNewValue = useCallback(() => {
    const trimmed = newValueInput.trim();
    if (!trimmed || options.includes(trimmed)) return;
    
    const newAddedOptions = [...addedOptions, trimmed];
    setAddedOptions(newAddedOptions);
    setNewValueInput("");
    
    // Notifier le parent des options ajoutées
    onAddedOptionsChange?.(newAddedOptions);
    
    // Focus sur le nouvel input
    newValueInputRef.current?.focus();
  }, [newValueInput, options, addedOptions, onAddedOptionsChange]);
  // Gère le changement du texte supplémentaire
  const handleTextChange = useCallback((option: string, text: string) => {
    setTextInputs(prev => ({ ...prev, [option]: text }));
    
    if (!onChange) return;
    
    // Mettre à jour la valeur
    const newValue = value.map(item => {
      const key = Object.keys(item)[0];
      if (key === option) {
        return {
          [key]: {
            ...item[key],
            textsup: text
          }
        };
      }
      return item;
    });
    onChange(newValue);
  }, [onChange, value]);

  // Obtient le rang d'une option
  const getOptionRank = useCallback((option: string): number | undefined => {
    return selectedMap[option]?.rank;
  }, [selectedMap]);

  return (
    <div className={cn("space-y-4", field.width)}>
      {/* Label principal */}
      <Label className="text-sm font-medium text-foreground">
        {field.label}
        {field.isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      {/* Info du champ */}
      {field.info && <HintText text={field.info} />}
      
      {/* Limite de sélection */}
      {config?.nbAnswersMax && (
        <p className="text-xs text-muted-foreground">
          {t("coform.multiCheckboxPlus.maxSelections", `Maximum ${config.nbAnswersMax} choix`, { max: config.nbAnswersMax })}
          {" "}({value.length}/{config.nbAnswersMax})
        </p>
      )}

      {/* Liste des options */}
      <div className="flex-col space-y-0.5">
        {options.map((option, index) => {
          const isSelected = isOptionSelected(option);
          const optionType = config?.tofill?.[option] || "simple";
          const optionInfo = config?.optinfo?.[option];
          const placeholder = config?.placeholdersckb?.[option] || "";
          const rank = getOptionRank(option);
          const isCplx = optionType === "cplx";
          const isTouched = touchedInputs[option];
          const showCplxError = config?.mandatoryCplx && isTouched && !textInputs[option];
          const optionImages = config?.optimage?.[option] || [];
          const hasExtras = isCplx || !!optionInfo || optionImages.length > 0;

          return (
            <div key={index} className="py-1">
              <div className={cn(
                "flex gap-2.5 cursor-pointer",
                hasExtras ? "items-start" : "items-center"
              )}>
                {/* Checkbox */}
                <Checkbox
                  id={`${field.name}-${index}`}
                  checked={isSelected}
                  onCheckedChange={(checked) => handleCheckboxChange(option, checked as boolean)}
                  className={hasExtras ? "mt-0.5" : ""}
                />
                
                <div className="flex-1">
                  {/* Label de l'option + badge rank */}
                  <div className="flex items-center gap-2">
                    <Label 
                      htmlFor={`${field.name}-${index}`} 
                      className="font-normal cursor-pointer flex-1"
                    >
                      {option}
                    </Label>
                    
                    {/* Badge de rang */}
                    {config?.rank && isSelected && rank && (
                      <Badge variant="secondary" className="text-xs">
                        #{rank}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Info de l'option */}
                  {optionInfo && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {optionInfo}
                    </p>
                  )}
                  
                  {/* Images de l'option */}
                  {optionImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {optionImages.map((imagePath, imgIndex) => (
                        <img
                          key={imgIndex}
                          src={imagePath}
                          alt={`${option} - ${imgIndex + 1}`}
                          className="max-h-24 rounded-md border border-border object-contain"
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Champ texte conditionnel (type cplx) */}
                  {isCplx && isSelected && (
                    <div className="mt-2">
                      <Input
                        ref={(el) => { inputRefs.current[option] = el; }}
                        placeholder={placeholder || t("coform.multiCheckboxPlus.enterDetails", "Précisez...")}
                        value={textInputs[option] || ""}
                        onChange={(e) => handleTextChange(option, e.target.value)}
                        onBlur={() => setTouchedInputs(prev => ({ ...prev, [option]: true }))}
                        className={cn(
                          "text-sm",
                          showCplxError && "border-destructive"
                        )}
                      />
                      {showCplxError && (
                        <p className="text-xs text-destructive mt-1">
                          {t("coform.multiCheckboxPlus.textRequired", "Ce champ est obligatoire")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Ajout dynamique de valeur */}
        {config?.addValue && (
          <div className="flex items-center gap-2 pt-2">
            <Input
              ref={newValueInputRef}
              placeholder={config.newValuePlaceholder || t("coform.multiCheckboxPlus.addNewValue", "Ajouter une option...")}
              value={newValueInput}
              onChange={(e) => setNewValueInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddNewValue();
                }
              }}
              className="text-sm flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddNewValue}
              disabled={!newValueInput.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Erreur de validation */}
      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}
