import { useState, useCallback, useRef, memo } from "react";
import type { FieldErrors } from "react-hook-form";
import { Trash2, Plus, ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ImageViewer } from "@/components/ui/image-viewer";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { FormFieldMapping, SimpleTableValue, SimpleTableConfig, SimpleTableCell, ImageUploadValue } from "../types";
import { validateImageFile, compressImage, canCompressImage, DEFAULT_IMAGE_VALIDATION_CONFIG } from "@/utils/imageUtils";
import { getBaseUrl } from "@/lib/constant/common";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function HintText({ text }: { text: string }) {
  return (
    <div className="text-xs text-muted-foreground -mt-1 mb-1 prose prose-xs dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
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

  const resolveImageSrc = useCallback((src: string) => {
    if (!src) return src;
    if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:")) {
      return src;
    }
    if (src.startsWith("/")) {
      return `${baseUrl}${src}`;
    }
    return `${baseUrl}/${src}`;
  }, [baseUrl]);

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

// ─── Table Cell Renderer ────────────────────────────────────────

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

  const handleAddRow = () => {
    if (!value || !onChange) return;
    const newRow: (SimpleTableCell | SimpleTableCell[])[] = [""];
    for (const col of columns) {
      newRow.push(col.type === "Images" ? [] : "");
    }
    onChange([...value, newRow]);
  };

  const handleRemoveRow =
    (rowIndex: number) => {
      if (!value || !onChange) return;
      const newValue = value.filter((_, i) => i !== rowIndex);
      onChange(newValue);
    };

  if (!config) return null;

  const labelId = `${field.name}-label`;
  const descId = field.info ? `${field.name}-desc` : undefined;
  const errorId = hasError ? `${field.name}-error` : undefined;
  // aria-describedby: description seule ; l'erreur passe par aria-errormessage (évite la double annonce)

  return (
    <div
      data-field-name={field.name}
      role="group"
      aria-labelledby={!hideLabel && field.label ? labelId : undefined}
      aria-invalid={hasError || undefined}
      aria-describedby={descId}
      aria-errormessage={errorId}
      aria-required={field.isRequired || undefined}
      className={cn("space-y-2", field.width || "col-span-12")}
    >
      {/* Label */}
      {!hideLabel && (
        <label
          id={labelId}
          htmlFor={field.name}
          className={cn(
            "block text-sm font-medium",
            hasError && "text-destructive"
          )}
        >
          {field.label}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      {field.info && <HintText text={field.info} />}

      {/* Table */}
      <div className="rounded-md border border-border">
        <ScrollArea className="w-full whitespace-nowrap">
            <Table className="w-max min-w-full border-collapse">
            <TableHeader>
                <TableRow className="bg-muted/50">
                {headers.map((header, colIndex) => (
                    <TableHead key={colIndex} className="text-xs font-semibold border border-border">
                    {typeof header === "string" ? header : String(header)}
                    </TableHead>
                ))}
                {activeNewLine && !readOnly && <TableHead className="w-10 border border-border" />}
                </TableRow>
            </TableHeader>
            <TableBody>
                {dataRows.map((row, dataIndex) => {
                const actualRowIndex = dataIndex + 1; // +1 because row 0 is headers
                return (
                    <TableRow key={dataIndex}>
                    {/* Column 0: row label */}
                    <TableHead className={cn("bg-muted/30 min-w-30 border border-border", CELL_CN)}>
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

      {/* Error message */}
      {hasError && (
        <p id={errorId} role="alert" className="text-xs text-destructive flex items-center gap-1 mt-1">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {errors[field.name]?.message as string}
        </p>
      )}
    </div>
  );
}
