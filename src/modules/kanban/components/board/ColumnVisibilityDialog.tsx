import { useRef } from "react";
import { flushSync } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBoardPrefs } from "./boardPrefs";
import { pruneHiddenColumns, type HiddenColumnsScope } from "./hiddenColumns";

/** Une case de la boîte : une colonne du tableau, ou une colonne de rôle. */
export interface ColumnVisibilityEntry {
  /** Identifiant tel que stocké dans la préférence (id de colonne, nom de rôle). */
  id: string;
  label: string;
  /** Colonne secondaire, déjà traduite : « N cartes », « N membres ». */
  detail: string;
}

export interface ColumnVisibilityDialogProps {
  open: boolean;
  /** Portée de la préférence lue et écrite. */
  scope?: HiddenColumnsScope;
  /** Colonnes, dans l'ordre affiché. */
  entries: readonly ColumnVisibilityEntry[];
  /** Phrase sous le titre ; par défaut celle du tableau. */
  description?: string;
  onClose: () => void;
}

/**
 * « Colonnes affichées », reprise de co-kanban sur le `Dialog` du site.
 *
 * Une préférence de POSTE : rien ne part au serveur, rien ne change pour les autres membres —
 * la boîte le dit, pour que personne ne croie avoir supprimé un rôle de l'organisation. Cases
 * NATIVES : état annoncé, barre d'espace et clic sur le libellé fournis par le navigateur.
 */
export default function ColumnVisibilityDialog({ open, scope = "kanban", entries, description, onClose }: ColumnVisibilityDialogProps) {
  const { t } = useTranslation("modules/kanban");
  const { hiddenColumnIds, toggleColumn, showAllColumns, hideAllColumns } = useBoardPrefs(scope);
  // Seules les colonnes qui EXISTENT comptent : le stockage peut garder l'id d'une colonne
  // supprimée depuis, et « Tout afficher » resterait actif alors que tout est coché.
  const hiddenExisting = pruneHiddenColumns(
    hiddenColumnIds,
    entries.map((entry) => entry.id),
  );
  const allHidden = entries.length > 0 && hiddenExisting.length === entries.length;

  /*
   * « Tout masquer » et « Tout afficher » se DÉSACTIVENT dès qu'ils ont agi : au clavier, le
   * bouton focalisé devenait inactif et le navigateur rendait le focus à <body>, dans une boîte
   * modale (WCAG 2.4.3). Le focus passe donc au bouton JUMEAU, que le même geste vient
   * d'activer : `flushSync` applique d'abord la préférence, puis le focus se pose.
   */
  const hideAllRef = useRef<HTMLButtonElement>(null);
  const showAllRef = useRef<HTMLButtonElement>(null);
  function hideAll() {
    flushSync(hideAllColumns);
    showAllRef.current?.focus();
  }
  function showAll() {
    flushSync(showAllColumns);
    hideAllRef.current?.focus();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("columnVisibility.title")}</DialogTitle>
          <DialogDescription>{description ?? t("columnVisibility.description")}</DialogDescription>
        </DialogHeader>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("columnVisibility.empty")}</p>
        ) : (
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="sr-only">{t("columnVisibility.title")}</legend>
            {/* Liste bornée et défilante : une organisation porte parfois des dizaines de rôles. */}
            <ul className="-mx-1 flex max-h-[50dvh] flex-col gap-1 overflow-y-auto px-1">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm text-foreground hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={!hiddenColumnIds.includes(entry.id)}
                      onChange={() => toggleColumn(entry.id)}
                      className="size-4 shrink-0 cursor-pointer accent-primary"
                    />
                    <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{entry.detail}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button ref={hideAllRef} variant="ghost" disabled={allHidden || entries.length === 0} onClick={hideAll}>
              <EyeOff aria-hidden />
              {t("columnVisibility.hideAll")}
            </Button>
            <Button ref={showAllRef} variant="ghost" disabled={hiddenExisting.length === 0} onClick={showAll}>
              <Eye aria-hidden />
              {t("columnVisibility.showAll")}
            </Button>
          </div>
          <Button onClick={onClose}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
