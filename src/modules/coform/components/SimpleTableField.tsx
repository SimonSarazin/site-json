import { useState, useCallback, useRef, useId, memo } from "react";
import type { FieldErrors } from "react-hook-form";
import { Trash2, Plus, ImagePlus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ImageViewer } from "@/components/ui/image-viewer";
import { FieldError, HintText } from "./FormFields";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { FormFieldMapping, SimpleTableValue, SimpleTableConfig, SimpleTableCell, ImageUploadValue } from "../types";
import { validateImageFile, compressImage, canCompressImage, DEFAULT_IMAGE_VALIDATION_CONFIG } from "@/utils/imageUtils";
import { getBaseUrl } from "@/lib/constant/common";
import { toast } from "sonner";
import {
  buildEmptySimpleTableRow,
  buildSimpleTableHeaders,
  upsertSimpleTableRow,
  removeSimpleTableRow,
} from "../utils/simpleTable";

/** Résout une src d'image (data URL / absolue / relative au baseUrl). */
function resolveMediaSrc(baseUrl: string, src: string): string {
  if (!src) return src;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:")) return src;
  if (src.startsWith("/")) return `${baseUrl}${src}`;
  return `${baseUrl}/${src}`;
}

// ─── Image Cell Component ──────────────────────────────────────

interface ImageCellProps {
  value: SimpleTableCell | SimpleTableCell[];
  multiple: boolean;
  onChange: (value: SimpleTableCell | SimpleTableCell[]) => void;
  ariaLabel: string;
  readOnly?: boolean;
}

const ImageCell = memo(function ImageCell({ value, multiple, onChange, ariaLabel, readOnly }: ImageCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const baseUrl = getBaseUrl();
  const [viewerOpen, setViewerOpen] = useState<number | null>(null);

  const resolveImageSrc = useCallback((src: string) => resolveMediaSrc(baseUrl, src), [baseUrl]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const processed: ImageUploadValue[] = [];
    for (const file of Array.from(files)) {
      const validation = validateImageFile(file, DEFAULT_IMAGE_VALIDATION_CONFIG);
      if (!validation.valid) {
        toast.error(validation.error);
        continue;
      }

      let finalFile = file;
      if (canCompressImage(file)) {
        try {
          finalFile = await compressImage(file, { maxWidthOrHeight: 800, quality: 0.8 });
        } catch {
          // Use original if compression fails
        }
      }

      // Convert to data URL for preview; wrap with original filename for server-side upload
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(finalFile);
      });
      processed.push({ name: file.name, data: dataUrl } satisfies ImageUploadValue);
    }

    if (processed.length === 0) return;

    if (multiple) {
      const existing = Array.isArray(value) ? value : value ? [value] : [];
      onChange([...existing, ...processed]);
    } else {
      onChange(processed[0]);
    }

    // Reset file input
    if (inputRef.current) inputRef.current.value = "";
  }, [value, multiple, onChange]);

  const handleRemoveImage = useCallback((index: number) => {
    if (multiple && Array.isArray(value)) {
      const updated = value.filter((_, i) => i !== index);
      onChange(updated);
    } else {
      onChange(multiple ? [] : "");
    }
  }, [value, multiple, onChange]);

  const images: SimpleTableCell[] = multiple
    ? (Array.isArray(value) ? value as SimpleTableCell[] : (value ? [value as SimpleTableCell] : []))
    : (value ? [value as SimpleTableCell] : []);

  const viewerImages = images.map((item) => {
    const src = typeof item === "string" ? item : (item as ImageUploadValue).data;
    const name = typeof item === "string" ? item.split("/").pop() : (item as ImageUploadValue).name;
    return { src: resolveImageSrc(src), name };
  });

  return (
    <div className="flex flex-col gap-1 min-w-25">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {images.map((item, i) => {
            const src = typeof item === "string" ? item : item.data;
            return (
              <div key={i} className="relative group">
                <img
                  src={resolveImageSrc(src)}
                  alt={`${ariaLabel} ${i + 1}`}
                  className="w-12 h-12 object-cover rounded border cursor-pointer"
                  onClick={() => setViewerOpen(i)}
                />
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(i)}
                    className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-destructive-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        aria-label={ariaLabel}
      />
      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="w-3 h-3" />
          {images.length > 0 ? "+" : "Image"}
        </Button>
      )}
      <ImageViewer
        images={viewerImages}
        initialIndex={viewerOpen ?? 0}
        open={viewerOpen !== null}
        onClose={() => setViewerOpen(null)}
      />
    </div>
  );
});

// Shared styles for "spreadsheet" cell feel
const CELL_INPUT_CN =
  "border-0 shadow-none bg-transparent rounded-none px-3 py-2 h-9 w-full text-sm focus-visible:ring-0 focus-visible:ring-offset-0";
const CELL_CN =
  "p-0 border border-border hover:bg-muted/20 focus-within:bg-accent/10 focus-within:ring-1 focus-within:ring-inset focus-within:ring-ring/40 transition-colors";

// ─── Table Cell Renderer (édition inline) ───────────────────────

interface CellRendererProps {
  value: SimpleTableCell | SimpleTableCell[];
  columnType: string;
  rowIndex: number;
  colIndex: number;
  singleAnswerByLine: boolean;
  rowValues: (SimpleTableCell | SimpleTableCell[])[];
  columns: SimpleTableConfig["columns"];
  onCellChange: (rowIndex: number, colIndex: number, value: SimpleTableCell | SimpleTableCell[]) => void;
  readOnly?: boolean;
}

const CellRenderer = memo(function CellRenderer({
  value,
  columnType,
  rowIndex,
  colIndex,
  singleAnswerByLine,
  rowValues,
  columns,
  onCellChange,
  readOnly,
}: CellRendererProps) {
  const ariaLabel = `Ligne ${rowIndex}, ${columns[colIndex - 1]?.label || `Colonne ${colIndex}`}`;

  switch (columnType) {
    case "Text":
      return (
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onCellChange(rowIndex, colIndex, e.target.value)}
          aria-label={ariaLabel}
          className={CELL_INPUT_CN}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
        />
      );

    case "Nombre":
      return (
        <Input
          type="number"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onCellChange(rowIndex, colIndex, e.target.value)}
          aria-label={ariaLabel}
          className={CELL_INPUT_CN}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
        />
      );

    case "Case à cocher": {
      const isChecked = value === "x";
      return (
        <div className="flex justify-center">
          <Checkbox
            checked={isChecked}
            onCheckedChange={(checked) => {
              if (checked && singleAnswerByLine) {
                // Uncheck all other checkboxes in this row
                for (let c = 1; c < rowValues.length; c++) {
                  if (c !== colIndex && columns[c - 1]?.type === "Case à cocher") {
                    onCellChange(rowIndex, c, "");
                  }
                }
              }
              onCellChange(rowIndex, colIndex, checked ? "x" : "");
            }}
            aria-label={ariaLabel}
            disabled={readOnly}
          />
        </div>
      );
    }

    case "Image":
      return (
        <ImageCell
          value={Array.isArray(value) ? "" : (value as SimpleTableCell)}
          multiple={false}
          onChange={(v) => onCellChange(rowIndex, colIndex, v)}
          ariaLabel={ariaLabel}
          readOnly={readOnly}
        />
      );

    case "Images":
      return (
        <ImageCell
          value={Array.isArray(value) ? (value as SimpleTableCell[]) : []}
          multiple={true}
          onChange={(v) => onCellChange(rowIndex, colIndex, v)}
          ariaLabel={ariaLabel}
          readOnly={readOnly}
        />
      );

    default:
      return (
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onCellChange(rowIndex, colIndex, e.target.value)}
          aria-label={ariaLabel}
          className={CELL_INPUT_CN}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
        />
      );
  }
});

// ─── Rendu lecture seule d'une cellule (mode modal) ─────────────

function ReadOnlyCell({
  value,
  columnType,
  baseUrl,
}: {
  value: SimpleTableCell | SimpleTableCell[];
  columnType: string;
  baseUrl: string;
}) {
  if (columnType === "Case à cocher") {
    return value === "x" ? (
      <Check className="w-4 h-4 text-primary mx-auto" aria-label="Oui" />
    ) : (
      <span className="text-muted-foreground" aria-hidden="true">—</span>
    );
  }

  if (columnType === "Image" || columnType === "Images") {
    const items = Array.isArray(value) ? value : value ? [value] : [];
    if (items.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item, i) => {
          const src = typeof item === "string" ? item : item.data;
          return (
            <img
              key={i}
              src={resolveMediaSrc(baseUrl, src)}
              alt=""
              className="w-8 h-8 object-cover rounded border"
            />
          );
        })}
      </div>
    );
  }

  const s = typeof value === "string" ? value : "";
  return s ? <span className="text-sm">{s}</span> : <span className="text-muted-foreground">—</span>;
}

// ─── Éditeur d'un champ dans le modal (une colonne = un champ) ───

function RowFieldEditor({
  label,
  columnType,
  value,
  onChange,
}: {
  label: string;
  columnType: string;
  value: SimpleTableCell | SimpleTableCell[];
  onChange: (v: SimpleTableCell | SimpleTableCell[]) => void;
}) {
  const id = useId();

  switch (columnType) {
    case "Case à cocher":
      return (
        <div className="flex items-center gap-2">
          <Checkbox id={id} checked={value === "x"} onCheckedChange={(c) => onChange(c ? "x" : "")} />
          <label htmlFor={id} className="text-sm font-medium">{label}</label>
        </div>
      );

    case "Nombre":
      return (
        <div className="space-y-1">
          <label htmlFor={id} className="text-sm font-medium">{label}</label>
          <Input id={id} type="number" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      );

    case "Image":
      return (
        <div className="space-y-1">
          <span className="text-sm font-medium">{label}</span>
          <ImageCell value={Array.isArray(value) ? "" : value} multiple={false} onChange={onChange} ariaLabel={label} />
        </div>
      );

    case "Images":
      return (
        <div className="space-y-1">
          <span className="text-sm font-medium">{label}</span>
          <ImageCell value={Array.isArray(value) ? value : []} multiple onChange={onChange} ariaLabel={label} />
        </div>
      );

    default: // Text
      return (
        <div className="space-y-1">
          <label htmlFor={id} className="text-sm font-medium">{label}</label>
          <Input id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
  }
}

// ─── Modal d'édition d'une ligne (mode editInModal) ─────────────

interface SimpleTableRowModalProps {
  isNew: boolean;
  /** En-tête de la colonne 0 (label de ligne). */
  rowLabelHeader: string;
  columns: SimpleTableConfig["columns"];
  singleAnswerByLine: boolean;
  initialRow: (SimpleTableCell | SimpleTableCell[])[];
  onSave: (row: (SimpleTableCell | SimpleTableCell[])[]) => void;
  onDelete: () => void;
  onClose: () => void;
}

function SimpleTableRowModal({
  isNew,
  rowLabelHeader,
  columns,
  singleAnswerByLine,
  initialRow,
  onSave,
  onDelete,
  onClose,
}: SimpleTableRowModalProps) {
  // Copie profonde des cellules (les cellules Array = Images ne doivent pas être mutées en place).
  const [draft, setDraft] = useState<(SimpleTableCell | SimpleTableCell[])[]>(
    () => initialRow.map((c) => (Array.isArray(c) ? [...c] : c)),
  );

  const setCell = (cellIndex: number, val: SimpleTableCell | SimpleTableCell[]) => {
    setDraft((prev) => {
      const next = prev.map((c) => (Array.isArray(c) ? [...c] : c));
      next[cellIndex] = val;
      // Exclusivité des cases à cocher sur la ligne.
      if (singleAnswerByLine && val === "x") {
        columns.forEach((col, colIdx) => {
          const ci = colIdx + 1;
          if (ci !== cellIndex && col.type === "Case à cocher") next[ci] = "";
        });
      }
      return next;
    });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Ajouter une ligne" : "Modifier la ligne"}</DialogTitle>
          <DialogDescription>Renseignez les champs ci-dessous puis enregistrez.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Colonne 0 : label de ligne (toujours un texte) */}
          <RowFieldEditor
            label={rowLabelHeader}
            columnType="Text"
            value={draft[0] ?? ""}
            onChange={(v) => setCell(0, v)}
          />
          {columns.map((col, colIdx) => (
            <RowFieldEditor
              key={colIdx}
              label={col.label || `Colonne ${colIdx + 1}`}
              columnType={col.type}
              value={draft[colIdx + 1] ?? (col.type === "Images" ? [] : "")}
              onChange={(v) => setCell(colIdx + 1, v)}
            />
          ))}
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          {!isNew ? (
            <Button
              type="button"
              variant="ghost"
              className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Supprimer cette ligne
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="button" onClick={() => onSave(draft)}>Enregistrer</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main SimpleTableField Component ─────────────────────────────

interface SimpleTableFieldProps {
  field: FormFieldMapping;
  errors: FieldErrors;
  value?: SimpleTableValue;
  onChange?: (value: SimpleTableValue) => void;
  readOnly?: boolean;
  hideLabel?: boolean;
}

export function SimpleTableField({
  field,
  errors,
  value = [],
  onChange,
  readOnly,
  hideLabel,
}: SimpleTableFieldProps) {
  const config = field.simpleTableConfig;
  const hasError = !!errors[field.name];
  const columns = config?.columns ?? [];
  const activeNewLine = config?.activeNewLine ?? false;
  const singleAnswerByLine = config?.singleAnswerByLine ?? false;
  const editInModal = config?.editInModal ?? false;
  const interactive = !readOnly;
  const baseUrl = getBaseUrl();

  // Mode modal : index de la ligne en cours d'édition (`"new"` = ajout, `null` = fermé).
  const [modalRow, setModalRow] = useState<number | "new" | null>(null);

  // Row 0 = headers, Row 1+ = data
  const headers = value[0] || [];
  const dataRows = value.slice(1);

  const handleCellChange =
    (rowIndex: number, colIndex: number, cellValue: SimpleTableCell | SimpleTableCell[]) => {
      if (!value || !onChange) return;

      const newValue = value.map((row) => [...row]);
      if (newValue[rowIndex]) {
        newValue[rowIndex][colIndex] = cellValue;
      }
      onChange(newValue);
    };

  const handleRowLabelChange =
    (rowIndex: number, label: string) => {
      if (!value || !onChange) return;
      const newValue = value.map((row) => [...row]);
      if (newValue[rowIndex]) {
        newValue[rowIndex][0] = label;
      }
      onChange(newValue);
    };

  const makeEmptyRow = () => buildEmptySimpleTableRow(columns);
  const makeHeadersRow = () => buildSimpleTableHeaders({ tableName: config?.tableName ?? "", columns });

  const handleAddRow = () => {
    if (!onChange) return;
    onChange(upsertSimpleTableRow(value, "new", makeEmptyRow(), makeHeadersRow()));
  };

  const handleRemoveRow = (rowIndex: number) => {
    if (!onChange) return;
    onChange(removeSimpleTableRow(value, rowIndex));
  };

  // ── Handlers du mode modal ──
  const handleModalSave = (row: (SimpleTableCell | SimpleTableCell[])[]) => {
    if (!onChange || modalRow === null) return;
    onChange(upsertSimpleTableRow(value, modalRow, row, makeHeadersRow()));
    setModalRow(null);
  };

  const handleModalDelete = () => {
    if (!onChange || typeof modalRow !== "number") return;
    onChange(removeSimpleTableRow(value, modalRow));
    setModalRow(null);
  };

  if (!config) return null;

  const rowLabelHeader =
    (typeof headers[0] === "string" ? headers[0] : "") || config.tableName || "";

  // Texte d'en-tête robuste : les headers stockés (`value[0]`) sont normalement
  // des strings, mais une donnée legacy corrompue (objet) donnerait
  // "[object Object]" via String(). On retombe alors sur le label de config.
  const headerText = (header: unknown, colIndex: number): string => {
    if (typeof header === "string") return header;
    if (typeof header === "number") return String(header);
    return colIndex === 0 ? config.tableName : (columns[colIndex - 1]?.label ?? "");
  };

  return (
    <div className={cn("space-y-2", field.width || "col-span-12")}>
      {/* Label — `<div>` car le control n'est pas un input ciblable. */}
      {!hideLabel && (
        <div
          id={`${field.name}-label`}
          className={cn(
            "block text-sm font-medium",
            hasError && "text-destructive"
          )}
        >
          {field.label}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </div>
      )}

      {field.info && <HintText text={field.info} />}

      {editInModal ? (
        /* ─── Mode ÉDITION EN MODAL : tableau lecture seule, lignes cliquables ─── */
        <>
          <div
            className="rounded-md border border-border"
            aria-labelledby={!hideLabel ? `${field.name}-label` : undefined}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? `${field.name}-error` : undefined}
          >
            <ScrollArea className="w-full whitespace-nowrap">
              <Table className="w-max min-w-full border-collapse">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {headers.map((header, colIndex) => (
                      <TableHead key={colIndex} scope="col" className="text-xs font-semibold border border-border">
                        {headerText(header, colIndex)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataRows.map((row, dataIndex) => {
                    const actualRowIndex = dataIndex + 1; // +1 car la ligne 0 = en-têtes
                    const rowLabel = typeof row[0] === "string" && row[0] ? row[0] : `${dataIndex + 1}`;
                    return (
                      <TableRow
                        key={dataIndex}
                        className={cn(
                          interactive &&
                            "cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        )}
                        onClick={interactive ? () => setModalRow(actualRowIndex) : undefined}
                        role={interactive ? "button" : undefined}
                        tabIndex={interactive ? 0 : undefined}
                        aria-label={interactive ? `Modifier la ligne ${rowLabel}` : undefined}
                        onKeyDown={
                          interactive
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setModalRow(actualRowIndex);
                                }
                              }
                            : undefined
                        }
                      >
                        {/* Colonne 0 : label de ligne */}
                        <TableHead scope="row" className="bg-muted/30 min-w-30 border border-border px-3 py-2 text-sm font-medium">
                          {typeof row[0] === "string" && row[0] ? row[0] : <span className="text-muted-foreground">—</span>}
                        </TableHead>
                        {columns.map((col, colIdx) => (
                          <TableCell key={colIdx} className="border border-border px-3 py-2 align-middle">
                            <ReadOnlyCell value={row[colIdx + 1] ?? ""} columnType={col.type} baseUrl={baseUrl} />
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}

                  {dataRows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length + 1}
                        className="text-center text-muted-foreground py-6"
                      >
                        Aucune ligne.{interactive && " Cliquez sur « Ajouter une ligne »."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" className="h-2" />
            </ScrollArea>
          </div>

          {/* Ajout de ligne (CRUD complet dans le modal, indépendant de activeNewLine) */}
          {interactive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setModalRow("new")}
            >
              <Plus className="w-4 h-4" />
              Ajouter une ligne
            </Button>
          )}

          {/* Modal monté conditionnellement (état réinitialisé à chaque ouverture) */}
          {modalRow !== null && (
            <SimpleTableRowModal
              isNew={modalRow === "new"}
              rowLabelHeader={rowLabelHeader}
              columns={columns}
              singleAnswerByLine={singleAnswerByLine}
              initialRow={modalRow === "new" ? makeEmptyRow() : (value[modalRow] ?? makeEmptyRow())}
              onSave={handleModalSave}
              onDelete={handleModalDelete}
              onClose={() => setModalRow(null)}
            />
          )}
        </>
      ) : (
        /* ─── Mode ÉDITION INLINE (comportement historique) ─── */
        <>
          <div
            className="rounded-md border border-border"
            aria-labelledby={!hideLabel ? `${field.name}-label` : undefined}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? `${field.name}-error` : undefined}
          >
            <ScrollArea className="w-full whitespace-nowrap">
              <Table className="w-max min-w-full border-collapse">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {headers.map((header, colIndex) => (
                      <TableHead key={colIndex} scope="col" className="text-xs font-semibold border border-border">
                        {headerText(header, colIndex)}
                      </TableHead>
                    ))}
                    {activeNewLine && !readOnly && <TableHead scope="col" aria-hidden="true" className="w-10 border border-border" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataRows.map((row, dataIndex) => {
                    const actualRowIndex = dataIndex + 1; // +1 because row 0 is headers
                    return (
                      <TableRow key={dataIndex}>
                        {/* Column 0: row label */}
                        <TableHead scope="row" className={cn("bg-muted/30 min-w-30 border border-border", CELL_CN)}>
                          <Input
                            value={typeof row[0] === "string" ? row[0] : ""}
                            onChange={(e) => handleRowLabelChange(actualRowIndex, e.target.value)}
                            aria-label={`Label ligne ${dataIndex + 1}`}
                            className={cn(CELL_INPUT_CN, "font-medium")}
                            readOnly={readOnly}
                            tabIndex={readOnly ? -1 : undefined}
                          />
                        </TableHead>

                        {/* Data columns */}
                        {columns.map((col, colIdx) => {
                          const cellIndex = colIdx + 1; // +1 because column 0 is the row label
                          const isTypedInput = col.type === "Text" || col.type === "Nombre";
                          return (
                            <TableCell key={colIdx} className={cn("border border-border", isTypedInput ? CELL_CN : "p-2")}>
                              <CellRenderer
                                value={row[cellIndex] ?? ""}
                                columnType={col.type}
                                rowIndex={actualRowIndex}
                                colIndex={cellIndex}
                                singleAnswerByLine={singleAnswerByLine}
                                rowValues={row}
                                columns={columns}
                                onCellChange={handleCellChange}
                                readOnly={readOnly}
                              />
                            </TableCell>
                          );
                        })}

                        {/* Delete button */}
                        {activeNewLine && !readOnly && (
                          <TableCell className="border border-border p-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveRow(actualRowIndex)}
                              aria-label={`Supprimer ligne ${dataIndex + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}

                  {dataRows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length + 1 + (activeNewLine && !readOnly ? 1 : 0)}
                        className="text-center text-muted-foreground py-6"
                      >
                        Aucune ligne. {activeNewLine && "Cliquez sur le bouton ci-dessous pour en ajouter."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" className="h-2" />
            </ScrollArea>
          </div>

          {/* Add row button */}
          {activeNewLine && !readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleAddRow}
            >
              <Plus className="w-4 h-4" />
              Ajouter une ligne
            </Button>
          )}
        </>
      )}

      {/* Error message */}
      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}
