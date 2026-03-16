import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, X, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

interface ImageFieldProps {
  label: string;
  fieldKey: string;
  value: unknown;
  onChange: (v: unknown) => void;
  isOptional: boolean;
  compact?: boolean;
}

export function ImageField({
  label,
  value,
  onChange,
  isOptional,
  compact,
}: ImageFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentValue = (value as string) ?? "";

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
      }

      const { path } = await res.json();
      onChange(path);
    } catch (e) {
      console.error("Upload failed:", e);
      toast.error(`Upload échoué: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const file = e.clipboardData.files?.[0];
    if (file?.type.startsWith("image/")) {
      e.preventDefault();
      uploadFile(file);
      return;
    }

    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) uploadFile(blob);
        return;
      }
    }

  }

  return (
    <div className="space-y-1.5" onPaste={handlePaste} tabIndex={-1}>
      <Label className="text-xs font-medium">
        {label}{" "}
        {isOptional && (
          <span className="text-muted-foreground">(optionnel)</span>
        )}
      </Label>

      {currentValue && (
        <div className="relative group rounded-md overflow-hidden border bg-muted">
          <img
            src={currentValue}
            alt={label}
            className="w-full h-24 object-contain bg-muted"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <Button
            size="icon"
            variant="destructive"
            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onChange(isOptional ? undefined : "")}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div
        className={`relative border-2 border-dashed rounded-md p-2 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center justify-center gap-2 py-1">
          {uploading ? (
            <span className="text-xs text-muted-foreground animate-pulse">Upload...</span>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Glisser, coller ou cliquer
              </span>
            </>
          )}
        </div>
      </div>

      {/* URL input */}
      <div className="flex items-center gap-1">
        <LinkIcon className="h-3 w-3 text-muted-foreground shrink-0" />
        <Input
          value={currentValue}
          onChange={(e) =>
            onChange(e.target.value || (isOptional ? undefined : ""))
          }
          onPaste={handlePaste}
          placeholder="/images/..."
          className={compact ? "h-7 text-xs" : "h-8 text-xs"}
        />
      </div>
    </div>
  );
}

const IMAGE_KEYS = new Set([
  "logo", "logoIcon", "image", "backgroundImage", "src",
  "favicon", "icon", "avatar", "banner", "thumbnail",
  "cover", "photo", "picture", "poster",
]);

const IMAGE_SUFFIXES = ["Image", "Img", "Logo", "Icon", "Avatar", "Banner", "Src", "Photo", "Thumbnail"];

export function isImageKey(key: string): boolean {
  if (IMAGE_KEYS.has(key)) return true;
  return IMAGE_SUFFIXES.some((s) => key.endsWith(s));
}
