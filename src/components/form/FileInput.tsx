import React, { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

export interface FileInputProps {
  label?: string;
  name: string;
  accept?: string;
  multiple?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
  helpText?: string;
  buttonText?: string;
}

const FileInput: React.FC<FileInputProps> = ({
  label,
  name,
  accept,
  multiple = false,
  onChange,
  onBlur,
  required = false,
  disabled = false,
  error,
  helpText,
  buttonText = "Choisir un fichier",
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={name} className={cn(error && "text-destructive")}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      
      <div className="flex items-center gap-2">
        <Input
          ref={fileInputRef}
          id={name}
          name={name}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={onChange}
          onBlur={onBlur}
          required={required}
          disabled={disabled}
          className={cn("hidden", error && "border-destructive")}
        />
        
        <Button
          type="button"
          variant="outline"
          onClick={handleButtonClick}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2",
            error && "border-destructive text-destructive"
          )}
        >
          <Upload className="h-4 w-4" />
          {buttonText}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {helpText && !error && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
};

export default FileInput;
